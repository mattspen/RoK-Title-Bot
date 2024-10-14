import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import { exec } from "child_process";
import TitleDuration from "./models/setTimer.js";
import LockedTitle from "./models/locktitle.js";
import {
  isAdbRunning,
  isProcessing,
  lastUserRequest,
  queues,
  timers,
  titleDurations,
} from "./helpers/vars.js";
import { fetchCustomDurationFromDatabase } from "./helpers/fetchCustomDurationFromDatabase.js";
import { getRandomInt } from "./helpers/getRandomInt.js";
import TitleRequestLog from "./models/TitleRequestLog.js";

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

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== process.env.DISCORD_CHANNEL_ID) return;

  const content = message.content.trim();
  const args = content.split(/\s+/);

  try {
    if (
      args[0].toLowerCase() === "register" ||
      args[0].toLowerCase() === "/register"
    ) {
      if (args.length < 4) {
        await message.reply(
          "Please provide a username and coordinates in the format: `register <username> <x> <y>`."
        );
        return;
      }

      const username = args[1];
      const x = parseInt(args[2], 10);
      const y = parseInt(args[3], 10);

      if (isNaN(x) || isNaN(y)) {
        await message.reply(
          "Invalid coordinates. Please enter valid numbers for x and y."
        );
        return;
      }

      const userId = message.author.id;
      const kingdom = parseInt(process.env.KINGDOM, 10);

      const user = await User.findOne({ userId });

      if (user) {
        user.username = username;
        user.kingdom = kingdom;
        user.x = x;
        user.y = y;
        await user.save();
        await message.reply(
          `Your details have been updated: Username: "${username}", Kingdom: "${kingdom}", Coordinates: (${x}, ${y})!`
        );
      } else {
        const newUser = new User({ userId, username, kingdom, x, y });
        await newUser.save();
        await message.reply(
          `You have been registered: Username: "${username}", Kingdom: "${kingdom}", Coordinates: (${x}, ${y})!`
        );
      }
      return;
    }

    if (args[0].toLowerCase() === "registeruser") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply("You do not have permission to use this command.");
        return;
      }

      if (args.length !== 5) {
        await message.reply(
          "Invalid command format. Please use: `registeruser <discordid> <username> <x> <y>`."
        );
        return;
      }

      const targetUserId = args[1];
      const username = args[2];
      const x = parseInt(args[3], 10);
      const y = parseInt(args[4], 10);
      const kingdom = parseInt(process.env.KINGDOM, 10);

      if (isNaN(x) || isNaN(y)) {
        await message.reply(
          "Invalid coordinates. Please provide valid integers for x and y."
        );
        return;
      }

      const user = await User.findOne({ userId: targetUserId });

      if (user) {
        user.username = username;
        user.kingdom = kingdom;
        user.x = x;
        user.y = y;
        await user.save();
        await message.reply(
          `User with Discord ID ${targetUserId} has been updated: Username: "${username}", Kingdom: "${kingdom}", Coordinates: (${x}, ${y})!`
        );
      } else {
        const newUser = new User({
          userId: targetUserId,
          username,
          kingdom,
          x,
          y,
        });
        await newUser.save();
        await message.reply(
          `User with Discord ID ${targetUserId} has been registered: Username: "${username}", Kingdom: "${kingdom}", Coordinates: (${x}, ${y})!`
        );
      }
      return;
    }

    if (args[0].toLowerCase() === "logs") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply("You do not have permission to view the logs.");
        return;
      }

      const successCount = await TitleRequestLog.countDocuments({
        status: "successful",
      });
      const failureCount = await TitleRequestLog.countDocuments({
        status: "unsuccessful",
      });

      await message.reply(
        `Title Request Logs:\nSuccesses: ${successCount}\nFailures: ${failureCount}`
      );
      return;
    }

    if (args[0].toLowerCase() === "locktitle") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply("You do not have permission to use this command.");
        return;
      }

      if (args.length < 2) {
        await message.reply("Please provide a title to lock.");
        return;
      }

      const title = args[1];
      const kingdom = process.env.KINGDOM;

      const lockedTitle = await LockedTitle.findOneAndUpdate(
        { title, kingdom },
        { isLocked: true },
        { upsert: true, new: true }
      );

      if (lockedTitle) {
        await message.reply(
          `Title "${title}" has been locked for kingdom ${kingdom}.`
        );
      } else {
        await message.reply("There was an error locking the title.");
      }
      return;
    }

    if (args[0].toLowerCase() === "unlocktitle") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply("You do not have permission to use this command.");
        return;
      }

      if (args.length < 2) {
        await message.reply("Please provide a title to unlock.");
        return;
      }

      const title = args[1];
      const kingdom = process.env.KINGDOM;

      const lockedTitle = await LockedTitle.findOneAndUpdate(
        { title, kingdom },
        { isLocked: false },
        { new: true }
      );

      if (lockedTitle) {
        await message.reply(
          `Title "${title}" has been unlocked for kingdom ${kingdom}.`
        );
      } else {
        await message.reply(
          `No locked title found for "${title}" in kingdom ${kingdom}.`
        );
      }
      return;
    }

    if (args[0].toLowerCase() === "settimer") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply("You do not have permission to use this command.");
        return;
      }

      if (args.length < 3) {
        await message.reply(
          "Invalid command format. Please use: `settimer <title> <duration>`."
        );
        return;
      }

      const titleInput = args[1].trim().toLowerCase();
      const duration = parseInt(args[2], 10);
      const kingdom = parseInt(process.env.KINGDOM, 10);

      if (!/^\d{4}$/.test(kingdom.toString())) {
        await message.reply("Kingdom must be a 4-digit number.");
        return;
      }

      const titleMappings = {
        duke: ["d", "duke"],
        justice: ["j", "justice"],
        architect: ["a", "arch", "architect"],
        scientist: ["s", "sci", "scientist"],
      };

      let title = null;

      for (const [key, variations] of Object.entries(titleMappings)) {
        if (variations.includes(titleInput)) {
          title = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        }
      }

      if (!title) {
        await message.reply("Invalid title specified.");
        return;
      }

      try {
        const result = await TitleDuration.updateOne(
          { title: title, kingdom: kingdom },
          { duration: duration },
          { upsert: true }
        );

        if (result.upsertedCount > 0) {
          await message.reply(
            `Timer for ${title} has been set to ${duration} seconds in kingdom ${kingdom}.`
          );
        } else {
          await message.reply(
            `Timer for ${title} has been updated to ${duration} seconds in kingdom ${kingdom}.`
          );
        }
      } catch (error) {
        console.error(
          "An unexpected error occurred while updating the timer:",
          error
        );

        if (error.code === 11000) {
          await message.reply(
            "Duplicate entry detected. Please check if the title already exists for the specified kingdom."
          );
        } else {
          await message.reply(
            "An unexpected error occurred while setting the timer."
          );
        }
      }
      return;
    }

    if (args[0].toLowerCase() === "resetbot") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply("You do not have permission to use this command.");
        return;
      }

      const deviceId = process.env.EMULATOR_DEVICE_ID;

      exec(
        `adb -s ${deviceId} shell am force-stop com.lilithgame.roc.gp`,
        (error) => {
          if (error) {
            console.error(`Error stopping the app: ${error.message}`);
            return message.reply("Failed to stop the app. Please try again.");
          }
          exec(
            `adb -s ${deviceId} shell monkey -p com.lilithgame.roc.gp -c android.intent.category.LAUNCHER 1`,
            (error) => {
              if (error) {
                console.error(`Error starting the app: ${error.message}`);
                return message.reply(
                  "Failed to start the app. Please try again."
                );
              }
              setTimeout(() => {
                message.reply("App has been reset successfully!");
              }, 25000);
            }
          );
        }
      );
      return;
    }

    const titleMappings = {
      Duke: ["d", "duke", "duk", "D"],
      Justice: ["j", "justice", "jus", "J"],
      Architect: ["a", "arch", "architect", "A"],
      Scientist: ["s", "scientist", "sci", "S"],
    };

    let title = null;
    for (const [key, variations] of Object.entries(titleMappings)) {
      if (variations.includes(args[0].toLowerCase())) {
        title = key;
        break;
      }
    }

    if (!title) return;

    const userId = message.author.id;

    if (lastUserRequest[userId] === title) {
      await message.reply(
        `You cannot request the title "${title}" twice in a row. Please choose a different title.`
      );
      return;
    }

    if (!client.lastTitleRequestTime) {
      client.lastTitleRequestTime = {};
    }

    const now = Date.now();
    const lastRequestTime = client.lastTitleRequestTime[userId] || 0;
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < 4000) {
      await message.reply(
        "You are sending requests too quickly. Please wait a few seconds before trying again."
      );
      return;
    }

    client.lastTitleRequestTime[userId] = now;
    lastUserRequest[userId] = title;

    const user = await User.findOne({ userId });
    if (!user) {
      await message.reply("User not found. Please register first.");
      return;
    }

    const lockedTitleDoc = await LockedTitle.findOne({
      title,
      kingdom: process.env.KINGDOM,
      isLocked: true,
    });

    if (lockedTitleDoc) {
      await message.reply(
        `The title "${title}" is currently locked and cannot be requested.`
      );
      return;
    }

    const titleRequestLog = new TitleRequestLog({
      userId,
      title,
      username: user.username,
      kingdom: user.kingdom,
      status: "pending",
    });

    await titleRequestLog.save();

    await handleTitleRequest(userId, title, message);
  } catch (error) {
    console.error("Error processing message:", error);
    await message.reply(
      "There was an error processing your request. Please try again."
    );
  }
});

