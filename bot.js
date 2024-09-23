import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import fs from "fs";
import mongoose from "mongoose";
import User from "./models/User.js";
import { REST, Routes } from "discord.js";

async function resetCommands(clientId, guildId) {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    // Delete all commands for the specified guild
    const existingCommands = await rest.get(Routes.applicationGuildCommands(clientId, guildId));
    const deletePromises = existingCommands.map(command =>
      rest.delete(Routes.applicationGuildCommand(clientId, guildId, command.id))
    );

    await Promise.all(deletePromises);
    console.log(`Deleted all commands for guild: ${guildId}`);

    // Now register the new commands
    await registerCommands(clientId, guildId);
  } catch (error) {
    console.error("Error resetting commands:", error);
  }
}

// Add this function to register commands globally or per server
async function registerCommands(clientId, guildId = null) {
  const commands = [
    // Define your commands here...
  ];

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log("Started refreshing application (/) commands.");

    if (guildId) {
      // For a specific guild
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
    } else {
      // For global use
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
    }

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
}

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

    // Reset commands for each guild the bot is connected to
    resetCommands(client.user.id, guild.id);
  });
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

    await interaction.reply("Processing your title request...");

    User.findOne({ userId }).then(user => {
      if (user) {
        const request = { interaction, userId, title, kingdom, x, y };
        queue.push(request);
        console.log(queue.length);

        if (!isProcessing) {
          processQueue();
        }
        if (queue.length > 1) {
          interaction.followUp(`<@${userId}>, Your title request has been added to the queue!`);
        }
      } else {
        interaction.followUp("You don't have a registered username. Please provide one using /register [your_username].");
      }
    }).catch(error => {
      console.error("Error fetching user:", error);
      interaction.followUp("An error occurred while fetching your username. Please try again later.");
    });

  } else if (commandName === "titles") {
    const availableTitles = ["Duke", "Justice", "Architect", "Scientist"];
    await interaction.reply(`Available titles: ${availableTitles.join(", ")}`);

  } else if (commandName === "me") {
    const userId = interaction.user.id;

    User.findOne({ userId }).then(user => {
      if (user) {
        interaction.reply(`Your registered username is: ${user.username}`);
      } else {
        interaction.reply("You don't have a registered username. Please provide one using /register [your_username].");
      }
    }).catch(error => {
      console.error("Error fetching user:", error);
      interaction.reply("An error occurred while fetching your username. Please try again later.");
    });

  } else if (commandName === "register") {
    const username = interaction.options.getString("username");
    const userId = interaction.user.id;

    User.findOne({ userId }).then(user => {
      if (user) {
        user.username = username;
        return user.save().then(() => interaction.reply(`Your username has been updated to "${username}"!`));
      } else {
        const newUser = new User({ userId, username });
        return newUser.save().then(() => interaction.reply(`Your username "${username}" has been registered!`));
      }
    }).catch(error => {
      console.error("Error registering user:", error);
      interaction.reply("An error occurred while registering your username. Please try again later.");
    });
  }
});

let timer;
let remainingTime = 120;

async function processQueue() {
  if (isProcessing || queue.length === 0) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const request = queue.shift();
  const { interaction, x, y, title, userId } = request;

  try {
    console.log(`Processing title for user ${userId}`);
    await runAdbCommand(x, y, title);

    const message = await interaction.channel.send(`<@${userId}>, You're up! React with ✅ when done.`);
    await message.react('✅');

    const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === userId;
    const collector = message.createReactionCollector({ filter, time: 120 * 1000 });

    remainingTime = 120;

    collector.on('collect', () => {
      remainingTime = 0;
      clearInterval(timer);
      collector.stop();
    });

    collector.on('end', collected => {
      clearInterval(timer);
      interaction.channel.send(collected.size === 0 ? `<@${userId}>, Times up!` : `Done reaction collected. Moving to the next request.`);
      isProcessing = false;
      processQueue();
    });

    startTimer(collector);

  } catch (error) {
    console.error(`Error processing request for ${userId}: ${error.message}`);
    isProcessing = false;
    processQueue();
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

async function runAdbCommand(x, y, title) {
  console.log(`Running ADB command at coordinates (${x}, ${y}) for title: ${title}`);

  const initialCommands = [
    `adb -s emulator-5554 shell input tap 89 978`,
    `adb -s emulator-5554 shell input tap 660 28`,
    `adb -s emulator-5554 shell input tap 962 215`,
    `adb -s emulator-5554 shell input text "${x}"`,
    `adb -s emulator-5554 shell input tap 1169 215`,
    `adb -s emulator-5554 shell input tap 1169 215`,
    `adb -s emulator-5554 shell input text "${y}"`,
    `adb -s emulator-5554 shell input tap 1331 212`,
    `adb -s emulator-5554 shell input tap 1331 212`,
    `adb -s emulator-5554 shell input tap 956 562`,
    `adb exec-out screencap -p > ./screenshot.png`,
  ];

  const titleCommands = {
    "Justice": [
      `adb -s emulator-5554 shell input tap 440 592`,
      `adb -s emulator-5554 shell input tap 954 958`,
      `adb -s emulator-5554 shell input tap 89 978`,
      `adb exec-out screencap -p > ./screenshot_justice.png`
    ],
    "Duke": [
      `adb -s emulator-5554 shell input tap 784 592`,
      `adb -s emulator-5554 shell input tap 954 958`,
      `adb -s emulator-5554 shell input tap 89 978`,
      `adb exec-out screencap -p > ./screenshot_duke.png`
    ],
    "Architect": [
      `adb -s emulator-5554 shell input tap 1125 591`,
      `adb -s emulator-5554 shell input tap 954 958`,
      `adb -s emulator-5554 shell input tap 89 978`,
      `adb exec-out screencap -p > ./screenshot_architect.png`
    ],
    "Scientist": [
      `adb -s emulator-5554 shell input tap 1472 592`,
      `adb -s emulator-5554 shell input tap 954 958`,
      `adb -s emulator-5554 shell input tap 89 978`,
      `adb exec-out screencap -p > ./screenshot_scientist.png`
    ]
  };

  async function executeCommandWithDelay(commands, index) {
    if (index >= commands.length) {
      return;
    }

    console.log(`Executing command: ${commands[index]}`); // Log the command being executed

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

    // After taking the screenshot, call the Python script
    exec('python ./cv.py', async (error, stdout, stderr) => {
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
        processQueue(); // Continue with the next request
        return;
      }

      if (result.error) {
        console.log(result.error);
        processQueue(); // Continue with the next request
        return;
      }

      const { x: buttonX, y: buttonY } = result;
      console.log(`Attempting to tap "Add Title" button at (${buttonX}, ${buttonY})`);

      await new Promise((resolve, reject) => {
        exec(`adb -s emulator-5554 shell input tap ${buttonX} ${buttonY}`, (error, stdout) => {
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

      // Check if titleCommands for the title exist and execute them
      if (titleCommands[title]) {
        console.log(`Executing commands for title: ${title}`);
        await executeCommandWithDelay(titleCommands[title], 0);
      } else {
        console.error(`No commands found for title: ${title}`);
      }

      processQueue(); // Continue with the next request
    });
  } catch (error) {
    console.error("Error during initial command execution:", error);
    processQueue(); // Continue with the next request
  }
}
