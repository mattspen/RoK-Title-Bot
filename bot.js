import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import { exec } from "child_process";
import TitleDuration from "./models/setTimer.js";
import LockedTitle from "./models/locktitle.js";
import { returnHome } from "./helpers/returnhome.js";
import { checkIfAtHome } from "./helpers/checkIfHome.js";

dotenv.config({
  path: process.env.ENV_FILE || ".env",
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

const client = new Client({
  intents: [
    Intents.Guilds,
    Intents.GuildMessages,
    Intents.MessageContent,
    Intents.GuildMessageReactions,
    Intents.GuildMembers,
  ],
});

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("Failed to login:", error);
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);

  console.log("Connected to the following servers:");
  client.guilds.cache.forEach((guild) => {
    console.log(
      `- ${guild.name} (ID: ${guild.id}, Members: ${guild.memberCount})`
    );
  });
});

const queues = {
  Duke: [],
  Justice: [],
  Architect: [],
  Scientist: [],
};

let isProcessing = {
  Duke: false,
  Justice: false,
  Architect: false,
  Scientist: false,
};

// Initialize the ADB running state for each title
let isAdbRunning = {
  Duke: false,
  Justice: false,
  Architect: false,
  Scientist: false,
};

// Timer duration for each title (in seconds)
const titleDurations = {
  Duke: 200,
  Justice: 300,
  Architect: 300,
  Scientist: 200,
};

