import "dotenv/config";
import fetch from "node-fetch";

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.APP_ID;
const GUILD_ID = process.env.GUILD_ID;

const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;

const commands = {
  name: "title",
  description: "Assign a title to a user",
  options: [
    {
      name: "user",
      description: "The user to assign the title to",
      type: 6, // USER type
      required: true,
    },
    {
      name: "title",
      description: "The title to assign to the user",
      type: 3, // STRING type
      required: true,
    },
    {
      name: "kingdom",
      description: "Kingdom identifier",
      type: 3, // STRING type
      required: true,
    },
    {
      name: "x",
      description: "X coordinate",
      type: 4, // INTEGER type
      required: true,
    },
    {
      name: "y",
      description: "Y coordinate",
      type: 4, // INTEGER type
      required: true,
    },
  ],
};

async function registerCommands() {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:`Bot ${DISCORD_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    console.log(`HTTP Status: ${response.status}`);
    console.log(`Response Headers: ${JSON.stringify(response.headers.raw())}`);

    if (response.ok) {
      const data = await response.json();
      console.log("Commands registered successfully:", data);
    } else {
      const errorData = await response.json();
      console.error("Error registering commands:", errorData);
      if (errorData.errors) {
        console.error(
          "Detailed Errors:",
          JSON.stringify(errorData.errors, null, 2)
        );
      }
    }
  } catch (error) {
    console.error("Failed to register commands:", error);
  }
}

registerCommands();