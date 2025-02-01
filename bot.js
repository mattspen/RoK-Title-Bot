import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import { exec, execFile } from "child_process";
import TitleDuration from "./models/setTimer.js";
import LockedTitle from "./models/locktitle.js";
import {
  cityCoordinates,
  isAdbRunning,
  isProcessing,
  lastUserRequest,
  queues,
  timers,
  titleDurations,
} from "./helpers/vars.js";
import { fetchCustomDurationFromDatabase } from "./helpers/fetchCustomDurationFromDatabase.js";
import schedule from "node-schedule";
import { runCheckState } from "./helpers/checkState.js";
import startTimer from "./helpers/startTimer.js";
import execAsync from "./helpers/execAsync.js";
import process from "process";
import { promisify } from "util";

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
      await guild.members.me.setNickname("Title Oracle 🔮");
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
        await message.reply("You do not have permission to use this command.");
        return;
      }

      if (args.length < 2) {
        await message.reply("Please provide a title to lock.");
        return;
      }

      const titleInput = args[1].toLowerCase();
      const kingdom = process.env.KINGDOM;

      const normalizedTitle = Object.keys(titleMappings).find((key) =>
        titleMappings[key].includes(titleInput)
      );

      if (!normalizedTitle) {
        await message.reply(
          `Invalid title. Only the following titles can be locked: ${validTitles.join(
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
        color: 0xff0000,
        title: `🔒 Title Locked`,
        description: lockedTitle
          ? `The title "${normalizedTitle}" has been successfully locked for kingdom ${kingdom}.`
          : "There was an error locking the title.",
        fields: [
          { name: "Title", value: normalizedTitle, inline: true },
          { name: "Kingdom", value: kingdom, inline: true },
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
        await message.reply("You do not have permission to use this command.");
        return;
      }

      if (args.length < 2) {
        await message.reply("Please provide a title to unlock.");
        return;
      }

      const titleInput = args[1].toLowerCase();
      const kingdom = process.env.KINGDOM;

      const normalizedTitle = Object.keys(titleMappings).find((key) =>
        titleMappings[key].includes(titleInput)
      );

      // Validate title
      if (!normalizedTitle) {
        await message.reply(
          `Invalid title. Only the following titles can be unlocked: ${validTitles.join(
            ", "
          )}.`
        );
        return;
      }

      const lockedTitle = await LockedTitle.findOneAndUpdate(
        { title: normalizedTitle, kingdom },
        { isLocked: false, lockedBy: null, lockedAt: null },
        { new: true }
      );

      const embed = {
        color: 0x00ff00, // Green
        title: `🔓 Title Unlocked`,
        description: lockedTitle
          ? `The title "${normalizedTitle}" has been successfully unlocked for kingdom ${kingdom}.`
          : `No locked title found for "${normalizedTitle}" in kingdom ${kingdom}.`,
        fields: [
          { name: "Title", value: normalizedTitle, inline: true },
          { name: "Kingdom", value: kingdom, inline: true },
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

    if (args[0].toLowerCase() === "settimer") {
      const superUserIds = process.env.SUPERUSER_ID.split(",").map((id) =>
        id.trim()
      );
      const userId = message.author.id;

      if (!superUserIds.includes(userId)) {
        const embed = {
          color: 0xff0000,
          title: "⚠️ Permission Denied",
          description: "You do not have permission to use this command.",
          footer: {
            text: `Requested by ${message.author.username}`,
            icon_url: message.author.displayAvatarURL(),
          },
          timestamp: new Date(),
        };
        await message.reply({ embeds: [embed] });
        return;
      }

      if (args.length < 3) {
        const embed = {
          color: 0xff0000,
          title: "⚠️ Invalid Command Format",
          description: "Please use: `settimer <title> <duration>`.",
          footer: {
            text: `Requested by ${message.author.username}`,
            icon_url: message.author.displayAvatarURL(),
          },
          timestamp: new Date(),
        };
        await message.reply({ embeds: [embed] });
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
                        "Failed to confirm app is running. Please check manually."
                      );
                    }
                    message.reply(
                      "App has been reset and is running successfully!"
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
    } else if (
      args.includes("hk") ||
      args.includes("HK") ||
      args.includes("Hk") ||
      args.includes(process.env.KINGDOM)
    ) {
      isLostKingdom = false;
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

        lastUserRequest[userId] = null;
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
        lastUserRequest[userId] = null;
        return;
      }

      user = new User({ userId, kingdom, x, y });
      await user.save();
      const embed = {
        color: 0xadd8e6,
        timestamp: new Date(),
        footer: {
          text: `📍 Registration Successful`,
          icon_url: message.author.displayAvatarURL(),
        },
        description: `You have been registered with coordinates **(${x}, ${y})** in **Kingdom ${kingdom}**.`,
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

setInterval(() => {
  const isAnyAdbRunning = Object.values(isAdbRunning).some((kingdom) =>
    Object.values(kingdom).some((isRunning) => isRunning)
  );

  if (!isAnyAdbRunning && !isAdbRunningGlobal) {
    runCheckState();
  }
}, 20000);

let adbQueue = [];
let isAdbRunningGlobal = false;

async function processGlobalAdbQueue() {
  if (isAdbRunningGlobal || adbQueue.length === 0) {
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
        `Chat request for title "${title}" processed. Timer will elapse in ${remainingTime} seconds.`
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
    // Check specifically for the negative title error
    if (error.message === "Negative title detected.") {
      if (request?.interaction?.channel && request?.userId) {
        // We have an interaction and a userId, so mention the user in the channel
        await request.interaction.channel.send(
          `<@${request.userId}>, negative title detected, unable to grant title.`
        );
      } else if (request?.userId) {
        // We have a userId but no channel interaction (e.g., direct chat request), attempt DM
        const discordUser = await client.users
          .fetch(request.userId)
          .catch(() => null);
        if (discordUser) {
          await discordUser.send(
            "Negative title detected, unable to grant title."
          );
        }
      } else {
        // No userId at all, do nothing
        console.log(
          "No user ID provided. Negative title detected, skipping..."
        );
      }

      lastUserRequest[request?.userId] = null;
      isProcessing[title] = false;
      isAdbRunning[title] = false;
      setTimeout(() => processQueue(title), 10000);
    } else {
      // Handle other errors here
      const deviceId = process.env.EMULATOR_DEVICE_ID;
      const screenshotPath = `./temp/screenshot_city_not_found_${deviceId}.png`;
      console.log(error);

      if (request?.userId) {
        try {
          const user = await User.findOne({ userId: request.userId });
          if (user) {
            const coordinatesMessage =
              user.x && user.y
                ? `I have the coordinates X: ${user.x}, Y: ${user.y}, but I couldn't locate your city.`
                : `I lost your coords. Please try again`;

            if (request.interaction?.channel) {
              const embed = {
                color: 0xff0000,
                title: "Error: City Not Found",
                description: `<@${request.userId}>, ${coordinatesMessage}`,
                image: {
                  url: `attachment://${screenshotPath.split("/").pop()}`,
                },
              };

              await request.interaction.channel.send({
                embeds: [embed],
                files: [{ attachment: screenshotPath }],
              });
            } else {
              const discordUser = await client.users
                .fetch(request.userId)
                .catch(() => null);
              if (discordUser) {
                await discordUser.send(
                  `<@${request.userId}>, ${coordinatesMessage}`
                );
              }
            }
          }
        } catch (lookupError) {
          console.error(
            "Failed to lookup user or send notification:",
            lookupError
          );
        }
      } else {
        console.log("User ID not available, unable to send coordinates.");
      }

      lastUserRequest[request?.userId] = null;
      isProcessing[title] = false;
      isAdbRunning[title] = false;
      setTimeout(() => processQueue(title), 10000);
    }
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

