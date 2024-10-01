import "dotenv/config";
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

const DISCORD_TOKEN =
  "MTI4MTIxNjI3NzAyNDczNTI2Mg.GqGp_l.8-2ya6_dlTXbv6HsiXrFimcXgpbUVrhrdhzomY";
const APP_ID = "1281216277024735262";
const SERVER_IDS = [
  "944346140734783530",
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
    {
      name: "kingdom",
      description: "Your kingdom (must be 4 digits)",
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
      name: "kingdom",
      description: "Your kingdom (must be 4 digits)",
      type: 4, // INTEGER type
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

async function deleteExistingCommands(guildId) {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${guildId}/commands`;

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
      for (const command of commands) {
        await deleteCommand(command.id, guildId);
      }
    }
  } catch (error) {
    console.error(`Failed to fetch commands for guild ${guildId}:`, error);
  }
}

async function deleteCommand(commandId, guildId) {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${guildId}/commands/${commandId}`;

  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${DISCORD_TOKEN}`,
      },
    });

    if (response.ok) {
      console.log(`Deleted command ${commandId} for guild ${guildId}`);
    } else {
      console.error(
        `Failed to delete command ${commandId} for guild ${guildId}:`,
        await response.json()
      );
    }
  } catch (error) {
    console.error(
      `Error deleting command ${commandId} for guild ${guildId}:`,
      error
    );
  }
}

async function registerGuildCommands(guildId) {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${guildId}/commands`;

  try {
    await registerCommand(url, assignTitleCommand);
    await delay(2000); // Wait for 1 second
    await registerCommand(url, showTitlesCommand);
    await delay(2000); // Wait for 1 second
    await registerCommand(url, registrationCommand);
    await delay(2000); // Wait for 1 second
    await registerCommand(url, meCommand);
    await delay(2000); // Wait for 1 second
    await registerCommand(url, setTimerCommand);
    await delay(2000); // Wait for 1 second
    await registerCommand(url, unlockTitleCommand);
    await delay(2000); // Wait for 1 second
    await registerCommand(url, lockTitleCommand);
  } catch (error) {
    console.error(`Failed to register commands for guild ${guildId}:`, error);
  }
}

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

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register commands for each server ID in SERVER_IDS
  for (const guildId of SERVER_IDS) {
    console.log(`Processing guild ID: ${guildId}`);

    // Delete existing commands
    await deleteExistingCommands(guildId);

    // Register commands for the current guild
    await registerGuildCommands(guildId);
  }
});

// Log in to Discord
client.login(DISCORD_TOKEN);
