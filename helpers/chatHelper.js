import { exec } from "child_process";
import { execAsync } from "../bot.js";

export async function checkAndCloseChat(deviceId) {
  console.log("Starting chat close check...");

  // Take an initial screenshot to check if the chat is open
  const initialScreenshotFilename = `./temp/initial_screenshot_${deviceId}.png`;
  const initialScreenshotCommand = `adb -s ${deviceId} exec-out screencap -p > ${initialScreenshotFilename}`;

  try {
    // Await for the initial screenshot command to complete
    await execAsync(initialScreenshotCommand);
  } catch (error) {
    console.error(
      `Error taking initial screenshot on ${deviceId}: ${error.message}`
    );
    return { success: false, error: "Initial screenshot error" };
  }

  // Run the chat check with the initial screenshot
  const chatCheckResult = await new Promise((resolve) => {
    exec(
      `python close_chat.py ${initialScreenshotFilename} ${deviceId}`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error running close_chat.py: ${error.message}`);
          resolve({
            success: false,
            error: "Chat close script execution error",
          });
          return;
        }
        if (stderr) {
          console.error(`Stderr from close_chat.py: ${stderr}`);
          resolve({ success: false, error: "Chat close script stderr" });
          return;
        }

        try {
          // Parse the Python script's JSON output
          const result = JSON.parse(stdout.trim());

          // Check if the chat is open
          if (result.error && result.error === "Chat is not open.") {
            console.log("Chat is not open.");
            resolve({ success: false, error: "Chat is not open." });
            return;
          }

          // Check if the captcha (exit button) was found and clicked
          if (result.captcha_found) {
            console.log(
              `Chat closed successfully on ${deviceId}. Confidence: ${result.confidence}`
            );
            resolve({ success: true });
          } else if (
            result.error ===
            "Chat exit button not found. The chat might not be open."
          ) {
            console.log(
              "Chat exit button not found. The chat might not be open."
            );
            resolve({ success: true });
          } else {
            console.log(`Chat was not closed. Details: ${stdout}`);
            resolve({
              success: false,
              error: "Chat not closed",
              details: result,
            });
          }
        } catch (parseError) {
          console.error(
            `Error parsing JSON from close_chat.py: ${parseError.message}`
          );
          resolve({
            success: false,
            error: "JSON parse error from Python script",
          });
        }
      }
    );
  });

  if (!chatCheckResult.success) {
    console.log("Chat is still open or encountered an error.");
  }

  return chatCheckResult; // Return the result of the chat check
}
