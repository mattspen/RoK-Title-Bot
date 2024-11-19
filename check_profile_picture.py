import os
import cv2
import sys

def check_profile_picture(screenshot_path, profile_template_path='./resources/profile_pic.png', threshold=0.7):
    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    # Get the height and width of the image
    height, width = img_rgb.shape[:2]

    # Define the region of interest (bottom-left quarter)
    roi = img_rgb[height//2:height, 0:width//2]  # Bottom-left quarter of the image

    # Convert the cropped ROI to grayscale for matching
    img_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    # Load the profile picture template
    template = cv2.imread(profile_template_path)
    if template is None:
        raise FileNotFoundError(f"{profile_template_path} not found or could not be opened")

    # Convert template to grayscale
    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    # Perform template matching
    res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)

    # Determine if the profile picture is present based on the threshold
    profile_picture_found = max_val >= threshold

    if profile_picture_found:
        # Draw a rectangle around the matched region (template)
        h, w = template_gray.shape
        top_left = max_loc
        bottom_right = (top_left[0] + w, top_left[1] + h)
        cv2.rectangle(roi, top_left, bottom_right, (0, 255, 0), 2)  # Green rectangle

    # Save the image with the rectangle drawn (if found) as a result (optional)
    result_image_path = './temp/result_image_with_rectangle.png'
    cv2.imwrite(result_image_path, roi)

    # Return False if profile picture is found (indicating Home Kingdom),
    # and True if not found (indicating Lost Kingdom).
    return not profile_picture_found

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_profile_picture.py <screenshot_path>")
        sys.exit(1)

    screenshot_path = sys.argv[1]
    result = check_profile_picture(screenshot_path)
    print(result)  # Output only "True" (Lost Kingdom) or "False" (Home Kingdom)