let timers = {};
const lastUserRequest = {};

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.channel.id !== process.env.DISCORD_CHANNEL_ID) return;

  const { commandName } = interaction;

  try {
    if (commandName === "title") {
      const userId =
        interaction.options.getUser("user")?.id || interaction.user.id;
      const title = interaction.options.getString("title");

      await interaction.reply("Processing your title request...");

      // Check if the user has already requested the same title
      if (lastUserRequest[userId] === title) {
        await interaction.followUp(
          `<@${userId}>, you've already requested the title "${title}". Please wait until it's processed or choose a different title.`
        );
        return;
      }

      const user = await User.findOne({ userId });
      if (
        user &&
        user.username &&
        user.kingdom &&
        user.x != null &&
        user.y != null
      ) {
        const userKingdom = user.kingdom;

        const lockedTitle = await LockedTitle.findOne({
          title,
          kingdom: user.kingdom,
        });

        if (lockedTitle && lockedTitle.isLocked) {
          await interaction.followUp(
            `The title "${title}" is currently locked for your kingdom. Please choose a different title.`
          );
          return;
        }

        const request = {
          interaction,
          userId,
          title,
          kingdom: userKingdom,
          x: user.x,
          y: user.y,
        };

        // Add request to the queue for the title
        queues[title].push(request);
        console.log(`Queue length for ${title}: ${queues[title].length}`);

        // Get the user's position in the queue
        const queuePosition = queues[title].length;

        // Store the last title request for the user
        lastUserRequest[userId] = title;

        // Process the queue if not already processing
        if (!isProcessing[title]) {
          processQueue(title);
        }

        // Inform the user of their position in the queue if it's greater than 1
        if (queuePosition > 1) {
          await interaction.followUp(
            `<@${userId}>, Your title request has been added to the queue for ${title}! You are number ${queuePosition} in line.`
          );
        } else {
          await interaction.followUp(
            `<@${userId}>, Your title request is being processed immediately.`
          );
        }
      } else {
        await interaction.followUp(
          "You haven't registered your username and coordinates. Please use `/register [your_username] [x] [y]`."
        );
      }
    } else if (commandName === "titles") {
      const availableTitles = Object.keys(queues);
      await interaction.reply(
        `Available titles: ${availableTitles.join(", ")}`
      );
    } else if (commandName === "me") {
      const userId = interaction.user.id;

      const user = await User.findOne({ userId });
      if (user) {
        await interaction.reply(
          `Your registered username is: ${user.username} and your coordinates are: (${user.x}, ${user.y})`
        );
      } else {
        await interaction.reply(
          "You don't have a registered username. Please use `/register [your_username]`."
        );
      }
    } else if (commandName === "register") {
      const username = interaction.options.getString("username");
      const kingdom = interaction.options.getInteger("kingdom");
      const x = interaction.options.getInteger("x");
      const y = interaction.options.getInteger("y");
      const userId = interaction.user.id;

      const user = await User.findOne({ userId });

      if (user) {
        user.username = username;
        user.kingdom = kingdom;
        user.x = x;
        user.y = y;
        await user.save();
        await interaction.reply(
          `Your details have been updated: Username: "${username}", Kingdom: "${kingdom}", Coordinates: (${x}, ${y})!`
        );
      } else {
        const newUser = new User({ userId, username, kingdom, x, y });
        await newUser.save();
        await interaction.reply(
          `Your details have been registered: Username: "${username}", Kingdom: "${kingdom}", Coordinates: (${x}, ${y})!`
        );
      }
    } else if (commandName === "settimer") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = interaction.user.id;

      // Check if the user is a superuser
      if (!superUserIds.includes(userId)) {
        await interaction.reply(
          "You do not have permission to use this command."
        );
        return;
      }

      const title = interaction.options.getString("title").trim();
      const duration = interaction.options.getInteger("duration");
      const kingdom = interaction.options.getInteger("kingdom"); // Keep kingdom as integer

      // Validate kingdom format (4-digit number)
      if (!/^\d{4}$/.test(kingdom.toString())) {
        await interaction.reply("Kingdom must be a 4-digit number.");
        return;
      }

      // Check for a valid title
      const validTitles = ["Justice", "Duke", "Architect", "Scientist"];
      if (!validTitles.includes(title)) {
        await interaction.reply("Invalid title specified.");
        return;
      }

      try {
        // Attempt to update or insert the timer for the specified title and kingdom
        const result = await TitleDuration.updateOne(
          { title: title, kingdom: kingdom }, // Search criteria
          { duration: duration }, // Update to perform
          { upsert: true } // Create a new document if none matches
        );

        // Provide feedback based on the outcome
        if (result.upsertedCount > 0) {
          await interaction.reply(
            `Timer for ${title} has been set to ${duration} seconds in kingdom ${kingdom}.`
          );
        } else {
          await interaction.reply(
            `Timer for ${title} has been updated to ${duration} seconds in kingdom ${kingdom}.`
          );
        }
      } catch (error) {
        console.error(
          "An unexpected error occurred while updating the timer:",
          error
        );

        // Handle duplicate key errors explicitly
        if (error.code === 11000) {
          await interaction.reply(
            "Duplicate entry detected. Please check if the title already exists for the specified kingdom."
          );
        } else {
          await interaction.reply(
            "An unexpected error occurred while setting the timer."
          );
        }
      }
    } else if (commandName === "locktitle") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = interaction.user.id;

      // Check if the user is a superuser
      if (!superUserIds.includes(userId)) {
        await interaction.reply(
          "You do not have permission to use this command."
        );
        return;
      }
      const title = interaction.options.getString("title");

      await interaction.reply("Processing your lock title request...");

      const user = await User.findOne({ userId: interaction.user.id });
      if (user && user.kingdom) {
        const kingdom = process.env.KINGDOM;

        // Lock the title for the user's kingdom
        const lockedTitle = await LockedTitle.findOneAndUpdate(
          { title, kingdom },
          { isLocked: true }, // Lock the title
          { upsert: true, new: true }
        );

        if (lockedTitle) {
          await interaction.followUp(
            `Title "${title}" has been locked for kingdom ${kingdom}.`
          );
        } else {
          await interaction.followUp("There was an error locking the title.");
        }
      } else {
        await interaction.followUp(
          "You haven't registered your username and kingdom. Please use `/register [your_username] [x] [y]`."
        );
      }
    } else if (commandName === "unlocktitle") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = interaction.user.id;

      // Check if the user is a superuser
      if (!superUserIds.includes(userId)) {
        await interaction.reply(
          "You do not have permission to use this command."
        );
        return;
      }
      const title = interaction.options.getString("title");

      await interaction.reply("Processing your unlock title request...");

      const user = await User.findOne({ userId: interaction.user.id });
      if (user && user.kingdom) {
        const kingdom = process.env.KINGDOM;

        // Unlock the title for the user's kingdom
        const lockedTitle = await LockedTitle.findOneAndUpdate(
          { title, kingdom },
          { isLocked: false }, // Unlock the title
          { new: true }
        );

        if (lockedTitle) {
          await interaction.followUp(
            `Title "${title}" has been unlocked for kingdom ${kingdom}.`
          );
        } else {
          await interaction.followUp(
            `No locked title found for "${title}" in kingdom ${kingdom}.`
          );
        }
      } else {
        await interaction.followUp(
          "You haven't registered your username and kingdom. Please use `/register [your_username] [x] [y]`."
        );
      }
    }
  } catch (error) {
    if (error.message === "Title button not found in the ADB command.") {
      await interaction.followUp(
        "I could not find your city. Please make sure your coordinates are correct and try again."
      );
    } else {
      console.error("An unexpected error occurred:", error);
      await interaction.followUp(
        "An unexpected error occurred. Please try again later."
      );
    }
    // Improved error handling
    if (error.code === "ECONNRESET") {
      console.error("Network error: Connection reset. Retrying...");
      await interaction.reply("A network error occurred. Please try again.");
    } else {
      console.error("An unexpected error occurred:", error);
      await interaction.reply(
        "An unexpected error occurred. Please try again later."
      );
    }
  }
});

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function runRandomAdbCommands(deviceId) {
  const centerX = 960; // Center X for 1080p
  const centerY = 540; // Center Y for 1080p
  const offsetRange = 100; // Range for random offset around the center

  // Generate random coordinates around the center
  const x = getRandomInt(centerX - offsetRange, centerX + offsetRange);
  const y = getRandomInt(centerY - offsetRange, centerY + offsetRange);

  // Randomly choose between tap, double tap, or swipe
  const action = getRandomInt(1, 3);

  if (action === 1) {
    // Tap action
    exec(`adb -s ${deviceId} shell input tap ${x} ${y}`, (error) => {
      if (error) {
        console.error(`Error tapping on ${deviceId}: ${error.message}`);
      }
    });
  } else if (action === 2) {
    // Double tap action
    exec(`adb -s ${deviceId} shell input tap ${x} ${y}`, (error) => {
      if (error) {
        console.error(`Error double-tapping on ${deviceId}: ${error.message}`);
      } else {
        // Second tap after a short delay for double tap effect
        setTimeout(() => {
          exec(`adb -s ${deviceId} shell input tap ${x} ${y}`, (error) => {
            if (error) {
              console.error(
                `Error double-tapping on ${deviceId}: ${error.message}`
              );
            }
          });
        }, 100); // 100 ms delay
      }
    });
  } else {
    // Swipe action
    const x2 = getRandomInt(centerX - offsetRange, centerX + offsetRange);
    const y2 = getRandomInt(centerY - offsetRange, centerY + offsetRange);
    exec(
      `adb -s ${deviceId} shell input swipe ${x} ${y} ${x2} ${y2}`,
      (error) => {
        if (error) {
          console.error(`Error swiping on ${deviceId}: ${error.message}`);
        } else {
          // Return to the original position after the swipe
          setTimeout(() => {
            exec(`adb -s ${deviceId} shell input tap ${x} ${y}`, (error) => {
              if (error) {
                console.error(
                  `Error returning to (${x}, ${y}) on ${deviceId}: ${error.message}`
                );
              }
            });
          }, 500); // Delay before returning (adjust if needed)
        }
      }
    );
  }
}

