import { Client, GatewayIntentBits as Intents } from "discord.js";
import dotenv from "dotenv";
import { exec } from "child_process";
import mongoose from "mongoose";
import User from "./models/User.js";

dotenv.config();

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

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
    console.log(
      `- ${guild.name} (ID: ${guild.id}, Members: ${guild.memberCount})`
    );
  });
});

// Queue and processing state for each kingdom and title
const queues = {
  3311: {
    Duke: [],
    Justice: [],
    Architect: [],
    Scientist: [],
  },
  3299: {
    Duke: [],
    Justice: [],
    Architect: [],
    Scientist: [],
  },
};

let isProcessing = {
  3311: {
    Duke: false,
    Justice: false,
    Architect: false,
    Scientist: false,
  },
  3299: {
    Duke: false,
    Justice: false,
    Architect: false,
    Scientist: false,
  },
};

// Command handling remains the same
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === "title") {
    const userId =
      interaction.options.getUser("user")?.id || interaction.user.id; // Use interaction userId if not specified
    const title = interaction.options.getString("title");

    await interaction.reply("Processing your title request...");

    try {
      const user = await User.findOne({ userId });
      if (
        user &&
        user.username &&
        user.kingdom &&
        user.x != null &&
        user.y != null
      ) {
        const request = {
          interaction,
          userId,
          title,
          kingdom: user.kingdom,
          x: user.x,
          y: user.y,
        };

        // Add request to the title-specific queue for the user's kingdom
        queues[user.kingdom][title].push(request);
        console.log(
          `Queue length for ${title} in kingdom ${user.kingdom}: ${
            queues[user.kingdom][title].length
          }`
        );

        // If the title is not currently being processed, start processing the queue
        if (!isProcessing[user.kingdom][title]) {
          processQueue(user.kingdom, title);
        }

        if (queues[user.kingdom][title].length > 1) {
          await interaction.followUp(
            `<@${userId}>, Your title request has been added to the queue for ${title} in kingdom ${user.kingdom}!`
          );
        }
      } else {
        await interaction.followUp(
          "You haven't registered your username, coordinates, and kingdom. Please use `/register [your_username] [x] [y] [your_kingdom]`."
        );
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      await interaction.followUp(
        "An error occurred while fetching your details. Please try again later."
      );
    }
  } else if (commandName === "titles") {
    const availableTitles = ["Duke", "Justice", "Architect", "Scientist"];
    await interaction.reply(`Available titles: ${availableTitles.join(", ")}`);
  } else if (commandName === "me") {
    const userId = interaction.user.id;

    try {
      const user = await User.findOne({ userId });
      if (user) {
        await interaction.reply(
          `Your registered username is: ${user.username} and your kingdom is: ${user.kingdom}`
        );
      } else {
        await interaction.reply(
          "You don't have a registered username and kingdom. Please use `/register [your_username] [your_kingdom]`."
        );
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      await interaction.reply(
        "An error occurred while fetching your details. Please try again later."
      );
    }
  } else if (commandName === "register") {
    const username = interaction.options.getString("username");
    const kingdom = interaction.options.getInteger("kingdom");
    const x = interaction.options.getInteger("x");
    const y = interaction.options.getInteger("y");
    const userId = interaction.user.id;

    try {
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
    } catch (error) {
      console.error("Error registering user:", error);
      await interaction.reply(
        "An error occurred while registering your details. Please try again later."
      );
    }
  }
});

