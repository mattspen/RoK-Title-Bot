import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import { exec } from "child_process";
import TitleDuration from "./models/setTimer.js";
import LockedTitle from "./models/locktitle.js";
import WebSocket from "ws";
import {
  isAdbRunning,
  isProcessing,
  lastUserRequest,
  queues,
  timers,
  titleDurations,
} from "./helpers/vars.js";
import { fetchCustomDurationFromDatabase } from "./helpers/fetchCustomDurationFromDatabase.js";
import schedule from "node-schedule";

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

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  console.log("Connected to the following servers:");
  client.guilds.cache.forEach(async (guild) => {
    console.log(
      `- ${guild.name} (ID: ${guild.id}, Members: ${guild.memberCount})`
    );

    try {
      // Set bot nickname for the guild
      await guild.members.me.setNickname("Title Oracle 🔮");
      console.log(`Nickname updated successfully in ${guild.name}`);
    } catch (error) {
      console.error(
        `Failed to update nickname in ${guild.name}:`,
        error.message
      );
    }
  });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== process.env.DISCORD_CHANNEL_ID) return;

  const content = message.content.trim();
  const args = content.split(/\s+/);
  const command = args[0].toLowerCase();

  try {
    const titleMappings = {
      Duke: ["d", "duke", "duk", "D"],
      Justice: ["j", "justice", "jus", "J"],
      Architect: ["a", "arch", "architect", "A"],
      Scientist: ["s", "scientist", "sci", "S"],
    };
    const validTitles = Object.keys(titleMappings);

    if (args[0].toLowerCase() === "locktitle") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply(
          "> You do not have permission to use this command."
        );
        return;
      }

      if (args.length < 2) {
        await message.reply("> Please provide a title to lock.");
        return;
      }

      const titleInput = args[1].toLowerCase();
      const kingdom = process.env.KINGDOM;

      // Normalize the title input to the canonical title using titleMappings
      const normalizedTitle = Object.keys(titleMappings).find((key) =>
        titleMappings[key].includes(titleInput)
      );

      // Validate title
      if (!normalizedTitle) {
        await message.reply(
          `> Invalid title. Only the following titles can be locked: ${validTitles.join(
            ", "
          )}.`
        );
        return;
      }

      const lockedTitle = await LockedTitle.findOneAndUpdate(
        { title: normalizedTitle, kingdom },
        { isLocked: true, lockedBy: userId, lockedAt: new Date() },
        { upsert: true, new: true }
      );

      const embed = {
        color: 0xff0000, // Red color for lock
        title: `🔒 Title Locked`,
        description: lockedTitle
          ? `The title "${normalizedTitle}" has been successfully locked for kingdom ${kingdom}.`
          : "There was an error locking the title.",
        fields: [
          { name: "Title", value: normalizedTitle, inline: true },
          { name: "Kingdom", value: kingdom, inline: true },
          { name: "Locked By", value: `<@${userId}>`, inline: true },
          {
            name: "Locked At",
            value: new Date().toLocaleString(),
            inline: true,
          },
        ],
        footer: {
          text: `Locked by ${message.author.username}`,
          icon_url: message.author.displayAvatarURL(),
        },
        timestamp: new Date(),
      };

      await message.reply({ embeds: [embed] });
      return;
    }

    if (args[0].toLowerCase() === "unlocktitle") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply(
          "> You do not have permission to use this command."
        );
        return;
      }

      if (args.length < 2) {
        await message.reply("> Please provide a title to unlock.");
        return;
      }

      const titleInput = args[1].toLowerCase();
      const kingdom = process.env.KINGDOM;

      // Normalize the title input to the canonical title using titleMappings
      const normalizedTitle = Object.keys(titleMappings).find((key) =>
        titleMappings[key].includes(titleInput)
      );

      // Validate title
      if (!normalizedTitle) {
        await message.reply(
          `> Invalid title. Only the following titles can be unlocked: ${validTitles.join(
            ", "
          )}.`
        );
        return;
      }

      const lockedTitle = await LockedTitle.findOneAndUpdate(
        { title: normalizedTitle, kingdom },
        { isLocked: false, lockedBy: null, lockedAt: null }, // Reset lockedBy and lockedAt
        { new: true }
      );

      const embed = {
        color: 0x00ff00, // Green color for unlock
        title: `🔓 Title Unlocked`,
        description: lockedTitle
          ? `The title "${normalizedTitle}" has been successfully unlocked for kingdom ${kingdom}.`
          : `No locked title found for "${normalizedTitle}" in kingdom ${kingdom}.`,
        fields: [
          { name: "Title", value: normalizedTitle, inline: true },
          { name: "Kingdom", value: kingdom, inline: true },
          { name: "Unlocked By", value: `<@${userId}>`, inline: true },
        ],
        footer: {
          text: `Unlocked by ${message.author.username}`,
          icon_url: message.author.displayAvatarURL(),
        },
        timestamp: new Date(),
      };

      await message.reply({ embeds: [embed] });
      return;
    }

    if (args[0].toLowerCase() === "register") {
      if (args.length < 3) {
        await message.reply(
          "> Please provide coordinates in the format: `register <x> <y>`."
        );
        return;
      }

      const isUsernamePresent = isNaN(args[1]);
      const x = parseInt(isUsernamePresent ? args[2] : args[1], 10);
      const y = parseInt(isUsernamePresent ? args[3] : args[2], 10);

      if (isNaN(x) || isNaN(y)) {
        await message.reply(
          "> Invalid coordinates. Please enter valid numbers for x and y."
        );
        return;
      }

      const userId = message.author.id;
      const kingdom = parseInt(process.env.KINGDOM, 10);
      const user = await User.findOne({ userId });

      const embed = {
        color: 0xadd8e6, // Light blue color for the embed
        title: "📍 Registration",
        description: `Kingdom: **${kingdom}**\nCoordinates: **(${x}, ${y})**`,
        timestamp: new Date(),
        footer: {
          text: `Requested by ${message.author.username}`,
          icon_url: message.author.displayAvatarURL(),
        },
      };

      if (user) {
        // Update existing user
        user.kingdom = kingdom;
        user.x = x;
        user.y = y;
        await user.save();
        embed.description = `✅ Your details have been updated:\n\n${embed.description}`;
      } else {
        // Register new user
        const newUser = new User({ userId, kingdom, x, y });
        await newUser.save();
        embed.description = `🎉 You have been registered:\n\n${embed.description}`;
      }

      await message.reply({ embeds: [embed] });
      return;
    }

    if (args[0].toLowerCase() === "settimer") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        await message.reply(
          "> You do not have permission to use this command."
        );
        return;
      }

      if (args.length < 3) {
        await message.reply(
          "> Invalid command format. Please use: `settimer <title> <duration>`."
        );
        return;
      }

      const titleInput = args[1].trim().toLowerCase();
      const duration = parseInt(args[2], 10);
      const kingdom = parseInt(process.env.KINGDOM, 10);

      if (!/^\d{4}$/.test(kingdom.toString())) {
        await message.reply("> Kingdom must be a 4-digit number.");
        return;
      }

      let title = null;

      for (const [key, variations] of Object.entries(titleMappings)) {
        if (variations.includes(titleInput)) {
          title = key.charAt(0).toUpperCase() + key.slice(1);
          break;
        }
      }

      if (!title) {
        await message.reply("> Invalid title specified.");
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
            `> Timer for ${title} has been set to ${duration} seconds in kingdom ${kingdom}.`
          );
        } else {
          await message.reply(
            `> Timer for ${title} has been updated to ${duration} seconds in kingdom ${kingdom}.`
          );
        }
      } catch (error) {
        console.error(
          "An unexpected error occurred while updating the timer:",
          error
        );
        if (error.code === 11000) {
          await message.reply(
            "> Duplicate entry detected. Please check if the title already exists for the specified kingdom."
          );
        } else {
          await message.reply(
            "> An unexpected error occurred while setting the timer."
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
        await message.reply(
          "> You do not have permission to use this command."
        );
        return;
      }

      const deviceId = process.env.EMULATOR_DEVICE_ID;

      exec(
        `adb -s ${deviceId} shell am force-stop com.lilithgame.roc.gp`,
        (error) => {
          if (error) {
            console.error(`Error stopping the app: ${error.message}`);
            return message.reply("> Failed to stop the app. Please try again.");
          }
          exec(
            `adb -s ${deviceId} shell monkey -p com.lilithgame.roc.gp -c android.intent.category.LAUNCHER 1`,
            (error) => {
              if (error) {
                console.error(`Error starting the app: ${error.message}`);
                return message.reply(
                  "> Failed to start the app. Please try again."
                );
              }

              setTimeout(() => {
                exec(
                  `adb -s ${deviceId} shell pidof com.lilithgame.roc.gp`,
                  (error, stdout) => {
                    if (error || !stdout.trim()) {
                      console.error(
                        `App is not running: ${
                          error ? error.message : "No process found."
                        }`
                      );
                      return message.reply(
                        "> Failed to confirm app is running. Please check manually."
                      );
                    }
                    message.reply(
                      "> App has been reset and is running successfully!"
                    );
                  }
                );
              }, 25000); // Wait for 25 seconds before checking the app status
            }
          );
        }
      );
      return;
    }

    let title = null;
    let isLostKingdom = false;

    for (const [key, variations] of Object.entries(titleMappings)) {
      if (variations.includes(command)) {
        title = key;
        break;
      }
    }

    if (
      args.includes("lk") ||
      args.includes("LK") ||
      args.includes("Lk") ||
      args.includes(process.env.LOSTKINGDOM)
    ) {
      isLostKingdom = true;
    }

    if (!title) return;

    const userId = message.author.id;

    if (lastUserRequest[userId] === title) {
      const embed = {
        color: 0xff0000,
        title: "⚠️ Title Request Error",
        description: `You cannot request the title "${title}" twice in a row. Please choose a different title.`,
        footer: {
          text: `Requested by ${message.author.username}`,
          icon_url: message.author.displayAvatarURL(),
        },
        timestamp: new Date(),
      };

      await message.reply({ embeds: [embed] });
      return;
    }

    if (!client.lastTitleRequestTime) {
      client.lastTitleRequestTime = {};
    }

    const now = Date.now();
    const lastRequestTime = client.lastTitleRequestTime[userId] || 0;
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < 4000) {
      const embed = {
        color: 0xff0000,
        title: "⚠️ Slow Down",
        description:
          "You are sending requests too quickly. Please wait a few seconds before trying again.",
        footer: {
          text: `Requested by ${message.author.username}`,
          icon_url: message.author.displayAvatarURL(),
        },
        timestamp: new Date(),
      };

      await message.reply({ embeds: [embed] });
      return;
    }

    client.lastTitleRequestTime[userId] = now;
    lastUserRequest[userId] = title;

    let x = null;
    let y = null;

    if (args.length >= 3) {
      const isUsernamePresent = isNaN(args[1]);
      x = parseInt(isUsernamePresent ? args[2] : args[1], 10);
      y = parseInt(isUsernamePresent ? args[3] : args[2], 10);

      if (isNaN(x) || isNaN(y)) {
        const embed = {
          color: 0xff0000,
          title: "⚠️ Invalid Coordinates",
          description: "Please enter valid numbers for x and y.",
          footer: {
            text: `Requested by ${message.author.username}`,
            icon_url: message.author.displayAvatarURL(),
          },
          timestamp: new Date(),
        };

        await message.reply({ embeds: [embed] });
        return;
      }
    }

    let user = await User.findOne({ userId });

    if (!user) {
      const kingdom = parseInt(process.env.KINGDOM, 10);
      if (x === null || y === null) {
        await message.reply(
          "Coordinates are required for first-time registration. e.g: architect lk 603 449"
        );
        return;
      }

      user = new User({ userId, kingdom, x, y });
      await user.save();
      const embed = {
        color: 0xadd8e6,
        title: "📍 Registration Successful",
        description: `You have been registered with coordinates **(${x}, ${y})** in Kingdom **${kingdom}**.`,
        timestamp: new Date(),
        footer: {
          text: `Requested by ${message.author.username}`,
          icon_url: message.author.displayAvatarURL(),
        },
      };

      await message.reply({ embeds: [embed] });
    } else {
      if (x !== null && y !== null) {
        user.x = x;
        user.y = y;
        await user.save();
      }
    }

    await handleTitleRequest(userId, title, message, isLostKingdom);
  } catch (error) {
    console.error("Error processing message:", error);
    const embed = {
      color: 0xff0000,
      title: "⚠️ Error",
      description:
        "There was an error processing your request. Please try again.",
      footer: {
        text: `Requested by ${message.author.username}`,
        icon_url: message.author.displayAvatarURL(),
      },
      timestamp: new Date(),
    };

    await message.reply({ embeds: [embed] });
  }
});

