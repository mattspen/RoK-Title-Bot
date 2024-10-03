import { exec } from "child_process";
import { checkIfAtHome } from "./checkIfHome.js";

export async function returnHome(deviceId) {
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
