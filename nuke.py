import os
import subprocess
import time
import pyautogui
import pygetwindow as gw
import schedule

def kill_bluestacks_processes():
    """Kill all BlueStacks processes."""
    print("Stopping all BlueStacks processes...")
    processes = ["HD-Player.exe", "HD-Frontend.exe", "HD-Plus-Service.exe", "HD-MultiInstanceManager.exe"]
    for process in processes:
        subprocess.run(f"taskkill /f /im {process}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print("All BlueStacks processes have been stopped.")

def open_multi_instance_manager():
    """Open BlueStacks Multi-Instance Manager."""
    print("Opening Multi-Instance Manager...")
    subprocess.Popen(r'"C:\\Program Files\\BlueStacks_nxt\\HD-MultiInstanceManager.exe"', shell=True)
    time.sleep(10)  # Wait for Multi-Instance Manager to launch

def focus_multi_instance_manager():
    """Bring the Multi-Instance Manager window to the front."""
    print("Focusing on Multi-Instance Manager window...")
    window = next((w for w in gw.getAllWindows() if "BlueStacks Multi Instance Manager" in w.title), None)
    if window:
        try:
            window.activate()
            time.sleep(2)  # Allow time for the window to come to the front
            print("Window focused successfully.")
            return True
        except Exception as e:
            print(f"Error activating the window: {e}. Trying alternative method...")
            pyautogui.hotkey('alt', 'tab')  # Use Alt+Tab as a fallback
            time.sleep(2)
            return True
    else:
        print("Multi-Instance Manager window not found. Check the title.")
        return False

def click_start_buttons():
    """Locate and click all 'Start' buttons in the Multi-Instance Manager."""
    print("Locating and clicking 'Start' buttons...")
    start_button_image = "./resources/start_button.png"  # Screenshot of the Start button saved here

    try:
        while True:
            location = pyautogui.locateCenterOnScreen(start_button_image, confidence=0.8)
            if location:
                print(f"Found 'Start' button at {location}. Clicking...")
                pyautogui.moveTo(location)
                pyautogui.click()
                time.sleep(5)  # Wait for the instance to fully launch
            else:
                print("No more 'Start' buttons found.")
                break
    except Exception as e:
        print(f"Error clicking Start buttons: {e}")

def restart_adb_server():
    """Restart the ADB server."""
    print("Restarting ADB server...")
    subprocess.run("adb kill-server", shell=True)
    time.sleep(2)
    subprocess.run("adb start-server", shell=True)
    print("ADB server restarted successfully.")

def restart_all_instances():
    """Restart all BlueStacks instances."""
    kill_bluestacks_processes()
    open_multi_instance_manager()

    if focus_multi_instance_manager():
        click_start_buttons()
    else:
        print("Could not bring Multi-Instance Manager to the front.")

    print("All instances started successfully.")
    restart_adb_server()

def scheduled_job():
    """Scheduled job to restart BlueStacks instances."""
    print("Running scheduled job to restart BlueStacks...")
    restart_all_instances()

if __name__ == "__main__":
    schedule.every().day.at("01:00").do(scheduled_job)

    print("Scheduler is running. Waiting for the next job...")
    while True:
        schedule.run_pending()
        time.sleep(1)
