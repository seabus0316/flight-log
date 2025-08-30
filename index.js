import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { config } from "dotenv";
import express from "express";
import mongoose from "mongoose";

config();

const token = process.env.TOKEN || process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/flightlogs";

// MongoDB Schema
const flightLogSchema = new mongoose.Schema({
  pilotId: { type: String, required: true },
  pilotTag: { type: String, required: true },
  departure: { type: String, required: true },
  arrival: { type: String, required: true },
  plane: { type: String, required: true },
  callsign: { type: String, required: true },
  passengers: { type: String, required: true },
  time: { type: String, default: "N/A" },
  image: { type: String, default: null },
  timestamp: { type: Date, default: Date.now }
});

const FlightLog = mongoose.model("FlightLog", flightLogSchema);

async function connectToMongoDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB successfully!");
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    process.exit(1);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

const commands = [
  {
    name: "flight-log",
    description: "Log a flight",
    options: [
      { name: "departure", type: 3, description: "Departure airport", required: true },
      { name: "arrival", type: 3, description: "Arrival airport", required: true },
      { name: "plane", type: 3, description: "Type of plane", required: true },
      { name: "callsign", type: 3, description: "Pilot callsign", required: true },
      { name: "passengers", type: 3, description: "Number of passengers", required: true },
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
      { name: "time", type: 3, description: "Flight time", required: false },
      { name: "image", type: 11, description: "Upload an image (optional)", required: false },
    ],
  },
  {
    name: "view",
    description: "View logged flights of a pilot",
    options: [
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
    ],
  },
  {
    name: "remove",
    description: "Remove a logged flight for a pilot (by index)",
    options: [
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
      { name: "index", type: 4, description: "Flight log index (from /view)", required: true },
    ],
  },
  {
    name: "stats",
    description: "View flight statistics for a pilot",
    options: [
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
    ],
  },
];

