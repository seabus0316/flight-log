import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import { config } from "dotenv";
import express from "express";

config();

const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// 用來暫存所有 flight log
const flightLogs = [];

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
      { name: "time", type: 3, description: "Flight time", required: false },
      { name: "image", type: 3, description: "URL of an image (optional)", required: false },
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
    ],
  },
  {
    name: "view",
    description: "View logged flights of a pilot",
    options: [
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
    ],
  },
];

client.once("ready", async () => {
  console.log(`✅ 已登入：${client.user.tag}`);
  try {
    const guild = await client.guilds.fetch(guildId);
    await guild.commands.set(commands);
    console.log("✅ 指令註冊成功！");
  } catch (err) {
    console.error("❌ 指令註冊失敗：", err);
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

    // 儲存 flight log
    flightLogs.push({
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
    });

    const embed = new EmbedBuilder()
      .setColor(0x00a64f)
      .setTitle(callsign)
      .setDescription("Flight details are as follows:")
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
      await interaction.reply(`找不到 <@${pilot.id}> 的飛行紀錄。`);
      return;
    }

    let msg = `**<@${pilot.id}> 的飛行紀錄：**\n`;
    logs.forEach((log, idx) => {
      msg += `\n${idx + 1}. ${log.callsign} | ${log.departure} → ${log.arrival} | ${log.plane} | ${log.passengers}人 | ${log.time}`;
    });

    await interaction.reply(msg);
  }
});

client.login(token);

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => {
  console.log(`🌐 保持活躍的 Web 伺服器正在 http://localhost:${PORT} 運行`);
});
