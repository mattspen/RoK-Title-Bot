import os
import cv2
import numpy as np
import json

def check_connection_loss():
    screenshot_path = 'screenshot_connection.png'
    template_path = './resources/confirm-button.png'

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError("screenshot_connection.png not found or could not be opened")

    # Load the template
    template = cv2.imread(template_path)
    if template is None:
        raise FileNotFoundError(f"{template_path} not found or could not be opened")

    # Convert images to grayscale for matching
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    # Perform template matching
    res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)

    # Define a threshold for match acceptance
    threshold = 0.7

    # If a match is found, return the coordinates
    if max_val >= threshold:
        return {"x": int(max_loc[0]), "y": int(max_loc[1])}
    else:
        return None

if __name__ == "__main__":
    result = check_connection_loss()
    if result:
        print(json.dumps(result))  # Output coordinates in JSON format
    else:
        print(json.dumps({"error": "Button not found"}))
