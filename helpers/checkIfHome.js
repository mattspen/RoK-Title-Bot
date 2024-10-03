import { exec } from "child_process";

export async function checkIfAtHome(deviceId, interaction, message, userId) {
  return new Promise((resolve, reject) => {
    // Take a screenshot before running the check_home.py script
    exec(
      `adb -s ${deviceId} exec-out screencap -p > ./temp/check_home_${deviceId}.png`,
      async (error) => {
        if (error) {
          console.error(`Error taking screenshot: ${error.message}`);
          if (interaction) {
            await interaction.channel.send(
              `<@${userId}>, the bot is down. Please try again later.`
            );
          } else {
            await message.channel.send(
              `<@${userId}>, the bot is down. Please try again later.`
            );
          }
          return reject(false);
        }

        // Run the check_home.py script after taking the screenshot
        exec(`python ./check_home.py ${deviceId}`, (error, stdout, stderr) => {
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