client.once("ready", async () => {
  console.log(`✅ Logged in as: ${client.user.tag}`);
  await connectToMongoDB();
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set(commands);
    console.log("✅ Commands registered successfully!");
  } catch (err) {
    console.error("❌ Failed to register commands:", err);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  try {
    if (interaction.commandName === "flight-log") {
      const departure = interaction.options.getString("departure");
      const arrival = interaction.options.getString("arrival");
      const plane = interaction.options.getString("plane");
      const callsign = `EVA ${interaction.options.getString("callsign")}`;
      const passengers = interaction.options.getString("passengers");
      const time = interaction.options.getString("time") || "N/A";
      const imageAttachment = interaction.options.getAttachment("image");
      const image = imageAttachment ? imageAttachment.url : null;
      const pilot = interaction.options.getUser("pilot") || interaction.user;

      const newLog = new FlightLog({
        pilotId: pilot.id,
        pilotTag: pilot.tag,
        departure,
        arrival,
        plane,
        callsign,
        passengers,
        time,
        image,
      });

      await newLog.save();

      const embed = new EmbedBuilder()
        .setColor(0x00a64f)
        .setTitle(callsign)
        .setDescription("Flight details:")
        .addFields(
          { name: "Pilot", value: `<@${pilot.id}>`, inline: true },
          { name: "Departure", value: departure, inline: true },
          { name: "Arrival", value: arrival, inline: true },
          { name: "Plane", value: plane, inline: true },
          { name: "Passengers", value: passengers, inline: true },
          { name: "Time", value: time, inline: true },
        )
        .setFooter({ text: "Flight logged successfully!" });

      if (image) embed.setImage(image);
      await interaction.reply({ embeds: [embed] });
    }

    if (interaction.commandName === "view") {
      const pilot = interaction.options.getUser("pilot");
      const logs = await FlightLog.find({ pilotId: pilot.id }).sort({ timestamp: -1 });

      if (logs.length === 0) {
        await interaction.reply({ content: `No flight records found for <@${pilot.id}>.`, ephemeral: true });
        return;
      }

      let msg = `**Flight records for <@${pilot.id}> (${logs.length} total flights):**\n`;
      logs.forEach((log, idx) => {
        const date = new Date(log.timestamp).toLocaleDateString();
        msg += `\n${idx + 1}. ${log.callsign} | ${log.departure} → ${log.arrival} | ${log.plane} | ${log.passengers} pax | ${log.time} | ${date}`;
      });

      if (msg.length > 2000) {
        const chunks = [];
        const lines = msg.split('\n');
        let currentChunk = lines[0] + '\n';
        for (let i = 1; i < lines.length; i++) {
          if (currentChunk.length + lines[i].length > 1900) {
            chunks.push(currentChunk);
            currentChunk = lines[i] + '\n';
          } else {
            currentChunk += lines[i] + '\n';
          }
        }
        chunks.push(currentChunk);
        await interaction.reply({ content: chunks[0], ephemeral: true });
        for (let i = 1; i < chunks.length; i++) {
          await interaction.followUp({ content: chunks[i], ephemeral: true });
        }
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }

    if (interaction.commandName === "remove") {
      const pilot = interaction.options.getUser("pilot");
      const index = interaction.options.getInteger("index") - 1;

      const logs = await FlightLog.find({ pilotId: pilot.id }).sort({ timestamp: -1 });

      if (logs.length === 0) {
        await interaction.reply({ content: `No flight records found for <@${pilot.id}>.`, ephemeral: true });
        return;
      }
      if (index < 0 || index >= logs.length) {
        await interaction.reply({ content: `Invalid index. Use /view to check the correct number.`, ephemeral: true });
        return;
      }

      const logToRemove = logs[index];
      await FlightLog.findByIdAndDelete(logToRemove._id);

      await interaction.reply({ 
        content: `Removed flight record #${index + 1} for <@${pilot.id}>: ${logToRemove.callsign} | ${logToRemove.departure} → ${logToRemove.arrival}`, 
        ephemeral: true 
      });
    }

    if (interaction.commandName === "stats") {
      const pilot = interaction.options.getUser("pilot");
      const logs = await FlightLog.find({ pilotId: pilot.id });

      if (logs.length === 0) {
        await interaction.reply({ content: `No flight records found for <@${pilot.id}>.`, ephemeral: true });
        return;
      }

      const totalFlights = logs.length;
      const uniqueAirports = new Set();
      const planeTypes = {};
      let totalPassengers = 0;

      logs.forEach(log => {
        uniqueAirports.add(log.departure);
        uniqueAirports.add(log.arrival);
        planeTypes[log.plane] = (planeTypes[log.plane] || 0) + 1;
        totalPassengers += parseInt(log.passengers) || 0;
      });

      const mostUsedPlane = Object.entries(planeTypes)
        .sort(([,a], [,b]) => b - a)[0];

      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`Flight Statistics for ${pilot.tag}`)
        .addFields(
          { name: "Total Flights", value: totalFlights.toString(), inline: true },
          { name: "Unique Airports", value: uniqueAirports.size.toString(), inline: true },
          { name: "Total Passengers", value: totalPassengers.toString(), inline: true },
          { name: "Most Used Aircraft", value: mostUsedPlane ? `${mostUsedPlane[0]} (${mostUsedPlane[1]} flights)` : "N/A", inline: true }
        )
        .setFooter({ text: "Flight statistics" });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (error) {
    console.error("Error handling command:", error);
    const errorMsg = "An error occurred while processing your command. Please try again.";

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMsg, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMsg, ephemeral: true });
    }
  }
});

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

client.login(token);

const app = express();
const PORT = process.env.PORT || 8080;

if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    fetch(`http://localhost:${PORT}/health`)
      .catch(err => console.log('Health check failed:', err.message));
  }, 14 * 60 * 1000);
}

app.get("/", (req, res) => {
  res.send("Flight Log Bot is running with MongoDB!");
});

app.get("/health", async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? "Connected" : "Disconnected";
    res.json({
      status: "OK",
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: "Error", error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});