function runCheckState() {
  const deviceId = process.env.EMULATOR_DEVICE_ID;
  if (!deviceId) {
      console.error("No device ID found in environment variables.");
      return;
  }

  try {
      exec(
          `adb -s ${deviceId} exec-out screencap -p > ./temp/current_state_${deviceId}.png`,
          (error) => {
              if (error) {
                  console.error(
                      `Error taking screenshot on ${deviceId}: ${error.message}`
                  );
                  return;
              }
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
  } catch (error) {
      console.error(`Unexpected error while executing ADB command: ${error.message}`);
  }
}

setInterval(() => {
  const isAnyAdbRunning = Object.values(isAdbRunning).some((kingdom) =>
    Object.values(kingdom).some((isRunning) => isRunning)
  );

  if (!isAnyAdbRunning && !isAdbRunningGlobal) {
    runCheckState();
  } else {
    console.log("ADB functions are currently running. Skipping runCheckState.");
  }
}, 120000);

let adbQueue = [];
let isAdbRunningGlobal = false;

async function processGlobalAdbQueue() {
  if (isAdbRunningGlobal || adbQueue.length === 0) {
    console.log("Global ADB queue is empty or ADB is already running.");
    return;
  }

  isAdbRunningGlobal = true;
  const { title, request } = adbQueue.shift();

  try {
    const { userId, x, y, interaction, message } = request;

    const user = await User.findOne({ userId });
    if (!user) {
      throw new Error("User not found");
    }

    const username = user.username;
    const kingdom = user.kingdom;

    console.log(`Processing ADB command for title: ${title}, user: ${userId}`);

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

    await TitleRequestLog.create({
      userId,
      username,
      title,
      kingdom,
      status: "successful",
      timestamp: new Date(),
    });

    let remainingTime = titleDurations[title];
    const customDuration = await fetchCustomDurationFromDatabase(
      title,
      kingdom
    );

    if (customDuration) {
      remainingTime = customDuration;
    }

    console.log(`Custom or default remaining time: ${remainingTime} seconds`);

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

    const { userId } = request;
    let errorMessage = `<@${userId}>, ran into an error while processing your request for ${title}.`;

    if (error.message === "Title button not found in the ADB command.") {
      errorMessage = `<@${userId}>, please check your city coordinates. If you can see your city, please let @popPIN know.`;
      if (request.interaction) {
        await request.interaction.channel.send({
          content: errorMessage,
          files: [screenshotPath],
        });
      }
    }

    const user = await User.findOne({ userId });
    const username = user ? user.username : "Unknown User";
    const kingdom = user ? user.kingdom : "Unknown Kingdom";
    await TitleRequestLog.create({
      userId,
      username,
      title,
      kingdom,
      status: "unsuccessful",
      timestamp: new Date(),
    });

    lastUserRequest[request.userId] = null;
    isProcessing[title] = false;
    isAdbRunning[title] = false;
    setTimeout(() => processQueue(title), 10000);
  } finally {
    isAdbRunningGlobal = false;
    processGlobalAdbQueue();
  }
}

async function processQueue(title) {
  if (isProcessing[title] || queues[title].length === 0) {
    return;
  }

  isProcessing[title] = true;
  const request = queues[title].shift();
  const { userId } = request;

  console.log(
    `Adding ${title} request for user ${userId} to the global ADB queue`
  );

  adbQueue.push({ title, request });
  processGlobalAdbQueue();
}

function startTimer(collector, remainingTime, title, userId) {
  let timer = setInterval(() => {
    remainingTime -= 1;
    if (remainingTime <= 0) {
      clearInterval(timer);
      if (collector && !collector.ended) {
        collector.stop();
      }
    } else {
      if (remainingTime % 30 === 0) {
        console.log(
          `User ${userId} has ${remainingTime} seconds remaining for the title "${title}".`
        );
      }
    }
  }, 1000);
  return timer;
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

async function runAdbCommand(userId, x, y, title, kingdom) {
  const deviceId = process.env.EMULATOR_DEVICE_ID;

  const stateCheckResult = await new Promise((resolve) => {
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
    return stateCheckResult;
  }

  if (!isAdbRunning[kingdom]?.[title]) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const titleCommands = {
    Justice: [
      `adb -s ${deviceId} shell input tap 440 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_justice_${deviceId}.png`,
    ],
    Duke: [
      `adb -s ${deviceId} shell input tap 784 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_duke_${deviceId}.png`,
    ],
    Architect: [
      `adb -s ${deviceId} shell input tap 1125 591`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_architect_${deviceId}.png`,
    ],
    Scientist: [
      `adb -s ${deviceId} shell input tap 1472 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./temp/screenshot_scientist_${deviceId}.png`,
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
        await execAsync(cityTapCommand);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const screenshotFilename = `./temp/screenshot_${attempt}_${deviceId}.png`;
        const screenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${screenshotFilename}`;
        await execAsync(screenshotCommand);

        await new Promise((resolve) => setTimeout(resolve, 1000));
        const botStuckCheckResult = await new Promise((resolve) => {
          exec(
            `python check_bot_stuck.py ${screenshotFilename}`,
            (error, stdout, stderr) => {
              if (error) {
                console.error(
                  `Error running check_bot_stuck.py: ${error.message}`
                );
                resolve({
                  success: false,
                  error: "Bot stuck check script execution error",
                });
                return;
              }
              if (stderr) {
                console.error(`Stderr from check_bot_stuck.py: ${stderr}`);
                resolve({
                  success: false,
                  error: "Bot stuck check script stderr",
                });
                return;
              }
              const result = JSON.parse(stdout.trim());
              console.log("Bot stuck check result:", result.status);
              resolve(result);
            }
          );
        });

        if (botStuckCheckResult.success) {
          console.log("Bot is stuck.");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return await runAdbCommand(userId, x, y, title, kingdom);
        }
        const titleCheckResult = await new Promise((resolve) => {
          exec(
            `python ./check_title.py ${screenshotFilename} ${deviceId}`,
            (error, stdout) => {
              if (error) {
                if (error.message.includes("Negative title detected")) {
                  console.error("Negative title detected in the ADB command.");
                  resolve({
                    success: false,
                    error: error.message,
                  });
                  return;
                }
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
              }, 500);
            }
          );
        });

        if (titleCheckResult.success) {
          console.log("City button found!");
          return { success: true, coordinates: titleCheckResult.coordinates };
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
    return { success: false };
  }

  const initialCommands = [
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
    if (index >= commands.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      exec(commands[index], (error, stdout) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }

        setTimeout(() => {
          executeCommandWithDelay(commands, index + 1)
            .then(resolve)
            .catch(reject);
        }, 500);
      });
    });
  }

  try {
    await executeCommandWithDelay(initialCommands, 0);

    const titleCheckResult = await tapCityAndCheck();

    if (!titleCheckResult.success) {
      return titleCheckResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await executeCommandWithDelay(titleCommands[title], 0);

    return { success: true, coordinates: titleCheckResult.coordinates };
  } catch (error) {
    console.error(`Error processing commands for ${userId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function handleTitleRequest(userId, title, interaction) {
  try {
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
        await interaction.reply(
          `The title "${title}" is currently locked for your kingdom. Please choose a different title.`
        );
        return;
      }

      if (!queues[title]) {
        queues[title] = [];
      }

      if (!isProcessing[title]) {
        isProcessing[title] = false;
      }

      const request = {
        interaction,
        userId,
        title,
        kingdom: userKingdom,
        x: user.x,
        y: user.y,
      };

      queues[title].push(request);

      const queuePosition = queues[title].length;

      lastUserRequest[userId] = title;

      if (!isProcessing[title]) {
        processQueue(title);
      }

      const isTitleTimerRunning = timers[title] != null;

      if (queuePosition > 1) {
        if (!interaction.replied) {
          await interaction.reply(
            `Your title request has been added to the queue for ${title}! You are number ${queuePosition} in line.`
          );
        }
      } else {
        if (!interaction.replied) {
          if (!isTitleTimerRunning) {
            await interaction.reply(
              `Your title request for ${title} is being processed immediately.`
            );
          } else {
            await interaction.reply(
              `Your title request for ${title} is in queue, but another request is being processed. You will be notified once it is your turn.`
            );
          }
        }
      }
    } else {
      if (!interaction.replied) {
        await interaction.reply(
          "You haven't registered your username and coordinates. Please type the following: `register [your_username] [x] [y]`."
        );
      }
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    if (!interaction.replied) {
      await interaction.reply(
        "An unexpected error occurred. Please try again later."
      );
    }
  }
}
