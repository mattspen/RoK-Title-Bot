import os
import cv2
import json
import sys
import subprocess

def find_add_title_button(screenshot_path, device_id):
    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        return {"error": f"{screenshot_path} not found or could not be opened"}

    # Convert screenshot to grayscale for matching
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    # Define template paths
    template_paths = ['./resources/add-title-button.png', './resources/add-title-button2.png']

    for template_path in template_paths:
        # Load the template
        template = cv2.imread(template_path)
        if template is None:
            continue

        # Convert template to grayscale
        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        # Perform template matching
        res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        # Define a threshold for match acceptance
        threshold = 0.9

        # If a match is found, calculate the center coordinates
        if max_val >= threshold:
            h, w = template_gray.shape
            center_x = int(max_loc[0] + w / 2)
            center_y = int(max_loc[1] + h / 2)

            # Save the modified image with the rectangle
            cv2.rectangle(img_rgb, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 255, 0), 2)
            cv2.putText(img_rgb, f'Max Val: {max_val:.2f}', (max_loc[0], max_loc[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)

            cv2.imwrite(f'temp/screenshot_found_{device_id}.png', img_rgb)
            print(f"x: {center_x}, y: {center_y}")

            # Use the provided device ID to execute the adb command
            adb_command = f'adb -s {device_id} shell input tap {center_x} {center_y}'

            try:
                subprocess.run(adb_command, shell=True, check=True)
                print(f"Tapped at coordinates: ({center_x}, {center_y})")
            except subprocess.CalledProcessError as e:
                return {"error": f"ADB command failed: {e}"}

            return {"x": center_x, "y": center_y}

    return {"error": "Button not found"}

def check_negative_titles(screenshot_path, coordinates, device_id):
    negative_titles = [
        './resources/exile_icon.png',
        './resources/exile_icon2.png',
        './resources/fool_icon.png',
        './resources/beggar_icon.png',
        './resources/beggar_icon2.png',
        './resources/slave_icon.png',
        './resources/sluggard_icon.png',
        './resources/traitor_icon.png'
    ]

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        return {"error": f"{screenshot_path} not found or could not be opened"}

    # Zooming logic
    center_x = coordinates["x"]
    center_y = coordinates["y"]

    # Move the y-axis down by 25%
    center_y = int(center_y + img_rgb.shape[0] * 0.25)

    # Define zoom factor and calculate crop dimensions
    zoom_factor = 1.5
    crop_width = int(img_rgb.shape[1] / zoom_factor)
    crop_height = int(img_rgb.shape[0] / zoom_factor)

    # Calculate cropping box
    x_start = max(0, center_x - crop_width // 2)
    x_end = min(img_rgb.shape[1], center_x + crop_width // 2)
    y_start = max(0, center_y - crop_height // 2)
    y_end = min(img_rgb.shape[0], center_y + crop_height // 2)

    # Crop the zoomed area
    zoomed_image = img_rgb[y_start:y_end, x_start:x_end]

    # Save the zoomed screenshot
    cv2.imwrite(f'./temp/zoomed_screenshot_{device_id}.png', zoomed_image)

    # Convert the zoomed image to grayscale
    zoomed_gray = cv2.cvtColor(zoomed_image, cv2.COLOR_BGR2GRAY)

    # Check for each negative title
    for template_path in negative_titles:
        template = cv2.imread(template_path)
        if template is None:
            return {"error": f"{template_path} not found or could not be opened"}

        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        # Perform template matching
        res = cv2.matchTemplate(zoomed_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        # Define a threshold for match acceptance
        threshold = 0.75

        # If a match is found, return an error message
        if max_val >= threshold:
            h, w = template_gray.shape
            cv2.rectangle(zoomed_image, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 0, 255), 2)
            cv2.putText(zoomed_image, f'Max Val: {max_val:.2f}', (max_loc[0], max_loc[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)

            cv2.imwrite(f'./temp/zoomed_screenshot_with_negative_title_{device_id}.png', zoomed_image)

            return {"error": "Negative title detected."}

    return {"coordinates": coordinates}

if __name__ == "__main__":
    try:
        # First, find the add title button
        if len(sys.argv) != 3:
            print(json.dumps({"error": "Usage: python ./check_title.py <screenshot_path> <device_id>"}))
            exit(1)

        screenshot_path = sys.argv[1]
        device_id = sys.argv[2]
        button_result = find_add_title_button(screenshot_path, device_id)
        if "error" in button_result:
            exit(1)

        # Check for negative titles if button is found
        coordinates = button_result
        title_check_result = check_negative_titles(screenshot_path, coordinates, device_id)

        if "error" in title_check_result:
            print(json.dumps(title_check_result))
            exit(1)
        else:
            response = {
                "coordinates": coordinates
            }
            print(json.dumps(response))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        exit(1)
