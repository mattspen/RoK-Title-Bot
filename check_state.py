import os
import cv2
import numpy as np
import json
import sys
import subprocess  # For executing ADB commands

def check_state(device_id):
    screenshot_path = f'./current_state_{device_id}.png'
    template_paths = ['./resources/exit.png', './resources/notice_board_exit.png', './resources/verification_chest_button.png', './resources/verification_close_refresh_ok_button.png']

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    # Convert screenshot to grayscale for matching
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    # Initialize variables to store the best match
    best_match = {
        "match": False,
        "location": None,
        "confidence": 0
    }

    for template_path in template_paths:
        # Load the template
        template = cv2.imread(template_path)
        if template is None:
            raise FileNotFoundError(f"{template_path} not found or could not be opened")

        # Convert template to grayscale for matching
        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        # Perform template matching
        res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        # Update the best match if the current match is better
        if max_val > best_match["confidence"]:
            best_match["match"] = max_val >= 0.85  # Adjust confidence threshold if necessary
            best_match["location"] = max_loc if best_match["match"] else None
            best_match["confidence"] = max_val

        # If exit.png or notice_board_exit.png is found, return the coordinates immediately
        if template_path in ['./resources/exit.png', './resources/notice_board_exit.png'] and best_match["match"]:
            click_exit_button(device_id, best_match["location"])  # Click the exit button
            return {
                "captcha_found": True,
                "confidence": best_match["confidence"],
                "location": best_match["location"],
                "error": None
            }

    # Prepare the response for checking if captcha is present
    result = {
        "captcha_found": best_match["match"],
        "confidence": best_match["confidence"],
        "location": best_match["location"] if best_match["match"] else None,
        "error": None if best_match["match"] else "Captcha not found."
    }

    # If a captcha was found, save the screenshot with the matched area highlighted
    if best_match["match"]:
        highlight_area(img_rgb, best_match["location"], template.shape[:2])

    return result

def click_exit_button(device_id, location):
    x, y = location
    exec_command = f'adb -s {device_id} shell input tap {x} {y}'
    subprocess.run(exec_command, shell=True)  # Execute the tap command
    print(f"Clicked exit button at ({x}, {y}) on {device_id}")

def highlight_area(img, location, template_shape):
    top_left = location
    bottom_right = (top_left[0] + template_shape[1], top_left[1] + template_shape[0])

    # Draw a rectangle around the matched region
    cv2.rectangle(img, top_left, bottom_right, (0, 255, 0), 2)

    # Save the modified image with the highlighted area
    highlighted_image_path = 'highlighted_matched_area.png'
    cv2.imwrite(highlighted_image_path, img)
    print(f"Highlighted image saved as: {highlighted_image_path}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_state.py <device_id>")
        sys.exit(1)

    device_id = sys.argv[1]
    result = check_state(device_id)