function runCheckState() {
  const deviceId = process.env.EMULATOR_DEVICE_ID;

  if (!deviceId) {
    console.error("No device ID found in environment variables.");
    return;
  }

  // Take a screenshot before running the check_state.py script
  exec(
    `adb -s ${deviceId} exec-out screencap -p > ./temp/current_state_${deviceId}.png`,
    (error) => {
      if (error) {
        console.error(
          `Error taking screenshot on ${deviceId}: ${error.message}`
        );
        return;
      }

      // Run random ADB commands
      runRandomAdbCommands(deviceId);

      // Run the check_state.py script after taking the screenshot
      exec(
        `python check_state.py ./temp/current_state_${deviceId}.png ${deviceId}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error on ${deviceId}: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`Stderr on ${deviceId}: ${stderr}`);
            return;
          }
        }
      );
    }
  );
}

setInterval(() => {
  // Check if any ADB function is currently running
  const isAnyAdbRunning = Object.values(isAdbRunning).some((kingdom) =>
    Object.values(kingdom).some((isRunning) => isRunning)
  );

  if (!isAnyAdbRunning) {
    runCheckState();
  } else {
    console.log("ADB functions are currently running. Skipping runCheckState.");
  }
}, 120000);

// Track active timers for each title
async function processQueue(title) {
  if (isProcessing[title] || queues[title].length === 0) {
    return; // Exit if already processing or queue is empty
  }

  if (isAdbRunning[title]) {
    setTimeout(() => processQueue(title), 25000); // Retry after 25 seconds
    return;
  }

  isProcessing[title] = true;
  const request = queues[title].shift();
  const { message, kingdom, interaction, x, y, userId } = request;

  try {
    isAdbRunning[title] = true;

    console.log(`Processing ${title} for user ${userId}`);

    const adbResult = await runAdbCommand(
      userId,
      x,
      y,
      title,
      kingdom,
      interaction,
      message
    );

    if (!adbResult.success) {
      throw new Error("Title button not found in the ADB command.");
    }

    let remainingTime = titleDurations[title];

    const deviceId = process.env.EMULATOR_DEVICE_ID;
    const screenshotPath = `./temp/screenshot_${title.toLowerCase()}_${deviceId}.png`;

    const notificationMessage = await interaction.channel.send({
      content: `<@${userId}>, You're up for the title "${title}"! React with ✅ when done, you have ${remainingTime} seconds.`,
      files: [screenshotPath],
    });

    await notificationMessage.react("✅");

    const filter = (reaction, user) =>
      reaction.emoji.name === "✅" && user.id === userId;
    const collector = notificationMessage.createReactionCollector({
      filter,
      time: 300 * 1000,
    });

    const customDuration = await fetchCustomDurationFromDatabase(
      title,
      kingdom
    );
    if (customDuration) {
      remainingTime = customDuration;
    }

    if (timers[title]) {
      clearInterval(timers[title]);
      console.log(
        `Existing timer for ${title} cleared before starting a new one.`
      );
    }

    collector.on("collect", () => {
      console.log(
        `✅ Reaction collected for user ${userId}, stopping timer for ${title}.`
      );
      remainingTime = 0;
      lastUserRequest[userId] = null;
      clearInterval(timers[title]);
      delete timers[title];
      collector.stop();
    });

    collector.on("end", (collected) => {
      clearInterval(timers[title]);
      delete timers[title];

      const responseMessage =
        collected.size === 0
          ? `<@${userId}>, Time's up! ⏰`
          : `Done reaction collected. Moving to the next request.`;

      if (interaction) {
        interaction.channel.send(responseMessage);
      }

      setTimeout(() => {
        lastUserRequest[userId] = null;
        isProcessing[title] = false;
        isAdbRunning[title] = false;
        processQueue(title);
      }, 10000);
    });

    timers[title] = startTimer(collector, remainingTime, title, userId);
  } catch (error) {
    const deviceId = process.env.EMULATOR_DEVICE_ID;
    const screenshotPath = `./temp/screenshot_city_not_found_${deviceId}.png`;
    console.log(error);
    let errorMessage = `<@${userId}>, ran into an error while processing your request for ${title}.`;

    if (error.message === "Title button not found in the ADB command.") {
      // If a screenshot is being handled elsewhere, we can simply alert the user
      errorMessage = `<@${userId}>, please check your city coordinates. If you can see your city, please let @popPIN know.`;
      if (interaction) {
        await interaction.channel.send({
          content: errorMessage,
          files: [screenshotPath],
        });
      }
    } else {
      if (interaction) {
        await interaction.channel.send({ content: errorMessage });
      }
    }

    isProcessing[title] = false;
    isAdbRunning[title] = false;
    setTimeout(() => processQueue(title), 10000);
  }
}