async function runAdbCommand(x, y, title, isLostKingdom) {
  const deviceId = process.env.EMULATOR_DEVICE_ID;

  async function tapCityAndCheck() {
    for (let attempt = 0; attempt < cityCoordinates.length; attempt++) {
      const { x: cityX, y: cityY } = cityCoordinates[attempt];
      const cityTapCommand = `adb -s ${deviceId} shell input tap ${cityX} ${cityY}`;

      try {
        await execAsync(cityTapCommand);
        await new Promise((resolve) => setTimeout(resolve, 800));

        const screenshotFilename = `./temp/screenshot_${attempt}_${deviceId}.png`;
        const screenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${screenshotFilename}`;

        await new Promise((resolve) => setTimeout(resolve, 1000));
        await execAsync(screenshotCommand);

        const titleCheckResult = await new Promise((resolve) => {
          exec(
            `python ./check_title.py ${screenshotFilename} ${deviceId}`,
            (error, stdout) => {
              if (error) {
                console.error(
                  `Error executing Python script: ${error.message}`
                );
                // If Python script exited with sys.exit(1), we don't get a real error message for "Negative title".
                // We'll parse stdout to see if "Negative title" is in the JSON output.
                resolve({ success: false, error: error.message });
                return;
              }

              const lines = stdout
                .split("\n")
                .filter((line) => line.trim() !== "");
              const jsonLine = lines[lines.length - 1];
              let result;

              try {
                result = JSON.parse(jsonLine.trim());
              } catch (err) {
                console.error("Error parsing JSON:", err);
                resolve({ success: false });
                return;
              }

              // Check for negative title error in JSON
              if (
                result.error &&
                result.error.includes("Negative title detected")
              ) {
                console.error(
                  "Negative title detected in the Python script output."
                );
                resolve({ success: false, error: result.error });
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

              resolve({ success: true, coordinates: result.coordinates });
            }
          );
        });

        if (titleCheckResult.success) {
          console.log("City button found!");
          return { success: true, coordinates: titleCheckResult.coordinates };
        } else if (
          titleCheckResult.error &&
          titleCheckResult.error.includes("Negative title detected")
        ) {
          // Stop immediately on negative title
          return { success: false, error: "Negative title detected" };
        }
      } catch (error) {
        console.error(
          `Error tapping city or taking screenshot: ${error.message}`
        );
      }
    }

    const screenshotFilename = `./temp/screenshot_city_not_found_${deviceId}.png`;
    const screenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${screenshotFilename}`;
    await execAsync(screenshotCommand);
    return { success: false };
  }

  const isCurrentlyInLostKingdom = await new Promise((resolve) => {
    exec(
      `adb -s ${deviceId} exec-out screencap -p > ./temp/lk_state_${deviceId}.png`,
      (error) => {
        if (error) {
          console.error(
            `Error taking screenshot on ${deviceId}: ${error.message}`
          );
          resolve(false);
          return;
        }
        exec(
          `python check_profile_picture.py ./temp/lk_state_${deviceId}.png`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(
                `Error running check_profile_picture.py: ${error.message}`
              );
              resolve(false);
              return;
            }
            if (stderr)
              console.error(`Stderr from check_profile_picture.py: ${stderr}`);
            resolve(stdout.trim().toLowerCase() === "true");
          }
        );
      }
    );
  });

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

  // Configure random taps, etc...
  let randomX1 = Math.floor(Math.random() * (648 - 415 + 1)) + 415;
  if (isCurrentlyInLostKingdom) {
    randomX1 = Math.floor(Math.random() * (334 - 132 + 1)) + 132;
  }
  const randomY1 = Math.floor(Math.random() * (45 - 20 + 1)) + 20;
  const lostKingdomX = Math.floor(Math.random() * (735 - 622 + 1)) + 607;
  const lostKingdomY = Math.floor(Math.random() * (240 - 195 + 1)) + 195;
  const randomX3 = Math.floor(Math.random() * (999 - 877 + 1)) + 877;
  const randomY3 = Math.floor(Math.random() * (240 - 195 + 1)) + 195;
  const randomX4 = Math.floor(Math.random() * (1255 - 1115 + 1)) + 1115;
  const randomY4 = Math.floor(Math.random() * (240 - 195 + 1)) + 195;
  const randomX5 = Math.floor(Math.random() * (1350 - 1295 + 1)) + 1295;
  const randomY5 = Math.floor(Math.random() * (240 - 195 + 1)) + 195;

  const initialCommands = [
    `adb -s ${deviceId} shell input tap ${randomX1} ${randomY1}`,
  ];

  if (isCurrentlyInLostKingdom !== isLostKingdom) {
    initialCommands.push(
      `adb -s ${deviceId} shell input tap ${lostKingdomX} ${lostKingdomY}`,
      ...Array(6).fill(`adb -s ${deviceId} shell input keyevent 67`),
      `adb -s ${deviceId} shell input text "${
        isLostKingdom ? process.env.LOSTKINGDOM : process.env.KINGDOM
      }"`,
      `adb -s ${deviceId} shell input tap ${randomX3} ${randomY3}`
    );
  }

  initialCommands.push(
    `adb -s ${deviceId} shell input tap ${randomX3} ${randomY3}`,
    ...Array.from(x.toString()).map(
      (char) => `adb -s ${deviceId} shell input text "${char}"`
    ),
    `adb -s ${deviceId} shell input tap ${randomX4} ${randomY4}`,
    `adb -s ${deviceId} shell input tap ${randomX4} ${randomY4}`,
    ...Array.from(y.toString()).map(
      (char) => `adb -s ${deviceId} shell input text "${char}"`
    ),
    `adb -s ${deviceId} shell input tap ${randomX5} ${randomY5}`,
    `adb -s ${deviceId} shell input tap ${randomX5} ${randomY5}`
  );

  async function executeCommandWithDelay(commands, index) {
    if (index >= commands.length) return;
    return new Promise((resolve, reject) => {
      exec(commands[index], (error) => {
        if (error) {
          console.error(`Error executing command: ${error.message}`);
          reject(error);
          return;
        }
        const baseDelay = 150;
        const variance = Math.random() * 80 - 40;
        let randomDelay = baseDelay + variance;
        if ((index + 1) % 4 === 0) {
          randomDelay += Math.random() * 300 + 100;
        }
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
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
    await new Promise((resolve) => setTimeout(resolve, 400));

    const titleCheckResult = await tapCityAndCheck();
    if (!titleCheckResult.success) {
      if (
        titleCheckResult.error &&
        titleCheckResult.error.includes("Negative title detected")
      ) {
        return { success: false, error: "Negative title detected" };
      }
      return titleCheckResult;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    await executeCommandWithDelay(titleCommands[title], 0);

    return { success: true, coordinates: titleCheckResult.coordinates };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

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
    if (!interaction) console.log("Processing chat request...");

    const user = userId ? await User.findOne({ userId }) : null;
    const userKingdom = user?.kingdom || kingdom;
    const userX = user?.x || x;
    const userY = user?.y || y;

    if (!userKingdom || userX == null || userY == null) {
      if (interaction) {
        await interaction.reply({
          embeds: [
            {
              color: 0x87cefa,
              title: "❗ Unregistered Coordinates",
              description:
                "You haven't registered your coordinates. Please type the following: `register [x] [y]`.",
            },
          ],
        });
      } else {
        console.log("Request failed: Missing coordinates or kingdom.");
      }
      return;
    }

    const lockedTitle = await LockedTitle.findOne({
      title,
      kingdom: userKingdom,
    });
    if (lockedTitle?.isLocked) {
      if (interaction) {
        const lockedByUser = lockedTitle.lockedBy
          ? await interaction.client.users
              .fetch(lockedTitle.lockedBy)
              .catch(() => null)
          : null;
        const embed = {
          color: 0x87cefa,
          title: `🔒 The title \"${title}\" is currently locked for your kingdom.`,
          description: "Please choose a different title.",
          footer: {
            text: `👤 Locked By: ${
              lockedByUser?.tag || "Unknown User"
            } ⏰ Locked At: ${
              lockedTitle.lockedAt?.toLocaleString() || "Unknown Time"
            }`,
          },
        };
        await interaction.reply({ embeds: [embed] });
        if (userId) lastUserRequest[userId] = null;
      } else {
        console.log(`Title \"${title}\" is locked for kingdom ${userKingdom}.`);
      }
      return;
    }

    if (!queues[title]) queues[title] = [];
    if (!isProcessing[title]) isProcessing[title] = false;

    queues[title].push({
      interaction,
      userId,
      title,
      kingdom: userKingdom,
      x: userX,
      y: userY,
      isLostKingdom,
    });

    if (userId) lastUserRequest[userId] = title;
    if (!isProcessing[title]) processQueue(title);

    if (interaction) {
      const customDuration =
        (await fetchCustomDurationFromDatabase(title, userKingdom)) ||
        titleDurations[title] ||
        0;
      const embed = {
        color: 0x87cefa,
        title: `${title} Request Added`,
        description:
          queues[title].length > 0
            ? `**Position in Queue**: ${queues[title].length}\n`
            : "",
        footer: {
          text: `📍 ${
            isLostKingdom ? process.env.LOSTKINGDOM : process.env.KINGDOM
          } ${userX} ${userY}    ⌛ ${customDuration} sec`,
        },
      };
      await interaction.reply({ embeds: [embed] });
    } else {
      console.log(
        `Request added: Title \"${title}\" for kingdom ${userKingdom} at coordinates (${userX}, ${userY}).`
      );
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    if (interaction && !interaction.replied) {
      await interaction.reply({
        embeds: [
          {
            color: 0x87cefa,
            title: "⚠️ Unexpected Error",
            description:
              "An unexpected error occurred. Please try again later.",
          },
        ],
      });
    }
  }
}


const execFileAsync = promisify(execFile);

// Initialize tracking variables
let isScriptRunning = false; // Flag to indicate if the OCR script is currently running
const cooldownPeriod = 5000; // 5 seconds cooldown period

const activeRequests = new Map(); // Map to track active title assignments

/**
 * Processes a new title request.
 * If a different user requests the same title, the previous assignment is overridden.
 * @param {Object} message - The message object containing request details.
 * @returns {boolean} - True if processed, false otherwise.
 */
function processTitleRequest(message) {
  const hash = generateMessageHash(message);

  // Get the current assignment for the requested title
  const existingRequest = activeRequests.get(message.title);

  // Check if the new request is different from the current assignment
  if (
    existingRequest &&
    existingRequest.hash === hash
  ) {
    return false;
  }

  // Update the active request with the new one
  activeRequests.set(message.title, {
    hash,
    message,
  });

  console.log("Processing new request:", message);
  return true;
}

/**
 * Executes the OCR script and processes the output.
 */
async function executeOCRScript() {
  if (isScriptRunning) {
    // Script is already running; skip this execution
    setTimeout(executeOCRScript, cooldownPeriod);
    return;
  }
  isScriptRunning = true;

  try {
    // Retrieve environment variables
    const deviceId = process.env.EMULATOR_DEVICE_ID;
    const kingdom = process.env.KINGDOM;
    const lostKingdom = process.env.LOSTKINGDOM;

    // Execute the Python OCR script
    const { stdout, stderr } = await execFileAsync("python", ["chat_webhook.py", deviceId, kingdom, lostKingdom]);

    if (stderr) {
      console.error("Python script error:", stderr);
      setTimeout(executeOCRScript, cooldownPeriod);
      return;
    }

    // Parse the JSON output from the Python script
    const results = JSON.parse(stdout.trim() || "[]");
    if (results.length === 0) {
      setTimeout(executeOCRScript, cooldownPeriod);
      return;
    }

    // Iterate over the results to process each request
    for (const message of results) {
      if (processTitleRequest(message)) {
        // Handle the title request if it's a new or updated request
        const { title, x, y, isLostKingdom } = message;
        await handleTitleRequest(null, title, null, isLostKingdom, x, y, kingdom);
      }
    }

    // Schedule the next execution after cooldown period
    setTimeout(executeOCRScript, cooldownPeriod);
  } catch (error) {
    console.error("Error executing OCR script:", error);
    setTimeout(executeOCRScript, cooldownPeriod);
  } finally {
    isScriptRunning = false; // Reset the running flag
  }
}

/**
 * Generates a unique hash for a message based on its properties.
 * @param {Object} message - The message object.
 * @returns {string} - The generated hash.
 */
function generateMessageHash(message) {
  return `${message.title}|${message.kingdom}|${message.x}|${message.y}|${message.isLostKingdom}`;
}

// Start the OCR script execution loop
executeOCRScript();
