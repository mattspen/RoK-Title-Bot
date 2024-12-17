import { exec } from "child_process";

export function runCheckState() {
    const deviceId = process.env.EMULATOR_DEVICE_ID;
    if (!deviceId) {
      console.error("No device ID found.");
      return;
    }
  
    const screenshotPath = `./temp/current_state_${deviceId}.png`;
  
    exec(
      `adb -s ${deviceId} exec-out screencap -p > ${screenshotPath}`,
      (error) => {
        if (error) {
          console.error(`Error taking screenshot: ${error.message}`);
          return;
        }
  
        exec(
          `python check_home.py ${deviceId} ${screenshotPath}`,
          (error, stdout, stderr) => {
            if (error) {
              console.error(`Error with check_home.py: ${error.message}`);
              return;
            }
            if (stderr) {
              console.error(`Stderr from check_home.py: ${stderr}`);
              return;
            }
  
            exec(
              `python check_state.py ${screenshotPath} ${deviceId}`,
              (error, stdout, stderr) => {
                if (error) {
                  console.error(`Error with check_state.py: ${error.message}`);
                  return;
                }
                if (stderr) {
                  console.error(`Stderr from check_state.py: ${stderr}`);
                  return;
                }
  
                exec(
                  `python connection_check.py ${screenshotPath} ${deviceId}`,
                  (error, stdout, stderr) => {
                    if (error) {
                      console.error(
                        `Error with connection_check.py: ${error.message}`
                      );
                      return;
                    }
                    if (stderr) {
                      console.error(`Stderr from connection_check.py: ${stderr}`);
                      return;
                    }
                  }
                );
              }
            );
          }
        );
      }
    );
  }