import { exec } from "child_process";

export function refreshApp(channel) {
    const deviceId = process.env.EMULATOR_DEVICE_ID;
  
    if (!deviceId) {
      console.error("No device ID found. Skipping refresh.");
      return;
    }

    const embed = {
      color: 0x3498db,
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
        }, 5000);
      }
    );
  }