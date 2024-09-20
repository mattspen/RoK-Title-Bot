import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Title from "./models/title.js";
import { exec } from "child_process";

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error("MongoDB connection error:", err));

const client = new Client({
  intents: [
    Intents.Guilds,
    Intents.GuildMessages,
    Intents.GuildMessageReactions,
    Intents.GuildMembers
  ],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

const queue = [];
let isProcessing = false;

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;
  if (commandName === "title") {
    const userId = interaction.options.getUser("user")?.id;
    const title = interaction.options.getString("title");
    const kingdom = interaction.options.getString("kingdom");
    const x = interaction.options.getInteger("x");
    const y = interaction.options.getInteger("y");

    const request = { interaction, userId, title, kingdom, x, y };
    queue.push(request);
    console.log(queue.length)
    console.log(`Request added to the queue for user ${userId}. Queue length: ${queue.length}`);

    if (!isProcessing) {
      processQueue();
    }
    
    if (queue.length > 1) {
      await interaction.reply("Your title request has been added to the queue!");
    } else {
      await interaction.reply("Processing your title request...");
    }
  }
});

let timer;

async function processQueue() {
  if (queue.length === 0) {
    console.log("Queue is empty, stopping processing.");
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const request = queue.shift();
  const { interaction, x, y, title, userId } = request;

  try {
    console.log(`Processing title for user ${userId}`);
    await runAdbCommand(x, y, title);

    const message = await interaction.followUp(`Title assigned! React with ✅ when done.`);
    await message.react('✅');

    const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === userId;
    const collector = message.createReactionCollector({ filter, time: 120 * 1000 });

    let remainingTime = 120;

    function resetTimer() {
      remainingTime = 0;
    }

    collector.on('collect', () => {
      resetTimer();
    });

    collector.on('end', collected => {
      if (collected.size === 0) {
        console.log(`No done reaction within time limit. Moving to the next request.`);
      }
      isProcessing = false;
      processQueue();
    });

    function startTimer() {
      timer = setInterval(() => {
        remainingTime -= 1;
        if (remainingTime <= 0) {
          clearInterval(timer);
          console.log(`Timer ended for user ${userId}. Moving to the next request.`);
          collector.stop();
        }
      }, 1000);
    }

    startTimer();

  } catch (error) {
    await interaction.message(`Error processing request for ${userId}: ${error.message}`);
    isProcessing = false;
    processQueue();
  }
}

client.login(process.env.DISCORD_TOKEN);

function runAdbCommand(x, y, title) {
  console.log(`Running ADB command at coordinates (${x}, ${y}) with title: ${title}`);

  const tapWorld = `adb -s emulator-5554 shell input tap 89 978`;
  const tapMagnifyingGlass = `adb -s emulator-5554 shell input tap 660 28`;
  const tapXCoord = `adb -s emulator-5554 shell input tap 962 215`;
  const adbPasteCommandX = `adb -s emulator-5554 shell input text "${x}"`;
  const tapYCoord1 = `adb -s emulator-5554 shell input tap 1169 215`;
  const tapYCoord2 = `adb -s emulator-5554 shell input tap 1169 215`;
  const adbPasteCommandY = `adb -s emulator-5554 shell input text "${y}"`;
  const tapSearch1 = `adb -s emulator-5554 shell input tap 1331 212`;
  const tapSearch2 = `adb -s emulator-5554 shell input tap 1331 212`;

  const commands = [
    { cmd: tapWorld, description: "Tapping World" },
    { cmd: tapMagnifyingGlass, description: "Tapping Magnifying Glass" },
    { cmd: tapXCoord, description: "Tapping X Coordinate Field" },
    { cmd: adbPasteCommandX, description: `Pasting X Coordinate: ${x}` },
    { cmd: tapYCoord1, description: "Tapping Y Coordinate Field" },
    { cmd: tapYCoord2, description: "Tapping Y Coordinate Field Again" },
    { cmd: adbPasteCommandY, description: `Pasting Y Coordinate: ${y}` },
    { cmd: tapSearch1, description: `Searching...` },
    { cmd: tapSearch2, description: `Still searching...` },
  ];

  // Return a Promise that resolves when all commands are executed
  return new Promise((resolve, reject) => {
    function executeCommandWithDelay(index) {
      if (index >= commands.length) {
        console.log("All ADB commands executed.");
        resolve(); // Resolve the Promise when all commands are executed
        return;
      }

      const { cmd, description } = commands[index];
      console.log(`Executing: ${description}`);

      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          console.error(`Error executing ${description}: ${error.message}`);
          reject(error); // Reject the Promise if an error occurs
          return;
        }
        console.log(`${description} output: ${stdout}`);

        // Delay next command by 1 second
        setTimeout(() => executeCommandWithDelay(index + 1), 1000);
      });
    }

    // Start executing commands with delay
    executeCommandWithDelay(0);
  });
}
