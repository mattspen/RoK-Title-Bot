import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import { exec } from "child_process";
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
    Intents.GuildMembers,
  ],
});
client.login(process.env.DISCORD_TOKEN);

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

  console.log("Connected to the following servers:");
  client.guilds.cache.forEach((guild) => {
    console.log(`- ${guild.name} (ID: ${guild.id}, Members: ${guild.memberCount})`);
  });
});

const queues = {
  3311: [],
  3299: [],
};

let isProcessing = {
  3311: false,
  3299: false,
};

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "title") {
    const userId = interaction.options.getUser("user")?.id;
    const title = interaction.options.getString("title");
    const x = interaction.options.getInteger("x");
    const y = interaction.options.getInteger("y");

    await interaction.reply("Processing your title request...");

    try {
      const user = await User.findOne({ userId });

      if (user && user.username && user.kingdom) {
        const request = { interaction, userId, title, kingdom: user.kingdom, x, y };

        // Add request to the kingdom-specific queue
        queues[user.kingdom].push(request);
        console.log(`Queue length for kingdom ${user.kingdom}: ${queues[user.kingdom].length}`);

        if (!isProcessing[user.kingdom]) {
          processQueue(user.kingdom);  // Process the queue for this kingdom
        }

        if (queues[user.kingdom].length > 1) {
          await interaction.followUp(`<@${userId}>, Your title request has been added to the queue for kingdom ${user.kingdom}!`);
        }
      } else {
        await interaction.followUp("You don't have a registered username and kingdom. Please use `/register [your_username] [your_kingdom]`.");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      await interaction.followUp("An error occurred while fetching your details. Please try again later.");
    }

  } else if (commandName === "titles") {
    const availableTitles = ["Duke", "Justice", "Architect", "Scientist"];
    await interaction.reply(`Available titles: ${availableTitles.join(", ")}`);

  } else if (commandName === "me") {
    const userId = interaction.user.id;

    try {
      const user = await User.findOne({ userId });
      if (user) {
        await interaction.reply(`Your registered username is: ${user.username} and your kingdom is: ${user.kingdom}`);
      } else {
        await interaction.reply("You don't have a registered username and kingdom. Please use `/register [your_username] [your_kingdom]`.");
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      await interaction.reply("An error occurred while fetching your details. Please try again later.");
    }

  } else if (commandName === "register") {
    const username = interaction.options.getString("username");
    const kingdom = interaction.options.getString("kingdom");
    const userId = interaction.user.id;

    try {
      const user = await User.findOne({ userId });

      if (user) {
        user.username = username;
        user.kingdom = kingdom;
        await user.save();
        await interaction.reply(`Your username has been updated to "${username}" and kingdom to "${kingdom}"!`);
      } else {
        const newUser = new User({ userId, username, kingdom });
        await newUser.save();
        await interaction.reply(`Your username "${username}" and kingdom "${kingdom}" have been registered!`);
      }
    } catch (error) {
      console.error("Error registering user:", error);
      await interaction.reply("An error occurred while registering your username and kingdom. Please try again later.");
    }
  }
});

let timer;
let remainingTime = 120;

async function processQueue(kingdom) {
  // Ensure the kingdom is initialized in queues
  if (!queues[kingdom]) {
    queues[kingdom] = [];
    isProcessing[kingdom] = false;
  }

  // Check if processing is already happening or the queue is empty
  if (isProcessing[kingdom] || queues[kingdom].length === 0) {
    isProcessing[kingdom] = false;
    return;
  }

  isProcessing[kingdom] = true;
  const request = queues[kingdom].shift();
  const { interaction, x, y, title, userId } = request;

  try {
    console.log(`Processing title for user ${userId} in kingdom ${kingdom}`);
    await runAdbCommand(userId, x, y, title, kingdom);

    const message = await interaction.channel.send(`<@${userId}>, You're up! React with ✅ when done.`);
    await message.react('✅');

    const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === userId;
    const collector = message.createReactionCollector({ filter, time: 300 * 1000 });

    remainingTime = 120;

    collector.on('collect', () => {
      remainingTime = 0;
      clearInterval(timer);
      collector.stop();
    });

    collector.on('end', collected => {
      clearInterval(timer);
      interaction.channel.send(collected.size === 0 ? `<@${userId}>, Times up!` : `Done reaction collected. Moving to the next request.`);
      isProcessing[kingdom] = false;
      processQueue(kingdom);
    });

    startTimer(collector);

  } catch (error) {
    console.error(`Error processing request for ${userId} in kingdom ${kingdom}: ${error.message}`);
    isProcessing[kingdom] = false;
    processQueue(kingdom);
  }
}

async function startTimer(collector) {
  timer = setInterval(() => {
    remainingTime -= 1;
    if (remainingTime <= 0) {
      clearInterval(timer);
      if (collector && !collector.ended) {
        collector.stop();
      }
    }
  }, 1000);
}

