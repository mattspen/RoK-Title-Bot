import cv2
import pytesseract
import subprocess
import os
import re

# Get the absolute path for the /temp directory
script_dir = os.path.dirname(os.path.abspath(__file__))
output_dir = os.path.join(script_dir, "temp")  # Use 'temp' instead of '/temp' to avoid root issues
os.makedirs(output_dir, exist_ok=True)

# Define paths for the screenshot and preprocessed image
screenshot_path = os.path.join(output_dir, "emulator_screenshot.png")
preprocessed_path = os.path.join(output_dir, "tesseract_input.png")

# Function to capture a screenshot from the emulator
def capture_screenshot():
    subprocess.run(["adb", "-s", "emulator-5554", "exec-out", "screencap", "-p"], stdout=open(screenshot_path, "wb"))
    return screenshot_path

# Step 1: Capture the screenshot
capture_screenshot()

# Step 2: Load the screenshot into OpenCV
image = cv2.imread(screenshot_path)

# Convert the image to grayscale
gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

# Corrected cropping region (X:201-751, Y:960-1080)
cropped_region = gray[960:1080, 201:751]

# Apply preprocessing for better OCR results
_, thresh = cv2.threshold(cropped_region, 150, 255, cv2.THRESH_BINARY)

# Save the preprocessed image for inspection
cv2.imwrite(preprocessed_path, thresh)
print(f"Preprocessed image saved at: {preprocessed_path}")

# Step 3: Run Tesseract OCR on the preprocessed image
custom_config = r'--oem 3 --psm 6'  # PSM 6 assumes a single uniform block of text
extracted_text = pytesseract.image_to_string(thresh, config=custom_config)

# Print the raw OCR result
print("Extracted Text:")
print(extracted_text)

# Step 4: Extract Titles, Castle IDs, and Coordinates
# Use regex to match patterns like "Duke (#C12483 X:191 Y:262)"
matches = re.findall(r'(Duke|Justice|Scientist|Architect)\s\(#C\d+\sX:\d+\sY:\d+\)', extracted_text)

# Parse the results into a structured format
results = []
for match in matches:
    title = re.search(r'(Duke|Justice|Scientist|Architect)', match).group()
    castle_id = re.search(r'#C\d+', match).group()
    x_coord = re.search(r'X:\d+', match).group().split(':')[1]
    y_coord = re.search(r'Y:\d+', match).group().split(':')[1]
    results.append((title, castle_id, int(x_coord), int(y_coord)))

# Print extracted data
print("\nExtracted Data:")
for result in results:
    print(f"Title: {result[0]}, Castle ID: {result[1]}, Coordinates: X:{result[2]}, Y:{result[3]}")
