import "dotenv/config";
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

const DISCORD_TOKEN =
  "MTI4MTIxNjI3NzAyNDczNTI2Mg.GqGp_l.8-2ya6_dlTXbv6HsiXrFimcXgpbUVrhrdhzomY";
const APP_ID = "1281216277024735262";
const SERVER_IDS = [
  "1175627891782987837",
  "1175627891782987837",
  "1281219698830348359",
  "1287494300539682821",
];

// Create a new Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds], // Required to access guilds
});

// Command definitions
const assignTitleCommand = {
  name: "title",
  description:
    "Assign a title to yourself (coordinates are fetched from registration)",
  options: [
    {
      name: "title",
      description: "The title to assign",
      type: 3, // STRING type
      required: true,
      choices: [
        { name: "Justice", value: "Justice" },
        { name: "Duke", value: "Duke" },
        { name: "Architect", value: "Architect" },
        { name: "Scientist", value: "Scientist" },
      ],
    },
  ],
};

const resetBotCommand = {
  name: "resetbot",
  description: "Reset the bot",
};

const lockTitleCommand = {
  name: "locktitle",
  description: "Lock a title for the registered kingdom",
  options: [
    {
      name: "title",
      description: "The title to lock",
      type: 3, // STRING type
      required: true,
      choices: [
        { name: "Justice", value: "Justice" },
        { name: "Duke", value: "Duke" },
        { name: "Architect", value: "Architect" },
        { name: "Scientist", value: "Scientist" },
      ],
    },
  ],
};

const unlockTitleCommand = {
  name: "unlocktitle",
  description: "Unlock a title for the registered kingdom",
  options: [
    {
      name: "title",
      description: "The title to unlock",
      type: 3, // STRING type
      required: true,
      choices: [
        { name: "Justice", value: "Justice" },
        { name: "Duke", value: "Duke" },
        { name: "Architect", value: "Architect" },
        { name: "Scientist", value: "Scientist" },
      ],
    },
  ],
};

const setTimerCommand = {
  name: "settimer",
  description: "Set a timer for a specific title",
  options: [
    {
      name: "title",
      description: "The title to set the timer for",
      type: 3, // STRING type
      required: true,
      choices: [
        { name: "Justice", value: "Justice" },
        { name: "Duke", value: "Duke" },
        { name: "Architect", value: "Architect" },
        { name: "Scientist", value: "Scientist" },
      ],
    },
    {
      name: "duration",
      description: "Duration for the title (in seconds)",
      type: 4, // INTEGER type
      required: true,
    },
  ],
};

const showTitlesCommand = {
  name: "titles",
  description: "Show all possible titles",
};

const meCommand = {
  name: "me",
  description: "Get or register your username and kingdom",
};

// Command to register a user with username, kingdom, and x and y coordinates
const registrationCommand = {
  name: "register",
  description: "Register your username, kingdom, and coordinates",
  options: [
    {
      name: "username",
      description: "Your desired username",
      type: 3, // STRING type
      required: true,
    },
    {
      name: "x",
      description: "Your X coordinate",
      type: 4, // INTEGER type
      required: true,
    },
    {
      name: "y",
      description: "Your Y coordinate",
      type: 4, // INTEGER type
      required: true,
    },
  ],
};

// Function to create a delay
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Function to delete existing global commands
async function deleteGlobalCommands() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const commands = await response.json();
      // Loop through and delete each command
      for (const command of commands) {
        console.log(`Deleting command ${command.id}`);
        await deleteCommand(command.id);
        await delay(2000); // Wait for 2 seconds before deleting the next command
      }
    }
  } catch (error) {
    console.error("Failed to fetch global commands:", error);
  }
}

// Function to delete a specific command
async function deleteCommand(commandId) {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands/${commandId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
      },
    });

    if (response.ok) {
      console.log(`Deleted command ${commandId}`);
    } else {
      console.error(
        `Failed to delete command ${commandId}:`,
        await response.json()
      );
    }
  } catch (error) {
    console.error(`Error deleting command ${commandId}:`, error);
  }
}

// Function to register global commands
async function registerGlobalCommands() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  try {
    // await registerCommand(url, assignTitleCommand);
    // await delay(2000); // Wait for 2 seconds before registering the next command
    // await registerCommand(url, showTitlesCommand);
    // await delay(2000); // Wait for 2 seconds before registering the next command
    // await registerCommand(url, registrationCommand);
    // await delay(2000); // Wait for 2 seconds before registering the next command
    await registerCommand(url, meCommand);
    await delay(2000); // Wait for 2 seconds before registering the next command
    await registerCommand(url, setTimerCommand);
    await delay(2000); // Wait for 2 seconds before registering the next command
    await registerCommand(url, unlockTitleCommand);
    await delay(2000); // Wait for 2 seconds before registering the next command
    await registerCommand(url, lockTitleCommand);
    await delay(2000); // Wait for 2 seconds before registering the next command
    await registerCommand(url, resetBotCommand);
    await delay(2000); // Wait for 2 seconds before registering the next command
  } catch (error) {
    console.error("Failed to register global commands:", error);
  }
}

// Function to register a specific command
async function registerCommand(url, command) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bot ${DISCORD_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  console.log(`HTTP Status: ${response.status}`);

  if (response.ok) {
    const data = await response.json();
    console.log("Command registered successfully:", data);
  } else {
    const errorData = await response.json();
    console.error("Error registering command:", errorData);
  }
}

// Event handler when the bot is ready
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Delete existing global commands
  await deleteGlobalCommands();

  // // Register new global commands
  // await registerGlobalCommands();
});

// Log in to Discord
client.login(DISCORD_TOKEN);
