import subprocess
import os
import cv2
import pytesseract
import re
import json
import sys

# Set up paths
output_dir = "temp"
os.makedirs(output_dir, exist_ok=True)

# Paths for the screenshot and processed image
def get_screenshot_path(device_id):
    return os.path.join(output_dir, f"screenshot_{device_id}.png")

def get_cropped_path(device_id):
    return os.path.join(output_dir, f"cropped_{device_id}.png")

# Global variable to store processed results and avoid duplicates
processed_results = set()

def capture_screenshot(device_id, output_path):
    """Capture screenshot from the emulator with retries."""
    from PIL import Image
    import time
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            time.sleep(1)  # Allow device to stabilize
            subprocess.run(
                ["adb", "-s", device_id, "exec-out", "screencap", "-p"], 
                stdout=open(output_path, "wb"),
                check=True
            )
            # Validate screenshot size
            if os.path.getsize(output_path) < 1024:
                print(f"Attempt {attempt + 1}: Screenshot is too small or corrupted.", file=sys.stderr)
                continue
            
            # Re-encode screenshot to fix potential corruption
            try:
                img = Image.open(output_path)
                img.save(output_path)
            except Exception as e:
                print(f"Attempt {attempt + 1}: Error re-encoding screenshot: {e}", file=sys.stderr)
                continue
            
            # Verify the screenshot is loadable
            if cv2.imread(output_path) is not None:
                return  # Success
            else:
                print(f"Attempt {attempt + 1}: Screenshot is unreadable.", file=sys.stderr)
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}", file=sys.stderr)
    
    raise RuntimeError(f"Failed to capture valid screenshot after {max_retries} attempts.")

def preprocess_image(image_path, cropped_path):
    """Crop the image to the specified coordinates for faster OCR."""
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Failed to read image from {image_path}. The file may be corrupted or missing.")

    cropped_image = image[957:1075, 265:928]  # Ensure correct cropping region
    cv2.imwrite(cropped_path, cropped_image)

def perform_ocr(image_path):
    """Perform OCR on the cropped image using Tesseract and format the results."""
    try:
        ocr_text = pytesseract.image_to_string(image_path, lang='eng')
        corrected_text = ocr_text.replace(';', ':').replace('_', '').replace('\n', ' ')

        # Flexible regex pattern to match titles with extra text after them
        matches = re.findall(
            r'(duke|justice|scientist|architect)\b.*?\(#([A-Za-z0-9]+)\s*X[:.]?(\d+)\s*Y[:.]?(\d+)\)', 
            corrected_text,
            re.IGNORECASE
        )

        new_results = []
        for match in matches:
            title = match[0].capitalize()
            kd = match[1]
            x_coord = match[2]
            y_coord = match[3]
            is_lost_kingdom = kd.startswith("C")
            result = {
                "title": title,
                "kingdom": kd,
                "x": x_coord,
                "y": y_coord,
                "isLostKingdom": is_lost_kingdom
            }
            if json.dumps(result) not in processed_results:
                processed_results.add(json.dumps(result))
                new_results.append(result)
        return new_results
    except Exception as e:
        print(f"Error during OCR: {e}", file=sys.stderr)
        return []

def main():
    """Main function to capture, process, and return OCR results."""
    global processed_results
    try:
        device_id = sys.argv[1]  # Get device ID from command-line arguments
        screenshot_path = get_screenshot_path(device_id)
        cropped_path = get_cropped_path(device_id)

        capture_screenshot(device_id, screenshot_path)
        preprocess_image(screenshot_path, cropped_path)
        results = perform_ocr(cropped_path)

        # Output only new results to Node.js
        if results:
            print(json.dumps(results))  # Output new results as JSON
        else:
            print(json.dumps([]))  # Output empty JSON array if no new results

    except Exception as e:
        print(json.dumps([]))  # Always output valid JSON
        print(f"Error: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps([]))  # Ensure valid JSON on script-level errors
        print(f"Critical error: {e}", file=sys.stderr)