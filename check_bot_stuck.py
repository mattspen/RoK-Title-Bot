import os
import cv2
import numpy as np
import json
import sys

def is_bot_stuck(screenshot_path):
    template_paths = ['./resources/bot_stuck.png']

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
            best_match["match"] = max_val >= 0.9  # Adjust confidence threshold if necessary
            best_match["location"] = max_loc if best_match["match"] else None
            best_match["confidence"] = max_val

    # Prepare the response for checking if the bot is stuck
    result = {
        "success": best_match["match"],
        "confidence": best_match["confidence"],
        "location": best_match["location"] if best_match["match"] else None,
        "error": None if best_match["match"] else "Bot stuck template not found."
    }

    return result

if __name__ == "__main__":
    screenshot_path = sys.argv[1]  # Get screenshot path from command line argument
    result = is_bot_stuck(screenshot_path)
    print(json.dumps(result))  # Ensure this is the only output