function runCheckState() {
  const deviceId = process.env.EMULATOR_DEVICE_ID;
  if (!deviceId) {
    console.error("No device ID found.");
    return;
  }

  const screenshotPath = `./temp/current_state_${deviceId}.png`;

  exec(
    `adb -s ${deviceId} exec-out screencap -p > ${screenshotPath}`,
    (error) => {
      if (error) {
        console.error(`Error taking screenshot: ${error.message}`);
        return;
      }

      exec(
        `python check_home.py ${deviceId} ${screenshotPath}`,
        (error, stdout, stderr) => {
          if (error) {
            console.error(`Error with check_home.py: ${error.message}`);
            return;
          }
          if (stderr) {
            console.error(`Stderr from check_home.py: ${stderr}`);
            return;
          }

          exec(
            `python check_state.py ${screenshotPath} ${deviceId}`,
            (error, stdout, stderr) => {
              if (error) {
                console.error(`Error with check_state.py: ${error.message}`);
                return;
              }
              if (stderr) {
                console.error(`Stderr from check_state.py: ${stderr}`);
                return;
              }

              exec(
                `python connection_check.py ${screenshotPath} ${deviceId}`,
                (error, stdout, stderr) => {
                  if (error) {
                    console.error(
                      `Error with connection_check.py: ${error.message}`
                    );
                    return;
                  }
                  if (stderr) {
                    console.error(`Stderr from connection_check.py: ${stderr}`);
                    return;
                  }
                }
              );
            }
          );
        }
      );
    }
  );
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
}, 20000);

