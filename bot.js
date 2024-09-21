import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import Tesseract from "tesseract.js";
import fs from "fs";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

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
client.login(process.env.DISCORD_TOKEN);

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

    try {
      const user = await User.findOne({ userId });

      if (user) {
        let username = user.username;
        const request = { interaction, userId, username, title, kingdom, x, y };
        queue.push(request);

        if (queue.length > 1) {
          await interaction.reply("Your title request has been added to the queue!");
        } else {
          await interaction.reply("Processing your title request...");
          processQueue();  // Call processQueue after adding the request to the queue
        }
      } else {
        await interaction.reply("You don't have a registered username. Please provide one using `/register [your_username]`.");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      await interaction.reply("An error occurred while fetching your username. Please try again later.");
    }
  }
});

let timer;
let remainingTime = 120;  // Define remainingTime globally

async function processQueue() {
  if (isProcessing || queue.length === 0) {
    console.log("Queue is empty or already being processed, stopping processing.");
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const request = queue.shift();
  const { interaction, x, y, title, userId, username } = request;

  try {
    console.log(`Processing title for user ${username}`);
    await runAdbCommand(x, y, title, username);

    const message = await interaction.followUp(`Title assigned! React with ✅ when done.`);
    await message.react('✅');

    const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === userId;
    const collector = message.createReactionCollector({ filter, time: 120 * 1000 });

    remainingTime = 120;  // Reset remainingTime for each request

    collector.on('collect', () => {
      console.log(`User ${username} reacted. Timer reset to 120 seconds.`);
      remainingTime = 0;  // Reset the remaining time if user reacts
      clearInterval(timer);  // Clear the timer when reaction is collected
      collector.stop();  // Stop the collector when reaction is collected
    });

    collector.on('end', collected => {
      clearInterval(timer);  // Clear the timer when the collector ends
      if (collected.size === 0) {
        console.log(`No done reaction within time limit. Moving to the next request.`);
      } else {
        console.log(`Done reaction collected. Moving to the next request.`);
      }
      isProcessing = false;
      processQueue();  // Move to the next request
    });

    startTimer(collector);  // Start the timer for this request

  } catch (error) {
    console.error(`Error processing request for ${userId}: ${error.message}`);
    isProcessing = false;
    processQueue();  // Continue to the next request even if there's an error
  }
}

function startTimer(collector) {
  timer = setInterval(() => {
    remainingTime -= 1;
    if (remainingTime <= 0) {
      clearInterval(timer);
      console.log(`Times up!`);

      if (collector && !collector.ended) {
        collector.stop();
      }
    }
  }, 1000);
}


function runAdbCommand(x, y, title, username, retryCount = 0, maxRetries = 3) {
  console.log(`Running ADB command at coordinates (${x}, ${y}) for user: ${username} with title: ${title}`);

  const tapWorld = `adb -s emulator-5554 shell input tap 89 978`;
  const tapMagnifyingGlass = `adb -s emulator-5554 shell input tap 660 28`;
  const tapXCoord = `adb -s emulator-5554 shell input tap 962 215`;
  const adbPasteCommandX = `adb -s emulator-5554 shell input text "${x}"`;
  const tapYCoord1 = `adb -s emulator-5554 shell input tap 1169 215`;
  const tapYCoord2 = `adb -s emulator-5554 shell input tap 1169 215`;
  const adbPasteCommandY = `adb -s emulator-5554 shell input text "${y}"`;
  const tapSearch1 = `adb -s emulator-5554 shell input tap 1331 212`;
  const tapSearch2 = `adb -s emulator-5554 shell input tap 1331 212`;
  const tapCity = `adb -s emulator-5554 shell input tap 956 562`;
  const captureScreenshot = `adb exec-out screencap -p > ./screenshot.png`;

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
    { cmd: tapCity, description: `Attempting to open city` },
    { cmd: captureScreenshot, description: "Capturing screenshot" },
  ];

  function executeCommandWithDelay(index) {
    if (index >= commands.length) {
      // Perform OCR after all ADB commands have been executed
      performOCR('./screenshot.png', username)
        .then((text) => {
          if (text.includes(username)) {
            console.log(`User ${username} found in the frame.`);
            // Execute the tapWorld command again
            exec(tapWorld, (error, stdout, stderr) => {
              if (error) {
                console.error(`Error executing tapWorld after user found: ${error.message}`);
                return;
              }
              console.log(`Executed tapWorld after finding user: ${stdout}`);
            });
            // No further actions until the next user
          } else {
            console.log(`User ${username} not found in the frame.`);
            exec(tapWorld, (error, stdout, stderr) => {
              if (error) {
                console.error(`Error returning to home (tapWorld): ${error.message}`);
                return;
              }
              console.log(`Returned to home (tapWorld): ${stdout}`);
              if (retryCount < maxRetries) {
                console.log(`Retrying... Attempt ${retryCount + 1}`);
                setTimeout(() => runAdbCommand(x, y, title, username, retryCount + 1, maxRetries), 1000);
              } else {
                console.log("Max retries reached. Moving to the next request.");
                processQueue(); 
              }
            });
          }
        })
        .catch((err) => {
          console.error('OCR Error:', err);
        });

      return;
    }

    const { cmd, description } = commands[index];
    console.log(`Executing: ${description}`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing ${description}: ${error.message}`);
        return;
      }
      console.log(`${description} output: ${stdout}`);

      setTimeout(() => executeCommandWithDelay(index + 1), 1000);
    });
  }

  executeCommandWithDelay(0);
}



function performOCR(imagePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(imagePath)) {
      return reject('Image not found');
    }

    Tesseract.recognize(imagePath, 'eng', {
      logger: (m) => console.log(m),
    })
      .then(({ data: { text } }) => resolve(text))
      .catch((err) => reject(err));
  });
}
