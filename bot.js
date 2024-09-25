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

// Queue and processing state for each kingdom and title
const queues = {
  3311: {
    Duke: [],
    Justice: [],
    Architect: [],
    Scientist: []
  },
  3299: {
    Duke: [],
    Justice: [],
    Architect: [],
    Scientist: []
  }
};

let isProcessing = {
  3311: {
    Duke: false,
    Justice: false,
    Architect: false,
    Scientist: false
  },
  3299: {
    Duke: false,
    Justice: false,
    Architect: false,
    Scientist: false
  }
};

// Command handling remains the same
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

        // Add request to the title-specific queue for the user's kingdom
        queues[user.kingdom][title].push(request);
        console.log(`Queue length for ${title} in kingdom ${user.kingdom}: ${queues[user.kingdom][title].length}`);

        // If the title is not currently being processed, start processing the queue
        if (!isProcessing[user.kingdom][title]) {
          processQueue(user.kingdom, title);
        }

        if (queues[user.kingdom][title].length > 1) {
          await interaction.followUp(`<@${userId}>, Your title request has been added to the queue for ${title} in kingdom ${user.kingdom}!`);
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

// Global flag to ensure no two ADB commands run simultaneously for each kingdom and title
let isAdbRunning = {};

// Initialize possible titles
const titles = ["Duke", "Justice", "Architect", "Scientist"];

// Timer duration for each title (in seconds)
const titleDurations = {
  Duke: 200,
  Justice: 300,
  Architect: 300,
  Scientist: 200
};

// Define the remainingTime variable inside processQueue and pass it to startTimer
async function processQueue(kingdom, title) {
  // Ensure the necessary initializations
  if (!queues[kingdom]) {
    queues[kingdom] = {};
    titles.forEach(t => queues[kingdom][t] = []);
  }

  if (!isProcessing[kingdom]) {
    isProcessing[kingdom] = {};
  }

  if (isProcessing[kingdom][title] === undefined) {
    isProcessing[kingdom][title] = false;
  }

  if (!queues[kingdom][title]) {
    queues[kingdom][title] = [];
  }

  // Check if processing is already happening or the queue is empty
  if (isProcessing[kingdom][title] || queues[kingdom][title].length === 0) {
    isProcessing[kingdom][title] = false;
    return;
  }

  // Check if ADB is already running for this kingdom and title
  if (isAdbRunning[kingdom]?.[title]) {
    setTimeout(() => processQueue(kingdom, title), 1000); // Retry after 1 second
    return;
  }

  isProcessing[kingdom][title] = true;
  const request = queues[kingdom][title].shift();
  const { interaction, x, y, userId } = request;

  let timer; // Declare the timer variable here

  try {
    isAdbRunning[kingdom] = isAdbRunning[kingdom] || {};
    isAdbRunning[kingdom][title] = true;

    console.log(`Processing ${title} for user ${userId} in kingdom ${kingdom}`);

    const adbResult = await runAdbCommand(userId, x, y, title, kingdom, interaction); // Run ADB command

    if (!adbResult.success) {
      throw new Error('Title button not found in the ADB command.');
    }

    const message = await interaction.channel.send(`<@${userId}>, You're up for the title "${title}"! React with ✅ when done.`);
    await message.react('✅');

    const filter = (reaction, user) => reaction.emoji.name === '✅' && user.id === userId;
    const collector = message.createReactionCollector({ filter, time: 300 * 1000 });

    // Use the predefined duration for the title
    let remainingTime = titleDurations[title];

    collector.on('collect', () => {
      remainingTime = 0; // Set remaining time to 0 when collected
      clearInterval(timer); // Clear the timer
      collector.stop(); // Stop the collector
    });

    collector.on('end', collected => {
      clearInterval(timer); // Stop the timer
      interaction.channel.send(collected.size === 0 ? `<@${userId}>, Time's up!` : `Done reaction collected. Moving to the next request.`);

      // Set a timeout of 10 seconds before setting ADB false
      setTimeout(() => {
        isProcessing[kingdom][title] = false;
        isAdbRunning[kingdom][title] = false;
        processQueue(kingdom, title);
      }, 10000); // 10 second delay
    });

    timer = startTimer(collector, remainingTime); // Start the timer with the duration for the title

  } catch (error) {
    console.error(`Error processing ${title} request for ${userId} in kingdom ${kingdom}: ${error.message}`);

    // If the title button is not found or any other error happens, clear processing
    isProcessing[kingdom][title] = false; // Ensure we clear processing state
    isAdbRunning[kingdom][title] = false; // Ensure we clear ADB state
    setTimeout(() => processQueue(kingdom, title), 10000); // Retry the queue after a delay
  }
}

async function startTimer(collector, remainingTime) {
  let timer = setInterval(() => {
    remainingTime -= 1;
    if (remainingTime <= 0) {
      clearInterval(timer); // Clear the timer when time runs out
      if (collector && !collector.ended) {
        collector.stop(); // Stop the collector if not ended
      }
    }
  }, 1000); // Decrement every second
  return timer;
}

// Function to find the scout button
async function findScoutButton() {
  return new Promise((resolve) => {
    exec('python ./check_scout.py', (error, stdout) => {
      if (error) {
        console.error(`Error executing find scout button script: ${error.message}`);
        return resolve({ success: false, error: 'Find scout button script error' });
      }

      console.log("Scout button script output:", stdout);

      let result;
      try {
        result = JSON.parse(stdout);
      } catch (err) {
        console.error('Error parsing scout button output:', err);
        return resolve({ success: false, error: 'Scout button JSON parse error' });
      }

      resolve(result);
    });
  });
}


async function runAdbCommand(userId, x, y, title, kingdom, interaction) {
  let deviceId;

  if (kingdom === 3311) {
    deviceId = 'emulator-5554';
  } else if (kingdom === 3299) {
    deviceId = 'emulator-5584';
  } else {
    console.error("Invalid kingdom. Please provide a valid kingdom.");
    return { success: false, error: "Invalid kingdom." };
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
    ],
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

    // Call findScoutButton and wait for its result
    const scoutResult = await findScoutButton();
    console.log("Scout button result:", scoutResult);

    if (scoutResult.success === false) {
      console.error(scoutResult.error);
      return scoutResult;
    }

    const scoutButtonX = scoutResult.x; // Assuming the output contains x coordinate
    const scoutButtonY = scoutResult.y; // Assuming the output contains y coordinate
    const offsetY = 50; // Offset to click above the scout button (adjust as needed)

    // Calculate new click coordinates
    const clickX = scoutButtonX;
    const clickY = scoutButtonY - offsetY; // Click above the scout button

    console.log(`Clicking at (${clickX}, ${clickY}) above the scout button`);

    // Perform the click action using the calculated coordinates
    await new Promise((resolve, reject) => {
      exec(`adb -s ${deviceId} shell input tap ${clickX} ${clickY}`, (error, stdout) => {
        if (error) {
          console.error(`Error clicking at (${clickX}, ${clickY}): ${error.message}`);
          reject(error);
        } else {
          console.log(`Clicked at (${clickX}, ${clickY}): ${stdout}`);
          resolve();
        }
      });
    });

    // Execute the title check
    return new Promise((resolve) => {
      exec('python ./check_title.py', async (error, stdout) => {
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          resolve({ success: false, error: 'Python script error' });
          return;
        }

        console.log("Python script output:", stdout); // Log raw output

        let result;
        try {
          result = JSON.parse(stdout); // Parse the output
        } catch (err) {
          console.error('Error parsing Python script output:', err);
          resolve({ success: false, error: 'JSON parse error' });
          return;
        }

        if (result.error) {
          console.log("Hmm, looks like there is an issue. Checking for connection loss...");
          await interaction.channel.send({
            content: `<@${userId}>, Title button not found. Checking for connection loss...`,
            files: ['./screenshot.png']
          });

          // Check for connection loss
          exec(`adb -s ${deviceId} exec-out screencap -p > ./screenshot_connection.png`, async (error) => {
            if (error) {
              console.error(`Error taking connection-loss screenshot: ${error.message}`);
              resolve({ success: false, error: 'Connection loss screenshot error' });
              return;
            }

            exec('python ./check_connection_loss.py', async (connError, connStdout) => {
              if (connError) {
                console.error(`Error executing connection loss check script: ${connError.message}`);
                resolve({ success: false, error: 'Connection loss check script error' });
                return;
              }

              let connResult;
              try {
                connResult = JSON.parse(connStdout); // Parse the output
              } catch (err) {
                console.error('Error parsing connection-loss script output:', err);
                resolve({ success: false, error: 'Connection loss JSON parse error' });
                return;
              }

              const { x: lossButtonX, y: lossButtonY } = connResult;
              try {
                await new Promise((resolve, reject) => {
                  exec(`adb -s ${deviceId} shell input tap ${lossButtonX} ${lossButtonY}`, (error, stdout) => {
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
                resolve({ success: false, error: 'Connection loss button tap error' });
                return;
              }

              if (connResult.lostConnection) {
                console.error("Connection lost detected.");
                await interaction.channel.send(`<@${userId}>, Connection lost. Please check and try again.`);
                resolve({ success: false, error: 'Connection lost' });
              } else {
                console.log("No connection loss detected. Please try again.");
                exec(`adb -s ${deviceId} shell input tap 89 978`, (error, stdout) => {
                  if (error) {
                    console.error(`Error returning home: ${error.message}`);
                  } else {
                    console.log(`Tapped "Add Title" button: ${stdout}`);
                  }
                });
                resolve({ success: false, error: 'Title button not found' });
              }
            });
          });

          return; // Exit since we are handling connection loss
        }

        const { x: buttonX, y: buttonY } = result;
        console.log(`Attempting to tap "Add Title" button at (${buttonX}, ${buttonY})`);

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
        } catch (error) {
          console.error('Error tapping the button:', error);
          resolve({ success: false, error: 'Error tapping button' });
          return;
        }

        // Execute title-specific commands
        const commandsToRun = titleCommands[title] || [];
        if (commandsToRun.length > 0) {
          await executeCommandWithDelay(commandsToRun, 0);
        }

        await interaction.channel.send({
          content: `<@${userId}>, Title added successfully!`,
          files: ['./screenshot.png']
        });

        resolve({ success: true });
      });
    });
  } catch (error) {
    console.error('Error executing ADB command:', error);
    return { success: false, error: 'ADB command execution error' };
  }
}

