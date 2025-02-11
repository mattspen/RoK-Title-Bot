import os
import cv2
import sys
import subprocess
import json
import random

def check_state(screenshot_path, device_id):
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    template_paths = ['./resources/exit.png', 
                      './resources/exit2.png', './resources/elimination_button_exit.png', './resources/notice_board_exit.png', './resources/home_screen.png', './resources/continue_button.png' ]

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
            best_match["match"] = max_val >= 0.8
            best_match["location"] = max_loc if best_match["match"] else None
            best_match["confidence"] = max_val

        if template_path in ['./resources/exit.png', './resources/exit2.png', './resources/continue_button.png', 
                             './resources/notice_board_exit.png', './resources/elimination_button_exit.png'] and best_match["match"]:
            click_exit_button(device_id, best_match["location"], template.shape[:2])
            
            exit_button_clicked_path = f'./temp/exit_button_clicked_{device_id}.png'
            cv2.imwrite(exit_button_clicked_path, img_rgb)
            print(f"Exit button clicked screenshot saved as: {exit_button_clicked_path}")
            
            return {
                "button_found": True,
                "confidence": best_match["confidence"],
                "location": best_match["location"]
            }

        if template_path == './resources/home_screen.png' and best_match["match"]:
            print("Home screen detected. Starting Rise of Kingdoms...")
            start_rok(device_id)
            return {
                "button_found": True,
                "confidence": best_match["confidence"],
                "location": best_match["location"]
            }

    result = {
        "button_found": best_match["match"],
        "confidence": best_match["confidence"],
        "location": best_match["location"] if best_match["match"] else None
    }
    print(json.dumps(result, indent=4))

    if best_match["match"]:
        highlight_area(img_rgb, best_match["location"], template.shape[:2])

    return result

def click_exit_button(device_id, location, template_shape):
    x, y = location
    center_x = x + (template_shape[1] // 2)
    center_y = y + (template_shape[0] // 2)
    
    offset_x = random.randint(-5, 5)
    offset_y = random.randint(-5, 5)
    
    click_x = center_x + offset_x
    click_y = center_y + offset_y
    
    click_x = max(x, min(click_x, x + template_shape[1] - 1))
    click_y = max(y, min(click_y, y + template_shape[0] - 1))

    exec_command = f'adb -s {device_id} shell input tap {click_x} {click_y}'
    subprocess.run(exec_command, shell=True)
    print(f"Clicked exit button at ({click_x}, {click_y}) on {device_id}")

def start_rok(device_id):
    """Start Rise of Kingdoms using adb command."""
    exec_command = f'adb -s {device_id} shell monkey -p com.lilithgame.roc.gp 1'
    subprocess.run(exec_command, shell=True)
    print(f"Rise of Kingdoms started on {device_id}.")

def highlight_area(img, location, template_shape):
    top_left = location
    bottom_right = (top_left[0] + template_shape[1], top_left[1] + template_shape[0])

    cv2.rectangle(img, top_left, bottom_right, (0, 255, 0), 2)

    center_x = top_left[0] + (template_shape[1] // 2)
    center_y = top_left[1] + (template_shape[0] // 2)
    cv2.line(img, (center_x - 10, center_y), (center_x + 10, center_y), (0, 0, 255), 2)
    cv2.line(img, (center_x, center_y - 10), (center_x, center_y + 10), (0, 0, 255), 2)

    highlighted_image_path = './temp/highlighted_matched_area.png'
    cv2.imwrite(highlighted_image_path, img)
    print(f"Highlighted image saved as: {highlighted_image_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(1)

    screenshot_path = sys.argv[1]
    device_id = sys.argv[2]
    result = check_state(screenshot_path, device_id)
