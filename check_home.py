import cv2
import json
import sys
import subprocess
import random

def check_home(device_id, screenshot_path):
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found.")

    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)
    best_match = {"match": False, "location": None, "confidence": 0}
    template_paths = ['./resources/map_button.png', './resources/map_button_0.png']

    for template_path in template_paths:
        template = cv2.imread(template_path)
        if template is None:
            raise FileNotFoundError(f"{template_path} not found.")
        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        if max_val > best_match["confidence"]:
            best_match["match"] = max_val >= 0.9
            best_match["location"] = max_loc if best_match["match"] else None
            best_match["confidence"] = max_val

    if best_match["match"]:
        tap_random_region(device_id)

    return {
        "success": best_match["match"],
        "confidence": best_match["confidence"],
        "location": best_match["location"],
        "error": None if best_match["match"] else "Home coordinates not found."
    }

def tap_random_region(device_id):
    x = random.randint(40, 135)
    y = random.randint(929, 1026)
    adb_command = f"adb -s {device_id} shell input tap {x} {y}"
    subprocess.run(adb_command, shell=True)

if __name__ == "__main__":
    device_id = sys.argv[1]
    screenshot_path = sys.argv[2]
    result = check_home(device_id, screenshot_path)
    print(json.dumps(result))
