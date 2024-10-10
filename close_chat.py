import os
import cv2
import json
import sys
import time
import subprocess  # For executing ADB commands

def close_chat(screenshot_path, device_id):
    """Main function to check for and close chat if the exit button is detected."""

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"Screenshot file '{screenshot_path}' not found or could not be opened.")

    # Convert screenshot to grayscale for template matching
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    # Path to the chat exit button template
    template_path = './resources/chat_exit.png'

    # Load and process the template
    template = cv2.imread(template_path)
    if template is None:
        raise FileNotFoundError(f"Template file '{template_path}' not found or could not be opened.")

    # Convert template to grayscale
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    # Perform template matching
    res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)

    # Check if a match was found with confidence above 0.85
    if max_val >= 0.85:
        click_result = click_exit_button(device_id, max_loc)  # Click the detected exit button

        # Highlight the exit button in the screenshot
        top_left = max_loc
        bottom_right = (top_left[0] + template.shape[1], top_left[1] + template.shape[0])
        cv2.rectangle(img_rgb, top_left, bottom_right, (0, 0, 255), 2)  # Red rectangle around the matched area

        # Add text to the screenshot
        text = "from the close_chat.py"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.5
        font_color = (255, 255, 255)  # White color
        font_thickness = 1
        text_x = 10  # x coordinate
        text_y = 30  # y coordinate

        # Draw the text on the image
        cv2.putText(img_rgb, text, (text_x, text_y), font, font_scale, font_color, font_thickness)

        # Save the screenshot with highlighted exit button and text
        exit_button_clicked_path = f'./temp/exit_button_clicked_{device_id}.png'
        cv2.imwrite(exit_button_clicked_path, img_rgb)

        # Wait for a moment to allow the tap to register
        time.sleep(1)  # Adjust the time as necessary

        # Check if the chat is still open
        chat_status = check_chat_status(device_id)  # Add this function

        # Return the result indicating the exit button was found and clicked
        return {
            "captcha_found": True,
            "confidence": max_val,
            "location": max_loc,
            "screenshot_saved": exit_button_clicked_path,
            "adb_command_status": click_result['status'],
            "adb_command_error": click_result['error'],
            "chat_status_after": chat_status  # Add the chat status after trying to close
        }
    else:
        # Return that no exit button was found
        return {
            "chat_open": False,
            "captcha_found": False,
            "confidence": max_val,
            "location": None,
            "error": "Chat exit button not found. The chat might not be open."
        }

def click_exit_button(device_id, location):
    """Simulate a tap at the detected exit button location using ADB."""
    x, y = location
    exec_command = f'adb -s {device_id} shell input tap {x} {y}'
    
    # Execute the tap command and capture output
    result = subprocess.run(exec_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Check the result and prepare response
    if result.returncode == 0:
        return {"status": "success", "error": None}
    else:
        return {"status": "error", "error": result.stderr.decode().strip()}

def check_chat_status(device_id):
    """Check if the chat is still open by verifying the state."""
    # Implement a command that checks the state of the chat
    # This is an example, you need to customize it based on your app
    exec_command = f'adb -s {device_id} shell <your_check_command_here>'
    
    # Execute the check command and capture output
    result = subprocess.run(exec_command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    # Determine chat status from result
    if result.returncode == 0:
        return {"status": "closed", "error": None}
    else:
        return {"status": "open", "error": result.stderr.decode().strip()}

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python close_chat.py <screenshot_path> <device_id>")
        sys.exit(1)

    # Get the screenshot path and device ID from the command-line arguments
    screenshot_path = sys.argv[1]
    device_id = sys.argv[2]

    # Call the close_chat function and get the result
    result = close_chat(screenshot_path, device_id)

    # Output the result as a JSON string
    print(json.dumps(result, indent=4))
