import os
import cv2
import json

def find_add_title_button():
    screenshot_path = 'screenshot.png'  # Updated to check screenshot.png
    template_path = './resources/add-title-button.png'

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
        return {"x": int(max_loc[0]), "y": int(max_loc[1])}
    else:
        return {"error": "Button not found"}

def check_negative_titles():
    screenshot_path = 'screenshot.png'  # Updated to check screenshot.png
    negative_titles = [
        './resources/exile_icon.png',
        './resources/fool_icon.png',
        './resources/slave_icon.png',
        './resources/sluggard_icon.png',
        './resources/traitor_icon.png'
    ]

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        return {"error": "screenshot.png not found or could not be opened"}

    # Convert the screenshot to grayscale
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    # Check for each negative title
    for template_path in negative_titles:
        template = cv2.imread(template_path)
        if template is None:
            return {"error": f"{template_path} not found or could not be opened"}

        template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        # Perform template matching
        res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        _, max_val, _, max_loc = cv2.minMaxLoc(res)

        # Define a threshold for match acceptance
        threshold = 0.7

        # If a match is found, draw a rectangle around it and return the error
        if max_val >= threshold:
            # Get the dimensions of the template
            h, w = template_gray.shape
            # Draw a rectangle on the original image
            cv2.rectangle(img_rgb, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 0, 255), 2)
            # Save or display the modified image
            cv2.imwrite('screenshot_with_negative_title.png', img_rgb)
            return {"error": f"Negative title detected: {os.path.basename(template_path)}", "location": max_loc}

    return None

if __name__ == "__main__":
    try:
        negative_title_result = check_negative_titles()
        if negative_title_result:
            print(json.dumps(negative_title_result))  # Output error message in JSON format
        else:
            result = find_add_title_button()
            if result:
                print(json.dumps(result))  # Output coordinates in JSON format
            else:
                print(json.dumps({"error": "Button not found"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))  # Return any other exceptions as JSON
