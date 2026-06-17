import cv2
import numpy as np
import sys

def no_op(x):
    """Dummy callback for trackbars."""
    pass

def run_tuner(image_path):
    # Load the image in 16-bit grayscale to preserve depth data
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE | cv2.IMREAD_ANYDEPTH)
    
    if img is None:
        print(f"Error: Couldn't load the image at {image_path}. Check the path.")
        sys.exit(1)

    # Convert to float32 for clean math operations without clipping
    img_float = np.float32(img)

    # Create the interactive window
    window_name = "DepthForge Live Tuner (Press 'S' to Save, 'ESC' to Quit)"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 800, 800)

    # Create Sliders (Trackbars)
    # d: Diameter of each pixel neighborhood (larger = more processing, smoother)
    # sigmaColor: Filter sigma in the color space (larger = merges further apart elevations)
    # sigmaSpace: Filter sigma in the coordinate space (larger = influences pixels further away)
    cv2.createTrackbar("Neighborhood (d)", window_name, 9, 30, no_op)
    cv2.createTrackbar("Sigma Color", window_name, 75, 200, no_op)
    cv2.createTrackbar("Sigma Space", window_name, 75, 200, no_op)
    cv2.createTrackbar("Blur Kernel", window_name, 5, 15, no_op) # Gaussian blur at the end

    print("Live tuner running. Adjust sliders. Press 's' to save the result, or 'ESC' to close.")

    while True:
        # Grab current slider values
        d = cv2.getTrackbarPos("Neighborhood (d)", window_name)
        sig_c = cv2.getTrackbarPos("Sigma Color", window_name)
        sig_s = cv2.getTrackbarPos("Sigma Space", window_name)
        blur_k = cv2.getTrackbarPos("Blur Kernel", window_name)

        # OpenCV requires the blur kernel size to be an odd number
        if blur_k % 2 == 0:
            blur_k += 1

        # Apply Bilateral Filter (Smooths flats, preserves sharp edges)
        processed = cv2.bilateralFilter(img_float, d, sig_c, sig_s)

        # Apply slight Gaussian Blur to kill final micro-stepping
        if blur_k > 1:
            processed = cv2.GaussianBlur(processed, (blur_k, blur_k), 0)

        # Convert back to uint16 for display and saving
        processed_16bit = np.clip(processed, 0, 65535).astype(np.uint16)

        # Display the result
        cv2.imshow(window_name, processed_16bit)

        # Wait for key press
        key = cv2.waitKey(100) & 0xFF
        if key == 27: # ESC key
            break
        elif key == ord('s'): # 's' key to save
            save_path = "tuned_output.png"
            cv2.imwrite(save_path, processed_16bit)
            print(f"Bloody lovely! Saved perfectly tuned depth map to {save_path}")
            print(f"Your final parameters -> d:{d}, SigmaColor:{sig_c}, SigmaSpace:{sig_s}, Blur:{blur_k}")
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tune_depth.py <path_to_image.png>")
    else:
        run_tuner(sys.argv[1])