function startTimer(collector, remainingTime, title, userId) {
  let timer = setInterval(() => {
    remainingTime -= 1; // Decrement remaining time
    if (remainingTime <= 0) {
      clearInterval(timer); // Clear the timer when time runs out
      if (collector && !collector.ended) {
        collector.stop(); // Stop the collector if not ended
      }
    } else {
      // Log the remaining time to the console every 30 seconds
      if (remainingTime % 30 === 0) {
        console.log(
          `User ${userId} has ${remainingTime} seconds remaining for the title "${title}".`
        );
      }
    }
  }, 1000); // Decrement every second
  return timer;
}

async function fetchCustomDurationFromDatabase(title, kingdom) {
  try {
    // Use the already defined model and filter by title and kingdom
    const result = await TitleDuration.findOne({ title, kingdom });

    if (result) {
      return result.duration;
    } else {
      return null; // Return null if no custom duration is found
    }
  } catch (error) {
    console.error(
      `Error fetching custom duration for ${title} in kingdom ${kingdom}:`,
      error
    );
    return null; // Return null in case of an error
  }
}

function execAsync(command, retries = 3) {
  return new Promise((resolve, reject) => {
    const attempt = (retryCount) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          if (error.code === "ECONNRESET" && retryCount > 0) {
            console.warn(
              `ECONNRESET error occurred. Retrying... (${
                retries - retryCount + 1
              }/${retries})`
            );
            return attempt(retryCount - 1);
          }
          return reject(error);
        }
        if (stderr) {
          console.error(`stderr: ${stderr}`);
        }
        resolve(stdout);
      });
    };
    attempt(retries);
  });
}

