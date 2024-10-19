import os
import cv2
import sys
import subprocess
import json
import random
import pytesseract

def preprocess_image(img_gray):
    # Resize the image for better accuracy
    img_resized = cv2.resize(img_gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # Apply GaussianBlur to reduce noise
    img_blur = cv2.GaussianBlur(img_resized, (5, 5), 0)

    # Apply adaptive thresholding to binarize the image
    img_thresh = cv2.adaptiveThreshold(img_blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2)

    # Optionally apply dilation/erosion to emphasize text
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    img_dilated = cv2.dilate(img_thresh, kernel, iterations=1)

    return img_dilated

def check_state(screenshot_path, device_id):
    print(f"Checking state of {device_id}...")

    # Load the screenshot
    img_rgb = cv2.imread(screenshot_path)
    if img_rgb is None:
        raise FileNotFoundError(f"{screenshot_path} not found or could not be opened")

    # Convert screenshot to grayscale for better OCR performance
    img_gray = cv2.cvtColor(img_rgb, cv2.COLOR_BGR2GRAY)

    # Preprocess the image to improve OCR accuracy
    img_processed = preprocess_image(img_gray)

    # Use Tesseract to extract text from the processed image
    custom_config = r'--oem 3 --psm 6'
    extracted_text = pytesseract.image_to_string(img_processed, config=custom_config)

    # Check if "NETWORK DISCONNECTED" is present in the extracted text
    if "NETWORK DISCONNECTED" in extracted_text:
        tap_random_region(device_id)
        return {
            "text_found": True,
        }
    else:
        print("Text not found.")
        return {
            "text_found": False,
        }

def tap_random_region(device_id):
    # Generate random coordinates within the specified ranges
    x = random.randint(1156, 2260)
    y = random.randint(1332, 1479)
    
    # ADB command to tap at the generated coordinates
    adb_command = f"adb -s {device_id} shell input tap {x} {y}"
    print(f"Executing ADB command: {adb_command}")
    subprocess.run(adb_command, shell=True)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(1)

    screenshot_path = sys.argv[1]
    device_id = sys.argv[2]
    result = check_state(screenshot_path, device_id)
