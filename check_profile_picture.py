import os
import cv2
import sys

def check_profile_picture(screenshot_path, profile_template_path='./resources/profile_pic.png', threshold=0.7):
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    height, width = img_rgb.shape[:2]

    roi = img_rgb[height//2:height, 0:width//2]

    img_gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)

    template = cv2.imread(profile_template_path)
    if template is None:
        raise FileNotFoundError(f"{profile_template_path} not found or could not be opened")

    template_gray = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

    res = cv2.matchTemplate(img_gray, template_gray, cv2.TM_CCOEFF_NORMED)
    _, max_val, _, max_loc = cv2.minMaxLoc(res)

    profile_picture_found = max_val >= threshold

    if profile_picture_found:
        h, w = template_gray.shape
        top_left = max_loc
        bottom_right = (top_left[0] + w, top_left[1] + h)
        cv2.rectangle(roi, top_left, bottom_right, (0, 255, 0), 2)

    result_image_path = './temp/result_image_with_rectangle.png'
    cv2.imwrite(result_image_path, roi)

    return not profile_picture_found

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python check_profile_picture.py <screenshot_path>")
        sys.exit(1)

    screenshot_path = sys.argv[1]
    result = check_profile_picture(screenshot_path)
    print(result)