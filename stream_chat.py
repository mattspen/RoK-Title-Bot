import cv2
import pytesseract
import numpy as np
import subprocess
import threading
import time
import re
from pymongo import MongoClient
from datetime import datetime
import signal
from pymongo.errors import DuplicateKeyError

# MongoDB setup
MONGO_URI = "mongodb://localhost:27017/"
client = MongoClient(MONGO_URI)
db = client['test']  # Use the existing database named 'test'
collection = db['titlerequests']  # Use the same collection name as in Node.js

# Define the chat region
chat_region = (37, 88, 860, 936)  # Top left: (37, 88), Bottom right: (860, 936)

# ADB device ID for the instance
device_id = "emulator-5554"  # Example device ID for BlueStacks instance

# Global variable to control the streaming
running = True

# Global variable to track the last processed request
last_request = None

# Specify the kingdom for requests based on device ID
KINGDOM_ID = 3299  # Kingdom ID for emulator-5554

def adb_screencap(device_id):
    """Capture the screen from the emulator using ADB"""
    result = subprocess.run(
        ["adb", "-s", device_id, "exec-out", "screencap", "-p"], 
        stdout=subprocess.PIPE
    )
    return np.frombuffer(result.stdout, np.uint8)

def process_frame(frame):
    global last_request  # Declare last_request as global at the beginning

    # Crop the frame to the chat region
    chat_frame = frame[chat_region[1]:chat_region[3], chat_region[0]:chat_region[2]]

    # Use Tesseract to read the chat from the cropped frame
    chat_text = pytesseract.image_to_string(chat_frame)

    # Print the text recognized by Tesseract for debugging
    print(f"Tesseract Output from {device_id}: {chat_text}")

    # Adjusted regex to match the username and title in various formats
    pattern = r'\[(\w+)\](\w+)\s*(?:Please\s*|W\s*|“|~)?\s*(duke|scientist|architect|justice)'  # Adjusted regex for username and title
    # Define the titles to match
    titles = ["duke", "architect", "justice", "scientist"]

    # Adjusted regex to match the username and title in various formats
    pattern = r'\[(\w+)\](\w+)\s*(?:Please\s*|W\s*|“|~)?\s*(duke|scientist|architect|justice)'  # Adjusted regex for username and title
    matches = re.findall(pattern, chat_text, re.IGNORECASE)

    # Filter matches to include only those with the specified titles
    matches = [match for match in matches if match[2].lower() in titles]

    # Process matches to retrieve usernames and titles
    if matches:
        for match in matches:
            username = match[1]  # Extracting username from the match
            title = match[2]  # Extracting title from the match

            # Check if the document already exists
            existing_request = collection.find_one({
                'username': username,
                'title': title,
                'kingdom': KINGDOM_ID
            })

            if existing_request:
                if existing_request['processed']:
                    # If the existing request has been processed, delete it
                    collection.delete_one({'_id': existing_request['_id']})
                    print(f"Deleted processed request for {username} requesting '{title}'.")
                else:
                    # If the existing request is not processed, ignore the new one
                    print(f"Existing unprocessed request found for {username} requesting '{title}', ignoring new request.")
                    continue

            # Prepare the document to insert into Mongo
            request_document = {
                'username': username,
                'title': title,
                'processed': False,
                'timestamp': datetime.now(),
                'kingdom': KINGDOM_ID  # Include kingdom ID in the request based on device
            }

            try:
                # Insert the new request into MongoDB
                collection.insert_one(request_document)
                print(f"New request from {device_id}: {username} requested '{title}'")
            except DuplicateKeyError as e:
                print(f"Duplicate key error: {e}")

            # Update the last processed request
            last_request = request_document

def stream_chat():
    while running:
        # Capture the screen from the emulator
        screenshot = adb_screencap(device_id)
        
        # Decode the screenshot into an OpenCV-compatible image
        if screenshot is not None and len(screenshot) > 0:
            frame = cv2.imdecode(screenshot, cv2.IMREAD_COLOR)
            if frame is not None:
                # Process the frame for titles
                process_frame(frame)
        
        # Process every 5 seconds
        time.sleep(5)

def signal_handler(sig, frame):
    global running
    running = False
    print("\nStopping the chat stream...")

# Register the signal handler for graceful shutdown
signal.signal(signal.SIGINT, signal_handler)

# Start streaming for the BlueStacks instance
chat_thread = threading.Thread(target=stream_chat)
chat_thread.start()

# Wait for the thread to finish
chat_thread.join()

# Close OpenCV windows
cv2.destroyAllWindows()

print("Chat stream has been stopped.")
