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
  if (interaction.commandName !== "flight-log") return;

  const departure = interaction.options.getString("departure");
  const arrival = interaction.options.getString("arrival");
  const plane = interaction.options.getString("plane");
  const callsign = `EVA ${interaction.options.getString("callsign")}`;
  const passengers = interaction.options.getString("passengers");
  const time = interaction.options.getString("time") || "N/A";
  const image = interaction.options.getString("image");

  const embed = new EmbedBuilder()
    .setColor(0x00a64f)
    .setTitle(callsign)
    .setDescription("Flight details are as follows:")
    .addFields(
      { name: "Departure", value: departure, inline: true },
      { name: "Arrival", value: arrival, inline: true },
      { name: "Plane", value: plane, inline: true },
      { name: "Passengers", value: passengers, inline: true },
      { name: "Time", value: time, inline: true },
    )
    .setFooter({ text: "Thank you for using Flight Log Bot!" });

  if (image) embed.setImage(image);

  await interaction.reply({ embeds: [embed] });
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