// Handle message input for title requests
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Ignore bot messages

  // Define the mapping between the letters and the titles
  const titleMapping = {
    d: "duke",
    j: "justice",
    a: "architect",
    s: "scientist",
  };

  const commandKey = message.content.toLowerCase(); // Get the lowercase message content

  if (titleMapping[commandKey]) {
    const title = titleMapping[commandKey]; // Get the corresponding title for the key
    const userId = message.author.id; // Get the user who sent the message

    try {
      // Simulate the logic that would happen in the /title command
      const user = await User.findOne({ userId });

      if (
        user &&
        user.username &&
        user.kingdom &&
        user.x != null &&
        user.y != null
      ) {
        const request = {
          interaction: null,
          userId,
          title,
          kingdom: user.kingdom,
          x: user.x,
          y: user.y,
        };

        // Add request to the title-specific queue for the user's kingdom
        queues[user.kingdom][title].push(request);
        console.log(
          `Queue length for ${title} in kingdom ${user.kingdom}: ${
            queues[user.kingdom][title].length
          }`
        );

        // If the title is not currently being processed, start processing the queue
        if (!isProcessing[user.kingdom][title]) {
          processQueue(user.kingdom, title);
        }

        if (queues[user.kingdom][title].length > 1) {
          message.reply(
            `<@${userId}>, Your title request has been added to the queue for ${title} in kingdom ${user.kingdom}!`
          );
        } else {
          message.reply(`Processing your title request for ${title}...`);
        }
      } else {
        message.reply(
          "You haven't registered your username, coordinates, and kingdom. Please use `/register [your_username] [x] [y] [your_kingdom]`."
        );
      }
    } catch (error) {
      console.error("Error fetching user:", error);
      message.reply(
        "An error occurred while fetching your details. Please try again later."
      );
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
  Scientist: 200,
};

// Define the remainingTime variable inside processQueue and pass it to startTimer
async function processQueue(kingdom, title) {
  // Ensure the necessary initializations
  if (!queues[kingdom]) {
    queues[kingdom] = {};
    titles.forEach((t) => (queues[kingdom][t] = []));
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

    const adbResult = await runAdbCommand(
      userId,
      x,
      y,
      title,
      kingdom,
      interaction
    ); // Run ADB command

    if (!adbResult.success) {
      throw new Error("Title button not found in the ADB command.");
    }

    const message = await interaction.channel.send(
      `<@${userId}>, You're up for the title "${title}"! React with ✅ when done.`
    );
    await message.react("✅");

    const filter = (reaction, user) =>
      reaction.emoji.name === "✅" && user.id === userId;
    const collector = message.createReactionCollector({
      filter,
      time: 300 * 1000,
    });

    // Use the predefined duration for the title
    let remainingTime = titleDurations[title];

    collector.on("collect", () => {
      remainingTime = 0; // Set remaining time to 0 when collected
      clearInterval(timer); // Clear the timer
      collector.stop(); // Stop the collector
    });

    collector.on("end", (collected) => {
      clearInterval(timer); // Stop the timer
      interaction.channel.send(
        collected.size === 0
          ? `<@${userId}>, Time's up!`
          : `Done reaction collected. Moving to the next request.`
      );

      // Set a timeout of 10 seconds before setting ADB false
      setTimeout(() => {
        isProcessing[kingdom][title] = false;
        isAdbRunning[kingdom][title] = false;
        processQueue(kingdom, title);
      }, 10000); // 10 second delay
    });

    timer = startTimer(collector, remainingTime); // Start the timer with the duration for the title
  } catch (error) {
    console.error(
      `Error processing ${title} request for ${userId} in kingdom ${kingdom}: ${error.message}`
    );

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

async function runAdbCommand(userId, x, y, title, kingdom, interaction) {
  let deviceId;

  if (kingdom === 3311) {
    deviceId = "emulator-5574";
  } else if (kingdom === 3299) {
    deviceId = "emulator-5554";
  } else {
    console.error("Invalid kingdom. Please provide a valid kingdom.");
    return { success: false, error: "Invalid kingdom." };
  }

  if (!isAdbRunning[kingdom]?.[title]) {
    const isHome = await checkIfAtHome(deviceId, interaction, userId);
    if (!isHome) {
      console.log("Not at home. Returning home before processing the request.");
      await returnHome(deviceId);
      // Add a 2-second delay to allow for animation
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(
    `Running ADB command on ${deviceId} at coordinates (${x}, ${y}) for title: ${title}`
  );

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
    Justice: [
      `adb -s ${deviceId} shell input tap 440 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_justice.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    Duke: [
      `adb -s ${deviceId} shell input tap 784 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_duke.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    Architect: [
      `adb -s ${deviceId} shell input tap 1125 591`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_architect.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
    Scientist: [
      `adb -s ${deviceId} shell input tap 1472 592`,
      `adb -s ${deviceId} shell input tap 954 958`,
      `adb -s ${deviceId} exec-out screencap -p > ./screenshot_scientist.png`,
      `adb -s ${deviceId} shell input tap 89 978`,
    ],
  };

  async function executeCommandWithDelay(commands, index) {
    if (index >= commands.length) return Promise.resolve(); // Resolve the promise when all commands are done

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

    const titleCheckResult = await new Promise((resolve) => {
      exec("python ./check_title.py", (error, stdout) => {
        if (error) {
          console.error(`Error executing Python script: ${error.message}`);
          resolve({ success: false, error: "Python script execution error" });
          return;
        }

        console.log("Raw output from Python script:", stdout);

        const lines = stdout.split("\n").filter((line) => line.trim() !== "");
        let jsonLine = lines[lines.length - 1];

        let result;
        try {
          result = JSON.parse(jsonLine.trim());
        } catch (err) {
          console.error("Error parsing JSON:", err);
          resolve({ success: false, error: "JSON parsing error" });
          return;
        }

        if (result.error) {
          console.log(`Error from Python script: ${result.error}`);
          resolve({ success: false, error: result.error });
        } else {
          console.log(
            `Coordinates received: ${result.coordinates.x}, ${result.coordinates.y}`
          );

          // Execute the adb command to tap the screen
          exec(
            `adb -s ${deviceId} shell input tap ${result.coordinates.x} ${result.coordinates.y}`,
            (error) => {
              if (error) {
                console.error(`Error executing adb command: ${error.message}`);
                resolve({
                  success: false,
                  error: "ADB command execution error",
                });
              } else {
                // Proceed with further processing using the coordinates
                resolve({ success: true, coordinates: result.coordinates });
              }
            }
          );
        }
      });
    });

    // Check the result of the title check
    if (!titleCheckResult.success) {
      await returnHome(deviceId);
      return titleCheckResult; // Early return if title check failed
    }

    // Execute the title-specific commands after the title check with a delay
    await executeCommandWithDelay(titleCommands[title], 0);

    return { success: true };
  } catch (error) {
    console.error(`Error processing commands for ${userId}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function checkIfAtHome(deviceId, interaction, userId) {
  return new Promise((resolve, reject) => {
    // Take a screenshot before running the check_home.py script
    exec(
      `adb -s ${deviceId} exec-out screencap -p > ./check_home.png`,
      async (error) => {
        if (error) {
          console.error(`Error taking screenshot: ${error.message}`);
          await interaction.channel.send(`<@${userId}>, the bot is down. Please try again later.`);
          return reject(false);
        }

        // Run the check_home.py script after taking the screenshot
        exec("python check_home.py", (error, stdout, stderr) => {
          if (error) {
            console.error(`Error checking home: ${stderr}`);
            return reject(false);
          }

          try {
            const result = JSON.parse(stdout);
            if (result.success) {
              console.log("I am home.");
              resolve(true);
            } else {
              console.log("I am not home:", result.error);
              resolve(false);
            }
          } catch (e) {
            console.error("Error parsing JSON:", e);
            reject(false);
          }
        });
      }
    );
  });
}

async function returnHome(deviceId) {
  const isAtHome = await checkIfAtHome(deviceId);

  if (isAtHome) {
    console.log("Already at home. No need to return.");
    return;
  }

  exec(`adb -s ${deviceId} shell input tap 89 978`, (error) => {
    if (error) {
      console.error(`Error returning home: ${error.message}`);
    } else {
      console.log(`Tapped Home button on ${deviceId}.`);
    }
  });
}
