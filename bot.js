import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Title from "./models/title.js"; // Ensure correct path and filename

dotenv.config();

// Connect to MongoDB
// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));


const client = new Client({
  intents: [Intents.Guilds, Intents.GuildMessages],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  console.log("Received interaction:", interaction);
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  console.log(`Received command: ${commandName}`);

  try {
    if (commandName === "title") {
      // Extract options from the interaction
      const userId = interaction.options.getUser("user")?.id;
      const title = interaction.options.getString("title");
      const kingdom = interaction.options.getString("kingdom");
      const x = interaction.options.getInteger("x");
      const y = interaction.options.getInteger("y");

      // Check if options are correctly retrieved
      console.log({ userId, title, kingdom, x, y });

      // Save to database
      const newTitle = new Title({ userId, title, kingdom, x, y });
      await newTitle.save();

      await interaction.reply("Title assigned and saved!");
    } else if (commandName === "titles") {
      // Retrieve titles from database
      const titles = await Title.find({});
      const titlesList = titles.map(t => `${t.userId} - ${t.title}`).join("\n");
      await interaction.reply(`Here are all the available titles:\n${titlesList}`);
    } else {
      await interaction.reply("Unknown command");
    }
  } catch (error) {
    console.error("Error handling interaction:", error);
  }
});


client.login(process.env.DISCORD_TOKEN);
