import cv2
import numpy as np
import os

def local_smooth_depth_map(input_path: str, output_path: str):
    """
    Locally processes a depth map using OpenCV to remove AI noise 
    and smooth gradients for CNC/Laser engraving.
    """
    # 1. Load the image. 
    # IMREAD_ANYDEPTH ensures we don't accidentally downgrade a 16-bit image to 8-bit.
    img = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE | cv2.IMREAD_ANYDEPTH)
    
    if img is None:
        raise ValueError(f"Could not load image at {input_path}")

    # Convert to float32 so the math operations don't clip our data
    img_float = np.float32(img)

    # 2. Apply Bilateral Filter. 
    # This smooths the flat gradients while keeping the sharp edges crisp.
    # d=9 (pixel neighborhood), sigmaColor/sigmaSpace=75 are standard starting values.
    smoothed = cv2.bilateralFilter(img_float, d=9, sigmaColor=75, sigmaSpace=75)

    # 3. Apply a very light Gaussian blur on top to kill any lingering micro-stepping
    smoothed = cv2.GaussianBlur(smoothed, (5, 5), 0)

    # 4. Convert back to the original format safely
    if img.dtype == np.uint16:
        # Cap at 65535 for 16-bit
        smoothed = np.clip(smoothed, 0, 65535).astype(np.uint16)
    else:
        # Cap at 255 for 8-bit
        smoothed = np.clip(smoothed, 0, 255).astype(np.uint8)

    # 5. Save the final processed image
    success = cv2.imwrite(output_path, smoothed)
    if not success:
        raise IOError(f"Failed to save processed image to {output_path}")