async function runAdbCommand(userId, x, y, title, kingdom) {
  let deviceId;

  if (kingdom === 3311) {
    deviceId = 'emulator-5554';
  } else if (kingdom === 3299) {
    deviceId = 'emulator-5584';
  } else {
    console.error("Invalid kingdom. Please provide a valid kingdom.");
    return;
  }

  console.log(`Running ADB command on ${deviceId} at coordinates (${x}, ${y}) for title: ${title}`);

  const initialCommands = [
    `adb -s ${deviceId} shell input tap 89 978`,
    `adb -s ${deviceId} shell input tap 660 28`,
    `adb -s ${deviceId} shell input tap 962 215`,
    `adb -s ${deviceId} shell input text "${x}"`,
    `adb -s ${deviceId} shell input tap 1169 215`,
    `adb -s ${deviceId} shell input tap 1169 215`,
    `adb -s ${deviceId} shell input text "${y}"`,
    `adb -s ${deviceId} shell input tap 1331 212`,
    `adb -s ${deviceId} shell input tap 1331 212`,
    `adb -s ${deviceId} shell input tap 956 562`,
    `adb -s ${deviceId} exec-out screencap -p > ./screenshot.png`,
  ];

  const titleCommands = {
    "Justice": [
      `adb -s ${deviceId} shell input tap 440 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_justice.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    "Duke": [
      `adb -s ${deviceId} shell input tap 784 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_duke.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    "Architect": [
      `adb -s ${deviceId} shell input tap 1125 591`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_architect.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    "Scientist": [
      `adb -s ${deviceId} shell input tap 1472 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_scientist.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ]
  };

  async function executeCommandWithDelay(commands, index) {
    if (index >= commands.length) return;

    console.log(`Executing command: ${commands[index]}`);

    return new Promise((resolve, reject) => {
      exec(commands[index], (error, stdout) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }
        setTimeout(() => executeCommandWithDelay(commands, index + 1).then(resolve).catch(reject), 1000);
      });
    });
  }

  try {
    await executeCommandWithDelay(initialCommands, 0);

    // Call Python script to check for the "Add Title" button
    exec('python ./check_title.py', async (error, stdout) => {
      if (error) {
        console.error(`Error executing Python script: ${error.message}`);
        processQueue(); // Continue with the next request
        return;
      }

      let result;
      try {
        result = JSON.parse(stdout); // Parse the output
      } catch (err) {
        console.error('Error parsing Python script output:', err);
        processQueue();
        return;
      }

      if (result.error) {
        console.log("Title button not found. Checking for connection loss...");

        // Take another screenshot for connection-loss check
        exec(`adb -s ${deviceId} exec-out screencap -p > ./screenshot_connection.png`, async (error) => {
          if (error) {
            console.error(`Error taking connection-loss screenshot: ${error.message}`);
            processQueue();
            return;
          }

          exec('python ./check_connection_loss.py', async (connError, connStdout) => {
            if (connError) {
              console.error(`Error executing connection loss check script: ${connError.message}`);
              processQueue();
              return;
            }

            let connResult;
            try {
              connResult = JSON.parse(connStdout); // Parse the output
            } catch (err) {
              console.error('Error parsing connection-loss script output:', err);
              processQueue();
              return;
            }

            const { x: buttonX, y: buttonY } = connResult;
            try {
              await new Promise((resolve, reject) => {
                exec(`adb -s ${deviceId} shell input tap ${buttonX} ${buttonY}`, (error, stdout) => {
                  if (error) {
                    console.error(`Error tapping "Add Title" button: ${error.message}`);
                    reject(error);
                  } else {
                    console.log(`Tapped "Add Title" button: ${stdout}`);
                    resolve();
                  }
                });
              });
            } catch (err) {
              console.error('Error tapping the connection-loss button:', err);
              processQueue();
              return;
            }

            if (connResult.lostConnection) {
              console.error("Connection lost detected.");
              await interaction.channel.send(`<@${userId}>, Connection lost. Please check and try again.`);
            } else {
              console.log("No connection loss detected. Please try again.");
            }

            processQueue(); // Continue with the next request
          });
        });

        return; // Exit since we are handling connection loss
      }

      const { x: buttonX, y: buttonY } = result;
      console.log(`Attempting to tap "Add Title" button at (${buttonX}, ${buttonY})`);

      await new Promise((resolve, reject) => {
        exec(`adb -s ${deviceId} shell input tap ${buttonX} ${buttonY}`, (error, stdout) => {
          if (error) {
            console.error(`Error tapping "Add Title" button: ${error.message}`);
            reject(error);
          } else {
            console.log(`Tapped "Add Title" button: ${stdout}`);
            resolve();
          }
        });
      });

      // Wait for 2 seconds before executing titleCommands
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Execute commands for the selected title
      if (titleCommands[title]) {
        await executeCommandWithDelay(titleCommands[title], 0);
      } else {
        console.error(`No commands found for title: ${title}`);
      }

      processQueue(); // Continue with the next request
    });
  } catch (error) {
    console.error("Error during ADB command execution:", error);
    processQueue(); // Continue with the next request
  }
}