let adbQueue = [];
let isAdbRunningGlobal = false;

async function processGlobalAdbQueue() {
  if (isAdbRunningGlobal || adbQueue.length === 0) {
    console.log("Global ADB queue is empty or ADB is already running.");
    return;
  }

  isAdbRunningGlobal = true;
  const { title, request } = adbQueue.shift();

  let user = null;

  try {
    const { userId, x, y, interaction, isLostKingdom } = request;

    user = userId ? await User.findOne({ userId }) : null;
    if (userId && !user) {
      throw new Error("User not found");
    }

    const kingdom = user ? user.kingdom : parseInt(process.env.KINGDOM, 10);

    const adbResult = await runAdbCommand(
      x,
      y,
      title,
      isLostKingdom,
      interaction
    );

    if (!adbResult.success) {
      throw new Error("Title button not found in the ADB command.");
    }

    let remainingTime = titleDurations[title];
    const customDuration = await fetchCustomDurationFromDatabase(
      title,
      kingdom
    );

    if (customDuration) {
      remainingTime = customDuration;
    }

    if (interaction) {
      // Discord request: Send notification message and set up reaction collector
      const notificationMessage = await interaction.channel.send({
        content: `<@${userId}>, ${title.toLowerCase()} on you! React with ✅ when done, you have ${remainingTime} sec.`,
      });

      await notificationMessage.react("✅");

      const filter = (reaction, user) =>
        reaction.emoji.name === "✅" && user.id === userId;
      const collector = notificationMessage.createReactionCollector({
        filter,
        time: customDuration ? customDuration * 1000 : remainingTime * 1000,
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

        interaction.channel
          .send(responseMessage)
          .catch((err) => console.error("Failed to send response:", err));

        setTimeout(() => {
          lastUserRequest[userId] = null;
          isProcessing[title] = false;
          isAdbRunning[title] = false;
          processQueue(title);
        }, 10000);
      });

      timers[title] = startTimer(collector, remainingTime, title, userId);
    } else {
      console.log(
        `WebSocket request for title "${title}" processed. Timer will elapse in ${remainingTime} seconds.`
      );

      timers[title] = setTimeout(() => {
        console.log(
          `Timer for title "${title}" elapsed. Moving to the next request.`
        );
        isProcessing[title] = false;
        isAdbRunning[title] = false;
        processQueue(title);
      }, remainingTime * 1000);
    }
  } catch (error) {

    const deviceId = process.env.EMULATOR_DEVICE_ID;
    const screenshotPath = `./temp/screenshot_city_not_found_${deviceId}.png`;
    console.log(error);

    const errorMessage =
      error.message === "Title button not found in the ADB command."
        ? `Please check your city coordinates. To update them, provide the title and coordinates. For example: \`duke 123 456\``
        : `Ran into an error while processing the request for ${title}.`;

    if (request?.interaction) {
      const embed = {
        color: 0xff0000,
        title: "Error: Title Button Not Found",
        description: errorMessage,
        image: {
          url: `attachment://${screenshotPath.split("/").pop()}`,
        },
      };

      request.interaction.channel
        .send({
          embeds: [embed],
          files: [{ attachment: screenshotPath }],
        })
        .catch((err) => console.error("Failed to send error embed:", err));
    } else {
      console.log(errorMessage);
    }

    lastUserRequest[request?.userId] = null;
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

async function runAdbCommand(x, y, title, isLostKingdom, interaction) {
  const deviceId = process.env.EMULATOR_DEVICE_ID;

  const isCurrentlyInLostKingdom = await new Promise((resolve) => {
    exec(
      `adb -s ${deviceId} exec-out screencap -p > ./temp/lk_state_${deviceId}.png`,
      (error) => {
        if (error) {
          console.error(
            `Error taking screenshot on ${deviceId}: ${error.message}`
          );
          resolve(false); // If screenshot fails, assume not in Lost Kingdom
          return;
        }
        exec(
          `python check_profile_picture.py ./temp/lk_state_${deviceId}.png`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(
                `Error running check_profile_picture.py: ${error.message}`
              );
              resolve(false); // Assume not in Lost Kingdom if script errors
              return;
            }
            if (stderr) {
              console.error(`Stderr from check_profile_picture.py: ${stderr}`);
            }

            // Parse output: the script outputs "True" or "False"
            resolve(stdout.trim().toLowerCase() === "true");
          }
        );
      }
    );
  });

  console.log(`Currently in Lost Kingdom: ${isCurrentlyInLostKingdom}`);

  console.log(`Requested Lost Kingdom: ${isLostKingdom}`);

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
    { x: 844, y: 442 },
    { x: 931, y: 499 },
    { x: 1020, y: 515 },
  ];

  async function tapCityAndCheck() {
    for (let attempt = 0; attempt < cityCoordinates.length; attempt++) {
      const { x: cityX, y: cityY } = cityCoordinates[attempt];
      const cityTapCommand = `adb -s ${deviceId} shell input tap ${cityX} ${cityY}`;

      try {
        await execAsync(cityTapCommand);

        await new Promise((resolve) => setTimeout(resolve, 300));

        const screenshotFilename = `./temp/screenshot_${attempt}_${deviceId}.png`;
        const screenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${screenshotFilename}`;
        await execAsync(screenshotCommand);

        await new Promise((resolve) => setTimeout(resolve, 1500));

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

  // Define the default range for randomX1
  let randomX1 = Math.floor(Math.random() * (648 - 415 + 1)) + 415; // Random X1 between 415 and 648

  // If the player is in the Lost Kingdom, adjust the X range for the magnifying glass
  if (isCurrentlyInLostKingdom) {
    randomX1 = Math.floor(Math.random() * (334 - 132 + 1)) + 132; // Random X1 between 132 and 334
  }
  const randomY1 = Math.floor(Math.random() * (45 - 20 + 1)) + 20; // Random Y1 between 20 and 45

  // 2. Kingdom tap (X: 607-760, Y: 183-226)
  const lostKingdomX = Math.floor(Math.random() * (735 - 622 + 1)) + 607; // Random X between 607 and 760
  const lostKingdomY = Math.floor(Math.random() * (240 - 195 + 1)) + 195; // Random Y between 183 and 226

  // 3. X tap (X: 877-999, Y: 195-240)
  const randomX3 = Math.floor(Math.random() * (999 - 877 + 1)) + 877; // Random X3 between 877 and 999
  const randomY3 = Math.floor(Math.random() * (240 - 195 + 1)) + 195; // Random Y3 between 195 and 240

  // 4. Y tap (X: 1115-1255, Y: 195-240)
  const randomX4 = Math.floor(Math.random() * (1255 - 1115 + 1)) + 1115; // Random X4 between 1115 and 1255
  const randomY4 = Math.floor(Math.random() * (240 - 195 + 1)) + 195; // Use the same Y as randomY3 (195-240)

  // 5. Magnifying glass tap (X: 1295-1350, Y: 195-240)
  const randomX5 = Math.floor(Math.random() * (1350 - 1295 + 1)) + 1295; // Random X5 between 1295 and 1350
  const randomY5 = Math.floor(Math.random() * (240 - 195 + 1)) + 195; // Use the same Y as randomY3 (195-240)

  // Initialize the commands array here before use
  const initialCommands = [
    `adb -s ${deviceId} shell input tap ${randomX1} ${randomY1}`, // Magnifying tap
  ];

  // Check if lostKingdom is true and add tap and paste commands
  if (isLostKingdom) {
    initialCommands.push(
      `adb -s ${deviceId} shell input tap ${lostKingdomX} ${lostKingdomY}`, // Tap for Lost Kingdom
      ...Array(6).fill(`adb -s ${deviceId} shell input keyevent 67`), // Backspace 6 times
      `adb -s ${deviceId} shell input text "${process.env.LOSTKINGDOM}"` // Input kingdom text
    );
  } else {
    initialCommands.push(
      `adb -s ${deviceId} shell input tap ${lostKingdomX} ${lostKingdomY}`, // Tap for Lost Kingdom
      ...Array(6).fill(`adb -s ${deviceId} shell input keyevent 67`), // Backspace 6 times
      `adb -s ${deviceId} shell input text "${process.env.KINGDOM}"` // Input kingdom text
    );
  }
  console.log("x and y coords", x, y);
  // Continue with the rest of the commands for coordinate inputs and search
  initialCommands.push(
    `adb -s ${deviceId} shell input tap ${randomX3} ${randomY3}`, // X tap
    `adb -s ${deviceId} shell input tap ${randomX3} ${randomY3}`, // X tap
    `adb -s ${deviceId} shell input text "${x}"`, // X paste
    `adb -s ${deviceId} shell input tap ${randomX4} ${randomY4}`, // Y tap to remove keyboard
    `adb -s ${deviceId} shell input tap ${randomX4} ${randomY4}`, // Y tap
    `adb -s ${deviceId} shell input text "${y}"`, // Y paste
    `adb -s ${deviceId} shell input tap ${randomX5} ${randomY5}`, // Magnifying tap to remove keyboard
    `adb -s ${deviceId} shell input tap ${randomX5} ${randomY5}` // Magnifying tap to do search
  );

  async function executeCommandWithDelay(commands, index) {
    if (index >= commands.length) return Promise.resolve();

    return new Promise((resolve, reject) => {
      exec(commands[index], (error, stdout) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }

        const randomDelay = Math.floor(Math.random() * (300 - 100 + 1)) + 100;

        setTimeout(() => {
          executeCommandWithDelay(commands, index + 1)
            .then(resolve)
            .catch(reject);
        }, randomDelay);
      });
    });
  }

  try {
    await executeCommandWithDelay(initialCommands, 0);
    if (isCurrentlyInLostKingdom !== isLostKingdom) {
      // Only apply the 10-second delay if they are not the same
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } else {
      // No delay if both values are the same
      console.log("No delay as both Lost Kingdom statuses are the same.");
    }
    const titleCheckResult = await tapCityAndCheck();

    if (!titleCheckResult.success) {
      return titleCheckResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));

    await executeCommandWithDelay(titleCommands[title], 0);

    return { success: true, coordinates: titleCheckResult.coordinates };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function refreshApp(channel) {
  const deviceId = process.env.EMULATOR_DEVICE_ID;

  if (!deviceId) {
    console.error("No device ID found. Skipping refresh.");
    return;
  }

  console.log("Refreshing Rise of Kingdoms app...");

  // Send embed notification to the specified channel
  const embed = {
    color: 0x3498db, // Light blue color
    title: "🔄 App Refresh",
    description:
      "The Rise of Kingdoms app is being refreshed. Please wait a moment.",
    footer: {
      text: "App refresh initiated",
    },
    timestamp: new Date(),
  };

  if (channel) {
    channel
      .send({ embeds: [embed] })
      .catch((err) => console.error("Failed to send refresh embed:", err));
  }

  exec(
    `adb -s ${deviceId} shell am force-stop com.lilithgame.roc.gp`,
    (stopError) => {
      if (stopError) {
        console.error("Failed to stop RoK app:", stopError.message);
        return;
      }
      console.log("App stopped successfully.");

      // Restart the app after a brief delay
      setTimeout(() => {
        exec(
          `adb -s ${deviceId} shell monkey -p com.lilithgame.roc.gp -c android.intent.category.LAUNCHER 1`,
          (startError) => {
            if (startError) {
              console.error("Failed to restart RoK app:", startError.message);
              return;
            }
            console.log("App restarted successfully.");
          }
        );
      }, 5000); // 5-second delay before restarting
    }
  );
}

// Schedule the task to run at 1 AM daily
schedule.scheduleJob("0 1 * * *", () => {
  console.log("Running scheduled RoK app refresh...");

  // Specify the channel where you want to send the notification
  const channel = client.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
  if (channel) {
    refreshApp(channel);
  } else {
    console.error(
      "Failed to find the Discord channel for app refresh notification."
    );
  }
});

async function handleTitleRequest(
  userId,
  title,
  interaction,
  isLostKingdom,
  x = null,
  y = null,
  kingdom = null
) {
  try {
    if (!interaction) {
      console.log("Processing a WebSocket request...");
    }

    // Find user if `userId` is provided, otherwise use passed coordinates and kingdom
    const user = userId ? await User.findOne({ userId }) : null;

    const userKingdom = user ? user.kingdom : kingdom;
    const userX = user ? user.x : x;
    const userY = user ? user.y : y;

    if (userKingdom && userX != null && userY != null) {
      const lockedTitle = await LockedTitle.findOne({
        title,
        kingdom: userKingdom,
      });
      const customDuration =
        (await fetchCustomDurationFromDatabase(title, userKingdom)) ||
        titleDurations[title] ||
        0;

      if (lockedTitle && lockedTitle.isLocked) {
        if (interaction) {
          const lockedByUser = lockedTitle.lockedBy
            ? await interaction.client.users
                .fetch(lockedTitle.lockedBy)
                .catch(() => null)
            : null;
          const lockedBy = lockedByUser ? lockedByUser.tag : "Unknown User";
          const lockedAt = lockedTitle.lockedAt
            ? lockedTitle.lockedAt.toLocaleString()
            : "Unknown Time";

          const embed = {
            color: 0x87cefa,
            title: `🔒 The title "${title}" is currently locked for your kingdom.`,
            description: "Please choose a different title.",
            fields: [
              { name: "👤 Locked By", value: lockedBy, inline: true },
              { name: "⏰ Locked At", value: lockedAt, inline: true },
            ],
          };
          await interaction.reply({ embeds: [embed] });
        } else {
          console.log(`Title "${title}" is locked for kingdom ${userKingdom}.`);
        }
        return;
      }

      if (!queues[title]) queues[title] = [];
      if (!isProcessing[title]) isProcessing[title] = false;

      const request = {
        interaction,
        userId,
        title,
        kingdom: userKingdom,
        x: userX,
        y: userY,
        isLostKingdom,
      };

      queues[title].push(request);
      const queuePosition = queues[title].length;
      if (userId) lastUserRequest[userId] = title;

      if (!isProcessing[title]) processQueue(title);

      if (interaction) {
        const embed = {
          color: 0x87cefa,
          title: `${title} Request Added`,
          footer: {
            text: `📍 ${
              isLostKingdom ? process.env.LOSTKINGDOM : process.env.KINGDOM
            } ${userX} ${userY}    ⌛ ${customDuration} sec`,
          },
        };

        if (queuePosition >= 1) {
          embed.description = `**Position in Queue**: ${queuePosition}\n`;
        }

        await interaction.reply({ embeds: [embed] });
      } else {
        console.log(
          `Request added: Title "${title}" for kingdom ${userKingdom} at coordinates (${userX}, ${userY}).`
        );
      }
    } else {
      if (interaction) {
        const embed = {
          color: 0x87cefa,
          title: "❗ Unregistered Coordinates",
          description:
            "You haven't registered your coordinates. Please type the following: `register [x] [y]`.",
        };
        await interaction.reply({ embeds: [embed] });
      } else {
        console.log("Request failed: Missing coordinates or kingdom.");
      }
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    if (interaction && !interaction.replied) {
      const embed = {
        color: 0x87cefa,
        title: "⚠️ Unexpected Error",
        description: "An unexpected error occurred. Please try again later.",
      };
      await interaction.reply({ embeds: [embed] });
    }
  }
}

// Set up WebSocket server
const kingdomEnv = parseInt(process.env.KINGDOM, 10);

const wss = new WebSocket.Server({ port: kingdomEnv });

wss.on("connection", (ws) => {
  console.log("WebSocket connection established.");

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);

      const { title, x, y, isLostKingdom } = data;

      console.log(`Received request from WebSocket: ${JSON.stringify(data)}`);

      await handleTitleRequest(null, title, null, isLostKingdom, x, y, kingdomEnv);
    
      ws.send(JSON.stringify({ success: true }));
    } catch (err) {
      console.error("Error handling WebSocket message:", err);

      // Send error acknowledgment back to the client
      ws.send(JSON.stringify({ success: false, error: err.message }));
    }
  });

  ws.on("close", () => {
    console.log("WebSocket connection closed.");
  });
});
