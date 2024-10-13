import os
import cv2
import numpy as np
import json
import sys

def check_home(device_id):
    screenshot_path = f'./temp/check_home_{device_id}.png'
    template_paths = ['./resources/map_button.png', './resources/map_button_0.png']

    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    best_match = {
        "match": False,
        "location": None,
        "confidence": 0
    }

    for template_path in template_paths:
        template = cv2.imread(template_path)
        if template is None:
            raise FileNotFoundError(f"{template_path} not found or could not be opened")

        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        if max_val > best_match["confidence"]:
            best_match["match"] = max_val >= 0.9  # Adjust confidence threshold if necessary
            best_match["location"] = max_loc if best_match["match"] else None
            best_match["confidence"] = max_val

    result = {
        "success": best_match["match"],
        "confidence": best_match["confidence"],
        "location": best_match["location"] if best_match["match"] else None,
        "error": None if best_match["match"] else "Home coordinates not found."
    }

    return result

if __name__ == "__main__":
    device_id = sys.argv[1]
    result = check_home(device_id)
    print(json.dumps(result))
