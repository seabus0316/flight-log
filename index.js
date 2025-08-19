import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import express from "express";
import { MongoClient } from "mongodb";

// 讀取 Render 的環境變數
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const mongoUri = process.env.MONGODB_URI;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// --- MongoDB setup ---
const dbName = "flightlogdb"; // 你可以自訂
const collectionName = "flightlogs";
let db, flightLogsCollection;

async function connectMongo() {
  const mongoClient = new MongoClient(mongoUri, { useUnifiedTopology: true });
  await mongoClient.connect();
  db = mongoClient.db(dbName);
  flightLogsCollection = db.collection(collectionName);
  console.log("✅ Connected to MongoDB!");
}

// --- Discord commands ---
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
      { name: "image", type: 3, description: "Image URL (optional)", required: false },
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
];

client.once("ready", async () => {
  console.log(`✅ Logged in as: ${client.user.tag}`);
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

  // 確認 MongoDB 已連線
  if (!flightLogsCollection) {
    await interaction.reply("Database not connected. Please try again later.");
    return;
  }

  if (interaction.commandName === "flight-log") {
    const departure = interaction.options.getString("departure");
    const arrival = interaction.options.getString("arrival");
    const plane = interaction.options.getString("plane");
    const callsign = `EVA ${interaction.options.getString("callsign")}`;
    const passengers = interaction.options.getString("passengers");
    const time = interaction.options.getString("time") || "N/A";
    const image = interaction.options.getString("image");
    const pilot = interaction.options.getUser("pilot") || interaction.user;

    const newLog = {
      pilotId: pilot.id,
      pilotTag: pilot.tag,
      departure,
      arrival,
      plane,
      callsign,
      passengers,
      time,
      image,
      timestamp: Date.now(),
    };

    await flightLogsCollection.insertOne(newLog);

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
      .setFooter({ text: "Thank you for using Flight Log Bot!" });

    if (image) embed.setImage(image);

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === "view") {
    const pilot = interaction.options.getUser("pilot");
    const logs = await flightLogsCollection.find({ pilotId: pilot.id }).sort({ timestamp: 1 }).toArray();

    if (logs.length === 0) {
      await interaction.reply({ content: `No flight records found for <@${pilot.id}>.`, ephemeral: true });
      return;
    }

    let msg = `**Flight records for <@${pilot.id}>:**\n`;
    logs.forEach((log, idx) => {
      msg += `\n${idx + 1}. ${log.callsign} | ${log.departure} → ${log.arrival} | ${log.plane} | ${log.passengers} pax | ${log.time}`;
    });

    await interaction.reply({ content: msg, ephemeral: true });
  }

  if (interaction.commandName === "remove") {
    const pilot = interaction.options.getUser("pilot");
    const index = interaction.options.getInteger("index") - 1;

    const logs = await flightLogsCollection.find({ pilotId: pilot.id }).sort({ timestamp: 1 }).toArray();

    if (logs.length === 0) {
      await interaction.reply({ content: `No flight records found for <@${pilot.id}>.`, ephemeral: true });
      return;
    }
    if (index < 0 || index >= logs.length) {
      await interaction.reply({ content: `Invalid index. Use /view to check the correct number.`, ephemeral: true });
      return;
    }

    const logToRemove = logs[index];
    await flightLogsCollection.deleteOne({ _id: logToRemove._id });

    await interaction.reply({ content: `Removed flight record #${index + 1} for <@${pilot.id}>: ${logToRemove.callsign} | ${logToRemove.departure} → ${logToRemove.arrival}`, ephemeral: true });
  }
});

async function start() {
  await connectMongo();

  client.login(token);

  const app = express();
  const PORT = process.env.PORT || 8080;

  app.get("/", (req, res) => {
    res.send("Bot is running!");
  });

  app.listen(PORT, () => {
    console.log(`🌐 Web server is running at http://localhost:${PORT}`);
  });
}

start();
