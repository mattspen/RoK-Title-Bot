import os
import cv2
import json
import sys
import subprocess


def load_image(image_path, color=cv2.IMREAD_COLOR):
    """Load an image with error handling."""
    image = cv2.imread(image_path, color)
    if image is None:
        raise FileNotFoundError(f"{image_path} not found or could not be opened")
    return image


def match_template(image, templates, threshold):
    """Perform template matching on a list of templates."""
    for template_path in templates:
        try:
            template = load_image(template_path, color=cv2.IMREAD_GRAYSCALE)
            result = cv2.matchTemplate(image, template, cv2.TM_CCOEFF_NORMED)
            _, max_val, _, max_loc = cv2.minMaxLoc(result)

            if max_val >= threshold:
                h, w = template.shape
                center_x = max_loc[0] + w // 2
                center_y = max_loc[1] + h // 2
                return center_x, center_y, max_loc, (w, h), max_val
        except FileNotFoundError as e:
            print(e)
    return None


def find_add_title_button(screenshot_path, device_id, click=True):
    """Locate the 'Add Title' button and optionally tap."""
    img_rgb = load_image(screenshot_path)
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    templates = ['./resources/add-title-button.png', './resources/add-title-button2.png']
    match = match_template(img_gray, templates, threshold=0.9)

    if match:
        center_x, center_y, max_loc, (w, h), max_val = match
        cv2.rectangle(img_rgb, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 255, 0), 2)
        cv2.imwrite(f'temp/screenshot_found_{device_id}.png', img_rgb)

        if click:
            adb_command = f'adb -s {device_id} shell input tap {center_x} {center_y}'
            try:
                subprocess.run(adb_command, shell=True, check=True)
            except subprocess.CalledProcessError as e:
                raise RuntimeError(f"ADB command failed: {e}")

        return {"x": center_x, "y": center_y}
    return {"error": "Button not found"}


def check_negative_titles(screenshot_path, coordinates, device_id):
    """Check for negative titles in a zoomed area."""
    img_rgb = load_image(screenshot_path)
    center_x, center_y = coordinates["x"], coordinates["y"] + int(img_rgb.shape[0] * 0.25)

    zoom_factor = 1.5
    crop_w, crop_h = int(img_rgb.shape[1] / zoom_factor), int(img_rgb.shape[0] / zoom_factor)
    x_start, x_end = max(0, center_x - crop_w // 2), min(img_rgb.shape[1], center_x + crop_w // 2)
    y_start, y_end = max(0, center_y - crop_h // 2), min(img_rgb.shape[0], center_y + crop_h // 2)
    zoomed_image = img_rgb[y_start:y_end, x_start:x_end]
    cv2.imwrite(f'./temp/zoomed_screenshot_{device_id}.png', zoomed_image)

    templates = [
        './resources/exile_icon.png', './resources/exile_icon2.png',
        './resources/fool_icon.png', './resources/beggar_icon.png',
        './resources/beggar_icon2.png', './resources/slave_icon.png',
        './resources/sluggard_icon.png', './resources/traitor_icon.png'
    ]
    match = match_template(cv2.cvtColor(zoomed_image, cv2.COLOR_BGR2GRAY), templates, threshold=0.75)

    if match:
        _, _, max_loc, (w, h), max_val = match
        cv2.rectangle(zoomed_image, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 0, 255), 2)
        cv2.imwrite(f'./temp/zoomed_screenshot_with_negative_title_{device_id}.png', zoomed_image)
        return {"error": "Negative title detected."}

    return {"coordinates": coordinates}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python ./check_title.py <screenshot_path> <device_id>"}))
        sys.exit(1)

    screenshot_path, device_id = sys.argv[1], sys.argv[2]
    try:
        button_result = find_add_title_button(screenshot_path, device_id, click=False)
        if "error" in button_result:
            print(json.dumps(button_result))
            sys.exit(1)

        title_check_result = check_negative_titles(screenshot_path, button_result, device_id)
        if "error" in title_check_result:
            print(json.dumps(title_check_result))
            sys.exit(1)

        find_add_title_button(screenshot_path, device_id, click=True)
        print(json.dumps({"coordinates": button_result}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
