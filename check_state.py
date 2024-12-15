import os
import cv2
import sys
import subprocess
import json
import random  # Import random for generating offsets

def check_state(screenshot_path, device_id):
    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    # Convert screenshot to grayscale for matching
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    # Define template paths
    template_paths = ['./resources/exit.png', 
                      './resources/exit2.png', './resources/elimination_button_exit.png', './resources/notice_board_exit.png']

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
            best_match["match"] = max_val >= 0.8  # Adjust confidence threshold if necessary
            best_match["location"] = max_loc if best_match["match"] else None
            best_match["confidence"] = max_val

        # If exit.png or notice_board_exit.png is found, return the coordinates immediately
        if template_path in ['./resources/exit.png', './resources/exit2.png', 
                             './resources/notice_board_exit.png', './resources/elimination_button_exit.png'] and best_match["match"]:
            click_exit_button(device_id, best_match["location"], template.shape[:2])  # Click the exit button
            
            # Save the screenshot with the exit button clicked
            exit_button_clicked_path = f'./temp/exit_button_clicked_{device_id}.png'
            cv2.imwrite(exit_button_clicked_path, img_rgb)
            print(f"Exit button clicked screenshot saved as: {exit_button_clicked_path}")
            
            return {
                "button_found": True,
                "confidence": best_match["confidence"],
                "location": best_match["location"]
            }

    # Prepare the response for checking if the button is present
    result = {
        "button_found": best_match["match"],
        "confidence": best_match["confidence"],
        "location": best_match["location"] if best_match["match"] else None
    }
    print(json.dumps(result, indent=4))

    # If a button was found, save the screenshot with the matched area highlighted
    if best_match["match"]:
        highlight_area(img_rgb, best_match["location"], template.shape[:2])

    return result

def click_exit_button(device_id, location, template_shape):
    x, y = location
    # Calculate the center of the matched area
    center_x = x + (template_shape[1] // 2)
    center_y = y + (template_shape[0] // 2)
    
    # Apply a small random offset to the click position
    offset_x = random.randint(-5, 5)  # Random offset of -5 to 5 pixels in x direction
    offset_y = random.randint(-5, 5)  # Random offset of -5 to 5 pixels in y direction
    
    click_x = center_x + offset_x
    click_y = center_y + offset_y
    
    # Ensure the click coordinates are within the bounds of the template area
    click_x = max(x, min(click_x, x + template_shape[1] - 1))
    click_y = max(y, min(click_y, y + template_shape[0] - 1))

    exec_command = f'adb -s {device_id} shell input tap {click_x} {click_y}'
    subprocess.run(exec_command, shell=True)  # Execute the tap command
    print(f"Clicked exit button at ({click_x}, {click_y}) on {device_id}")

def highlight_area(img, location, template_shape):
    top_left = location
    bottom_right = (top_left[0] + template_shape[1], top_left[1] + template_shape[0])

    # Draw a rectangle around the matched region to highlight it
    cv2.rectangle(img, top_left, bottom_right, (0, 255, 0), 2)  # Green rectangle

    # Draw crosshairs at the center for better visibility
    center_x = top_left[0] + (template_shape[1] // 2)
    center_y = top_left[1] + (template_shape[0] // 2)
    cv2.line(img, (center_x - 10, center_y), (center_x + 10, center_y), (0, 0, 255), 2)  # Red horizontal line
    cv2.line(img, (center_x, center_y - 10), (center_x, center_y + 10), (0, 0, 255), 2)  # Red vertical line

    # Save the modified image with the highlighted area
    highlighted_image_path = './temp/highlighted_matched_area.png'
    cv2.imwrite(highlighted_image_path, img)
    print(f"Highlighted image saved as: {highlighted_image_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(1)

    screenshot_path = sys.argv[1]
    device_id = sys.argv[2]
    result = check_state(screenshot_path, device_id)
