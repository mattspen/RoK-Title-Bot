import os
import sys
import subprocess
import random
import pytesseract
import difflib
import cv2

# Define the cropping coordinates (using the values you provided)
CROP_X1, CROP_Y1 = 510, 262  # Top left
CROP_X2, CROP_Y2 = 1412, 814  # Bottom right

def clean_ocr_output(text):
    cleaned_text = ''.join(c for c in text if c.isalnum() or c.isspace() or c in ".,-")
    return cleaned_text

def is_text_similar(extracted_text, target_texts, threshold=0.4):
    for target_text in target_texts:
        similarity = difflib.SequenceMatcher(None, extracted_text.lower(), target_text.lower()).ratio()
        print(f"Checking similarity with '{target_text}': {similarity}")
        if similarity >= threshold:
            return True
    return False

def check_state(screenshot_path, device_id):
    print(f"Checking state of {device_id}...")

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    # Crop the image using the provided coordinates
    img_cropped = img_rgb[CROP_Y1:CROP_Y2, CROP_X1:CROP_X2]

    # Convert cropped image to grayscale
    img_gray = cv2.cvtColor(img_cropped, cv2.COLOR_BGR2GRAY)

    # Use Tesseract to extract text from the cropped image
    custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,- '
    extracted_text = pytesseract.image_to_string(img_gray, config=custom_config)

    cleaned_text = clean_ocr_output(extracted_text)
    print(f"Cleaned OCR output: {cleaned_text}")

    # List of target phrases to check against
    target_texts = [
        "networkunstable",
        "connectionlost",
        "pleaseclickconfirmtoreconnect",
        "confirm"
    ]

    if is_text_similar(cleaned_text, target_texts):
        tap_random_region(device_id)
        return {
            "text_found": True,
        }
    else:
        print("Text not found or not similar enough.")
        return {
            "text_found": False,
        }

def tap_random_region(device_id):
   
    adb_command = f"adb -s {device_id} shell input tap 954 711"
    print(f"Executing ADB command: {adb_command}")
    subprocess.run(adb_command, shell=True)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(1)

    screenshot_path = sys.argv[1]
    device_id = sys.argv[2]
    result = check_state(screenshot_path, device_id)