async function runAdbCommand(
  userId,
  x,
  y,
  title,
  kingdom,
  interaction,
  message
) {
  const deviceId = process.env.EMULATOR_DEVICE_ID;

  // Run the check_state.py script before doing anything else
  const stateCheckResult = await new Promise((resolve) => {
    // Take a screenshot before running the check_state.py script
    exec(
      `adb -s ${deviceId} exec-out screencap -p > ./temp/current_state_${deviceId}.png`,
      (error) => {
        if (error) {
          console.error(
            `Error taking screenshot on ${deviceId}: ${error.message}`
          );
          resolve({ success: false, error: "Screenshot error" });
          return;
        }

        // Run the check_state.py script after taking the screenshot
        exec(
          `python check_state.py ./temp/current_state_${deviceId}.png ${deviceId}`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error running check_state.py: ${error.message}`);
              resolve({
                success: false,
                error: "State check script execution error",
              });
              return;
            }
            if (stderr) {
              console.error(`Stderr from check_state.py: ${stderr}`);
              resolve({ success: false, error: "State check script stderr" });
              return;
            }
            resolve({ success: true });
          }
        );
      }
    );
  });

  if (!stateCheckResult.success) {
    return stateCheckResult; // Early return if state check failed
  }

  if (!isAdbRunning[kingdom]?.[title]) {
    const isHome = await checkIfAtHome(deviceId, interaction, message, userId);
    if (!isHome) {
      console.log("Not at home. Returning home before processing the request.");
      await returnHome(deviceId);
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Delay for animation
    }
  }

  console.log(
    `Running ADB command on ${deviceId} at coordinates (${x}, ${y}) for title: ${title}`
  );

  const titleCommands = {
    Justice: [
      `adb -s ${deviceId} shell input tap 440 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_justice_${deviceId}.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    Duke: [
      `adb -s ${deviceId} shell input tap 784 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_duke_${deviceId}.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    Architect: [
      `adb -s ${deviceId} shell input tap 1125 591`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_architect_${deviceId}.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    Scientist: [
      `adb -s ${deviceId} shell input tap 1472 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_scientist_${deviceId}.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
  };

  const cityCoordinates = [
    { x: 968, y: 548 },
    { x: 882, y: 576 },
    { x: 970, y: 560 },
  ];

  async function tapCityAndCheck() {
    for (let attempt = 0; attempt < cityCoordinates.length; attempt++) {
      const { x: cityX, y: cityY } = cityCoordinates[attempt];
      const cityTapCommand = `adb -s ${deviceId} shell input tap ${cityX} ${cityY}`;

      try {
        // Execute tap command
        await execAsync(cityTapCommand);
        console.log(`Tapped city at coordinates (${cityX}, ${cityY}).`);

        await new Promise((resolve) => setTimeout(resolve, 1000)); // Short delay to allow the tap to register

        // Take a screenshot for analysis with a unique name
        const screenshotFilename = `./temp/screenshot_${attempt}_${deviceId}.png`;
        const screenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${screenshotFilename}`;
        await execAsync(screenshotCommand);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const titleCheckResult = await new Promise((resolve) => {
          exec(
            `python ./check_title.py ${screenshotFilename} ${deviceId}`,
            (error, stdout) => {
              if (error) {
                console.error(
                  `Error executing Python script: ${error.message}`
                );
                resolve({ success: false });
                return;
              }

              const lines = stdout
                .split("\n")
                .filter((line) => line.trim() !== "");
              let jsonLine = lines[lines.length - 1];

              let result;
              try {
                result = JSON.parse(jsonLine.trim());
              } catch (err) {
                console.error("Error parsing JSON:", err);
                resolve({ success: false });
                return;
              }

              if (
                !result.coordinates ||
                typeof result.coordinates.x !== "number" ||
                typeof result.coordinates.y !== "number"
              ) {
                console.error("Invalid response structure:", result);
                resolve({ success: false });
                return;
              }

              setTimeout(() => {
                resolve({ success: true, coordinates: result.coordinates });
              }, 500); // 500 ms delay
            }
          );
        });

        // Check if the button was found
        if (titleCheckResult.success) {
          console.log("City button found!");
          return { success: true, coordinates: titleCheckResult.coordinates }; // Exit if found
        } else {
          console.log("City button not found, trying next coordinate.");
        }
      } catch (error) {
        console.error(
          `Error tapping city or taking screenshot: ${error.message}`
        );
      }
    }

    console.log("City button not found after all attempts.");
    const screenshotFilename = `./temp/screenshot_city_not_found_${deviceId}.png`;
    const screenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${screenshotFilename}`;
    await execAsync(screenshotCommand);
    return { success: false }; // If all taps fail
  }

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
  ];

  async function executeCommandWithDelay(commands, index) {
    if (index >= commands.length) return Promise.resolve(); // Resolve when all commands are done

    return new Promise((resolve, reject) => {
      exec(commands[index], (error, stdout) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }

        // Add a delay before executing the next command
        setTimeout(() => {
          executeCommandWithDelay(commands, index + 1)
            .then(resolve)
            .catch(reject); // Resolve after all commands
        }, 1000); // 1 second delay
      });
    });
  }

  try {
    await executeCommandWithDelay(initialCommands, 0);

    const titleCheckResult = await tapCityAndCheck();

    // Check the result of the title check
    if (!titleCheckResult.success) {
      await returnHome(deviceId);
      return titleCheckResult; // Early return if title check failed
    }

    // Set a delay of 1 second before executing the title-specific commands
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Execute the title-specific commands after the title check with a delay
    await executeCommandWithDelay(titleCommands[title], 0);

    return { success: true, coordinates: titleCheckResult.coordinates }; // Return the found coordinates
  } catch (error) {
    console.error(`Error processing commands for ${userId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}




