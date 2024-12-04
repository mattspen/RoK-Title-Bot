import time
import pytesseract
from PIL import Image
import subprocess
import io
import websocket
import json
import re

# ADB and OCR configurations
ADB_SCREENSHOT_CMD = "adb -s emulator-5554 exec-out screencap -p"
WEBSOCKET_SERVER_URL = "ws://localhost:8085"  # WebSocket server URL
X_START, X_END, Y_START, Y_END = 267, 871, 969, 1070  # Adjust based on your chat area

# Title mappings for recognition
TITLE_MAPPINGS = {
    "Duke": ["d", "duke", "duk", "D"],
    "Justice": ["j", "justice", "jus", "J"],
    "Architect": ["a", "arch", "architect", "A"],
    "Scientist": ["s", "scientist", "sci", "S"],
}

# Keep track of the last three processed requests
last_requests = []

def capture_screen():
    """Capture a screenshot using ADB."""
    try:
        result = subprocess.run(ADB_SCREENSHOT_CMD.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode != 0:
            print(f"ADB Error: {result.stderr.decode('utf-8')}")
            return None
        return Image.open(io.BytesIO(result.stdout))
    except Exception as e:
        print(f"Error capturing screen: {e}")
        return None

def process_area(image):
    """Extract the relevant chat area and perform OCR."""
    cropped_image = image.crop((X_START, Y_START, X_END, Y_END))
    text = pytesseract.image_to_string(cropped_image, lang='eng')
    return text.strip()

def parse_chat(text):
    """Extract title, X, Y coordinates, and kingdom."""
    lines = text.split("\n")
    for line in lines:
        for title, variations in TITLE_MAPPINGS.items():
            for variation in variations:
                if variation.lower() in line.lower():
                    try:
                        # Extract coordinates and kingdom code using regex
                        x_match = re.search(r"X:(\d+)", line)
                        y_match = re.search(r"Y:(\d+)", line)
                        kingdom_match = re.search(r"#C?(\d+)", line)

                        if not x_match or not y_match or not kingdom_match:
                            print(f"Skipping line due to missing data: {line}")
                            continue

                        x = int(x_match.group(1))
                        y = int(y_match.group(1))
                        kingdom_code = kingdom_match.group(1)
                        is_lost_kingdom = kingdom_code != "3299"

                        return {
                            "title": title,  # Use canonical title (e.g., Duke)
                            "x": x,
                            "y": y,
                            "kingdom": kingdom_code,
                            "isLostKingdom": is_lost_kingdom
                        }
                    except Exception as e:
                        print(f"Error parsing line: {e} - Line: {line}")
    return None

def is_duplicate_request(data):
    global last_requests
    for request in last_requests:
        if (
            request["title"] == data["title"]
            and request["x"] == data["x"]
            and request["y"] == data["y"]
            and request["kingdom"] == data["kingdom"]
        ):
            return True
    last_requests.append(data)
    if len(last_requests) > 3:
        last_requests.pop(0)
    return False


def send_request_to_websocket(data):
    """Send parsed data to the Node.js WebSocket server."""
    try:
        ws = websocket.create_connection(WEBSOCKET_SERVER_URL)
        ws.send(json.dumps(data))  # Send data as JSON
        print(f"Data sent to WebSocket server: {data}")
        ws.close()
    except Exception as e:
        print(f"Error connecting to WebSocket server: {e}")

def main():
    print("Starting chat checker with WebSocket integration. Press Ctrl+C to stop.")
    try:
        while True:
            screen = capture_screen()
            if screen:
                extracted_text = process_area(screen)
                print(f"Extracted Chat: {extracted_text}")
                parsed_data = parse_chat(extracted_text)
                if parsed_data:
                    if is_duplicate_request(parsed_data):
                        print(f"Duplicate request ignored: {parsed_data}")
                    else:
                        print(f"Parsed Data: {parsed_data}")  # Debug print
                        send_request_to_websocket(parsed_data)
            time.sleep(1.5)  # Check chat every 1.5 seconds
    except KeyboardInterrupt:
        print("Script stopped.")

if __name__ == "__main__":
    main()
