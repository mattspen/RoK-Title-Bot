import os
import cv2
import json

def check_negative_titles(image_path):
    negative_titles = [
        './resources/exile_icon.png',
        './resources/exile_icon2.png',
        './resources/fool_icon.png',
        './resources/beggar_icon.png',
        './resources/beggar_icon2.png',
        './resources/slave_icon.png',
        './resources/sluggard_icon.png',
        './resources/traitor_icon.png'
    ]

    # Load the screenshot
    img_rgb = cv2.imread(image_path)
    if img_rgb is None:
        return {"error": f"{image_path} not found or could not be opened"}

    # Convert the image to grayscale
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

        # Print the maximum value for debugging
        print(f"Max value for {os.path.basename(template_path)}: {max_val:.2f}")

        # Define a threshold for match acceptance
        threshold = 0.7

        # If a match is found, draw a rectangle on the original image
        if max_val >= threshold:
            h, w = template_gray.shape
            cv2.rectangle(img_rgb, max_loc, (max_loc[0] + w, max_loc[1] + h), (0, 0, 255), 2)

            # Display the image with the found rectangle
            cv2.putText(img_rgb, f"Match: {max_val:.2f}", (max_loc[0], max_loc[1] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)
            cv2.imshow(f"Found {os.path.basename(template_path)}", img_rgb)
            cv2.waitKey(0)  # Wait for a key press to close the window
            cv2.destroyAllWindows()  # Close the window

            # Save modified image for reference
            cv2.imwrite(f'results/zoomed_screenshot_with_{os.path.basename(template_path)}.png', img_rgb)

            # Return an error indicating a negative title was found
            return {"error": f"Negative title detected in {os.path.basename(image_path)}."}

    # Return success if no negative titles are found
    return {"success": f"No negative titles detected in {os.path.basename(image_path)}."}


if __name__ == "__main__":
    try:
        # Hardcode images from the testImages folder
        test_images = [
            './testImages/Beggar.png',
            './testImages/Exile.png',
            './testImages/Fool.png',
            './testImages/Slave.png',
            './testImages/Sluggard.png',
            './testImages/Traitor.png',
            './testImages/None.png'

        ]

        # Loop through each image and check for negative titles
        for image in test_images:
            title_check_result = check_negative_titles(image)

            # Print the result for each image
            print(json.dumps(title_check_result, indent=4))  # Output results in JSON format

    except Exception as e:
        # Output any unexpected exceptions as JSON
        print(json.dumps({"error": str(e)}))
