import subprocess
import os
import cv2
import easyocr
import re
import time
import json
import websocket

# Set up paths
output_dir = "temp"
os.makedirs(output_dir, exist_ok=True)

# Paths for the screenshot and processed image
screenshot_path = os.path.join(output_dir, "screenshot.png")
cropped_path = os.path.join(output_dir, "cropped.png")

# Global EasyOCR reader (initialized once for efficiency)
reader = easyocr.Reader(['en'], gpu=True)

# A set to store processed results and avoid duplicates
processed_results = set()

# WebSocket connection details
WS_URL = "ws://localhost:3299"  # Adjust to your bot's WebSocket server

def capture_screenshot(device_id, output_path):
    """Capture screenshot from the emulator."""
    try:
        subprocess.run(
            ["adb", "-s", device_id, "exec-out", "screencap", "-p"], 
            stdout=open(output_path, "wb"),
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"Error capturing screenshot: {e}")
        raise

def preprocess_image(image_path, cropped_path):
    """Crop the image to the specified coordinates for faster OCR."""
    image = cv2.imread(image_path)
    # Crop to the region of interest
    cropped_image = image[957:1075, 265:928]  # Ensure correct cropping region
    cv2.imwrite(cropped_path, cropped_image)

def perform_ocr(image_path):
    """Perform OCR on the cropped image and format the results."""
    ocr_results = reader.readtext(image_path, detail=0)
    ocr_text = " ".join(ocr_results)  # Combine text lines into a single string
    
    corrected_text = ocr_text.replace(';', ':').replace('_', '').replace('\n', ' ')
    
    matches = re.findall(
        r'(Duke|Justice|Scientist|Architect)\s+\(#(C\d+)\s+X([:.0-9]+)\s+Y([:.0-9]+)\)', 
        corrected_text,
        re.IGNORECASE
    )
    
    new_results = []
    for match in matches:
        try:
            title = match[0].capitalize()
            kd = match[1]
            x_coord = re.sub(r'\D', '', match[2])
            y_coord = re.sub(r'\D', '', match[3])

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
        except Exception as e:
            print(f"Error processing match: {match}, Error: {e}")
    
    return new_results

def send_to_websocket(results):
    """Send new results to the WebSocket server one at a time."""
    try:
        ws = websocket.create_connection(WS_URL)
        print("Connected to WebSocket server.")
        for result in results:
            ws.send(json.dumps(result))
            
            # Wait for acknowledgment
            response = ws.recv()
            ack = json.loads(response)
            if ack.get("success", False):
                print(f"Successfully sent to WebSocket:\n{json.dumps(result, indent=2)}")
            else:
                print(f"Error processing request on the server for {result}. Skipping...")
        
        ws.close()
    except Exception as e:
        print(f"Error connecting to WebSocket: {e}")

def main_loop(device_id):
    """Continuously capture, process OCR, and send new results."""
    while True:
        try:
            capture_screenshot(device_id, screenshot_path)
            preprocess_image(screenshot_path, cropped_path)
            new_results = perform_ocr(cropped_path)
            
            if new_results:
                send_to_websocket(new_results)  # Send all new results
            
            time.sleep(4)
        except KeyboardInterrupt:
            print("Stopping the script.")
            break
        except Exception as e:
            print(f"An error occurred: {e}")

device_id = "emulator-5554"
main_loop(device_id)
