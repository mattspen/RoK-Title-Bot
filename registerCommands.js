import "dotenv/config";
import fetch from "node-fetch";
import { Client, GatewayIntentBits } from "discord.js";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.APP_ID;

// Create a new Discord client
const client = new Client({
  intents: [GatewayIntentBits.Guilds] // Required to access guilds
});

// Command to assign a title (only asking for title, user coordinates are fetched from DB)
const assignTitleCommand = {
  name: "title",
  description: "Assign a title to yourself (coordinates are fetched from registration)",
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
      console.error(`Failed to delete command ${commandId} for guild ${guildId}:`, await response.json());
    }
  } catch (error) {
    console.error(`Error deleting command ${commandId} for guild ${guildId}:`, error);
  }
}

async function registerGlobalCommands() {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/commands`;

  try {
    await registerCommand(url, assignTitleCommand);
    await registerCommand(url, showTitlesCommand);
    await registerCommand(url, registrationCommand);
    await registerCommand(url, meCommand);
  } catch (error) {
    console.error(`Failed to register global commands:`, error);
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

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register commands for each connected guild
  for (const guild of client.guilds.cache.values()) {
    console.log(`Processing guild: ${guild.name} (ID: ${guild.id})`);
    await deleteExistingCommands(guild.id);
  }

  // Register commands globally
  await registerGlobalCommands();
});

// Log in to Discord
client.login(DISCORD_TOKEN);
