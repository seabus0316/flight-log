import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { config } from "dotenv";
import express from "express";
import fs from "fs";

config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const LOG_PATH = "./flightlogs.json";

// Load flight logs from file (persistent storage)
function loadLogs() {
  if (fs.existsSync(LOG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LOG_PATH, "utf8"));
    } catch (e) {
      console.error("Failed to parse flightlogs.json, starting with empty log.");
      return [];
    }
  }
  return [];
}
let flightLogs = loadLogs();

// Save flight logs to file
function saveLogs() {
  fs.writeFileSync(LOG_PATH, JSON.stringify(flightLogs, null, 2), "utf8");
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

  if (interaction.commandName === "flight-log") {
    const departure = interaction.options.getString("departure");
    const arrival = interaction.options.getString("arrival");
    const plane = interaction.options.getString("plane");
    const callsign = `EVA ${interaction.options.getString("callsign")}`;
    const passengers = interaction.options.getString("passengers");
    const time = interaction.options.getString("time") || "N/A";
    const image = interaction.options.getString("image");
    const pilot = interaction.options.getUser("pilot") || interaction.user;

    // Save flight log (with persist)
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
    flightLogs.push(newLog);
    saveLogs();

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
    const logs = flightLogs.filter(log => log.pilotId === pilot.id);

    if (logs.length === 0) {
      await interaction.reply(`No flight records found for <@${pilot.id}>.`);
      return;
    }

    let msg = `**Flight records for <@${pilot.id}>:**\n`;
    logs.forEach((log, idx) => {
      msg += `\n${idx + 1}. ${log.callsign} | ${log.departure} → ${log.arrival} | ${log.plane} | ${log.passengers} pax | ${log.time}`;
    });

    await interaction.reply(msg);
  }

  if (interaction.commandName === "remove") {
    const pilot = interaction.options.getUser("pilot");
    const index = interaction.options.getInteger("index") - 1;

    const logs = flightLogs.filter(log => log.pilotId === pilot.id);

    if (logs.length === 0) {
      await interaction.reply(`No flight records found for <@${pilot.id}>.`);
      return;
    }
    if (index < 0 || index >= logs.length) {
      await interaction.reply(`Invalid index. Use /view to check the correct number.`);
      return;
    }

    // Remove from flightLogs (with persist)
    const logToRemove = logs[index];
    const removeIndex = flightLogs.findIndex(
      log =>
        log.pilotId === logToRemove.pilotId &&
        log.timestamp === logToRemove.timestamp
    );
    flightLogs.splice(removeIndex, 1);
    saveLogs();

    await interaction.reply(`Removed flight record #${index + 1} for <@${pilot.id}>: ${logToRemove.callsign} | ${logToRemove.departure} → ${logToRemove.arrival}`);
  }
});

client.login(token);

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is running at http://localhost:${PORT}`);
});
