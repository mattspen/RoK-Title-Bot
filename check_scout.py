import os
import cv2
import json

def find_scout_button():
    screenshot_path = 'screenshot.png'  # Updated to check screenshot.png
    template_path = './resources/scout.png'

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        return {"error": "screenshot.png not found or could not be opened"}

    # Load the template
    template = cv2.imread(template_path)
    if template is None:
        return {"error": f"{template_path} not found or could not be opened"}

    # Convert images to grayscale for matching
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    # Perform template matching
    res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)

    # Define a threshold for match acceptance
    threshold = 0.65

    # If a match is found, return the coordinates
    if max_val >= threshold:
        # Get the dimensions of the template
        h, w = template_gray.shape
        # Draw a rectangle on the original image
        cv2.rectangle(img_rgb, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 0, 255), 2)
        # Save or display the modified image
        cv2.imwrite('scout_found.png', img_rgb)
        return {"x": int(max_loc[0]), "y": int(max_loc[1])}
    else:
        return {"error": "Button not found"}

if __name__ == "__main__":
    try:
        result = find_scout_button()
        if result:
            print(json.dumps(result))  # Output coordinates in JSON format
        else:
            print(json.dumps({"error": "Button not found"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))  # Return any other exceptions as JSON
