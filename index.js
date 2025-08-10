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

// 用於暫存所有紀錄（正式建議改DB）
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
      { name: "pilot", type: 6, description: "Pilot (Discord user)", required: true },
      { name: "time", type: 3, description: "Flight time", required: false },
      { name: "image", type: 3, description: "URL of an image (optional)", required: false },
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

  if (interaction.commandName === "remove") {
    const pilot = interaction.options.getUser("pilot");
    const index = interaction.options.getInteger("index") - 1;

    const logs = flightLogs.filter(log => log.pilotId === pilot.id);

    if (logs.length === 0) {
      await interaction.reply(`找不到 <@${pilot.id}> 的飛行紀錄。`);
      return;
    }
    if (index < 0 || index >= logs.length) {
      await interaction.reply(`索引錯誤，請使用 /view 查詢正確編號。`);
      return;
    }

    // 從 flightLogs 移除
    const logToRemove = logs[index];
    const removeIndex = flightLogs.findIndex(
      log =>
        log.pilotId === logToRemove.pilotId &&
        log.timestamp === logToRemove.timestamp
    );
    flightLogs.splice(removeIndex, 1);

    await interaction.reply(`已移除 <@${pilot.id}> 的第 ${index + 1} 筆飛行紀錄：${logToRemove.callsign} | ${logToRemove.departure} → ${logToRemove.arrival}`);
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
