import { exec } from "child_process";
import path from "path";

function runAHKScript(x, y) {
    // Path to your AHK script
    const scriptPath = path.join(__dirname, 'scripts', 'script.ahk');
    
    // Path to AutoHotkey executable
    const autoHotkeyPath = 'C:\\Program Files\\AutoHotkey\\AutoHotkey.exe';
    
    // Construct the command to execute the AHK script with parameters
    const command = `"${autoHotkeyPath}" "${scriptPath}" ${x} ${y}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Script stderr: ${stderr}`);
            return;
        }
        console.log(`Script stdout: ${stdout}`);
    });
}

// Example command data; replace with dynamic values from Discord
const commandData = {
    userId: '402100175365079040',
    title: 'duke',
    kingdom: '1233',
    x: 123,
    y: 456
};

// Run the AHK script with coordinates
runAHKScript(commandData.x, commandData.y);
