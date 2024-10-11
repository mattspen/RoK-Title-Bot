# Rise of Kingdoms Title Oracle

The **Rise of Kingdoms Title Oracle** is a Discord bot designed to manage and automate title requests, registration, and title locking mechanisms within the game *Rise of Kingdoms*. This bot supports both player-initiated and admin-controlled title assignments, title request logging, and some administrative utilities for managing the bot's behavior and commands.

## Features

- **Player Registration:** Players can register themselves with a username and coordinates.
- **Admin Registration:** Superusers can register other users by Discord ID, set their username, and their in-game coordinates.
- **Title Requests:** Players can request specific in-game titles like Duke, Justice, Architect, and Scientist.
- **Title Locking:** Admins can lock/unlock specific titles to prevent requests while they're locked.
- **Request Logs:** Superusers can view logs of successful and unsuccessful title requests.
- **Bot Reset:** Superusers can reset the Rise of Kingdoms application on an emulator using ADB commands.

## Commands

### Player Commands
- **`register <username> <x> <y>`**  
  Registers the player in the system with their chosen username and coordinates.

- **`<title>`**  
  Request a title from the game. The supported titles and their variations are:
  - **Duke** (aliases: `d`, `duk`)
  - **Justice** (aliases: `j`, `jus`)
  - **Architect** (aliases: `a`, `arch`)
  - **Scientist** (aliases: `s`, `sci`)

### Admin/Superuser Commands
- **`registeruser <discordid> <username> <x> <y>`**  
  Registers another user by their Discord ID and sets their username and coordinates.

- **`logs`**  
  Displays the number of successful and unsuccessful title requests.

- **`locktitle <title>`**  
  Locks the specified title, preventing players from requesting it.

- **`unlocktitle <title>`**  
  Unlocks a previously locked title, allowing players to request it again.

- **`resetbot`**  
  Restarts the Rise of Kingdoms application on the emulator.

## Prerequisites

- **Node.js** v14 or higher
- **MongoDB** for user and log data storage
- **ADB (Android Debug Bridge)** if using the `resetbot` feature for interacting with an emulator
- **Python 3.x** installed on your system.
- **OpenCV** for Python installed (`opencv-python`, `opencv-python-headless`).
- **NumPy** installed (`numpy` is typically a dependency of OpenCV).

## Installation

1. Clone the repository.
    ```bash
    git clone https://github.com/your-repo/rise-of-kingdoms-title-oracle.git
    cd rise-of-kingdoms-title-oracle
    ```

2. Install dependencies.
    ```bash
    npm install
    pip install opencv-python opencv-python-headless numpy
    ```

3. Set up your `.env` file with the following values:

    ```bash
    DISCORD_BOT_TOKEN=<your-bot-token>
    DISCORD_CHANNEL_ID=<the-channel-id-where-bot-will-listen>
    KINGDOM=<your-in-game-kingdom-id>
    SUPERUSER_ID=<comma-separated-list-of-superuser-discord-ids>
    EMULATOR_DEVICE_ID=<optional, if using resetbot feature>
    ```

## Environment Variables

- **`DISCORD_BOT_TOKEN`**: The token for your Discord bot.
- **`DISCORD_CHANNEL_ID`**: The channel where the bot listens for commands.
- **`KINGDOM`**: The in-game kingdom that this bot manages.
- **`SUPERUSER_ID`**: A list of comma-separated Discord IDs for users who have admin/superuser privileges.
- **`EMULATOR_DEVICE_ID`**: The ADB device ID of the emulator running Rise of Kingdoms (optional, only needed for bot reset functionality).

## Error Handling

The bot will send an error message to the user in case of:
- Invalid commands
- Invalid username or coordinates format
- Unauthorized access to superuser/admin commands
- Errors while processing title requests or interacting with the emulator.

Logs will be maintained in the database for title request successes and failures for easy monitoring by admins.

## License

This project is licensed under the MIT License.

---

Enjoy seamless title management in Rise of Kingdoms with the Title Oracle!
