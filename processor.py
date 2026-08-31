import sys
import os
import cv2
import numpy as np
import rembg

def smooth_image(input_path, output_path):
    # ==========================================
    # STEP 1: LOAD & CONVERT TO 16-BIT GRAYSCALE
    # ==========================================
    print("Loading image and converting to 16-bit grayscale...", flush=True)
    img_8bit = cv2.imread(input_path, cv2.IMREAD_GRAYSCALE)

    if img_8bit is None:
        print(f"Error: Could not load {input_path}", flush=True)
        sys.exit(1)

    # Upscale from 8-bit (0-255) to 16-bit (0-65535)
    # Multiplying by 257 correctly maps 255 to 65535
    img_16bit = (img_8bit.astype(np.uint32) * 257).astype(np.uint16)

    # ==========================================
    # STEP 4: CLEAN UP MISSING DATA (INPAINTING)
    # ==========================================
    print("Identifying and cleaning up missing data (inpainting)...", flush=True)
    # Build a mask of the foreground region (any non-zero pixel is subject matter).
    # We only want to inpaint holes *within* the subject, not the intentional
    # pure-black background. Dilate the foreground to establish its bounding region,
    # then find pixels that are zero *inside* that region — those are the real holes.
    fg_mask = (img_16bit > 0).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    fg_dilated = cv2.dilate(fg_mask, kernel, iterations=3)
    # Holes are pixels that are zero AND inside the dilated foreground region
    missing_mask = ((img_16bit == 0) & (fg_dilated > 0)).astype(np.uint8)

    # Close minor holes using morphological operations
    struct_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    cleaned_16bit = cv2.morphologyEx(img_16bit, cv2.MORPH_CLOSE, struct_kernel)

    # If large holes exist, downscale mask to 8-bit to use OpenCV's inpaint
    if np.any(missing_mask):
        print("Large missing data holes detected; applying telea inpainting...", flush=True)
        # Convert temporarily to 8-bit for cv2.inpaint compatibility
        tmp_8bit = (cleaned_16bit // 257).astype(np.uint8)
        inpainted_8bit = cv2.inpaint(tmp_8bit, missing_mask, inpaintRadius=3, flags=cv2.INPAINT_TELEA)
        # Convert back to 16-bit
        cleaned_16bit = (inpainted_8bit.astype(np.uint32) * 257).astype(np.uint16)

    # ==========================================
    # STEP 2: SPATIAL FILTERING (FIX BANDING)
    # ==========================================
    print("Applying bilateral spatial filtering to fix banding while preserving edges...", flush=True)
    # OpenCV bilateralFilter does not support uint16 natively. 
    # Convert to float32 first to perform precise mathematical smoothing.
    float_depth = cleaned_16bit.astype(np.float32)

    # Bilateral filter clears banding but keeps sharp edges
    # d=9 (pixel neighborhood), sigmaColor=5000 (intensity variation), sigmaSpace=5 (coordinate space)
    filtered_float = cv2.bilateralFilter(float_depth, d=9, sigmaColor=5000.0, sigmaSpace=5.0)

    print("Applying Gaussian blur to smooth micro-textures...", flush=True)
    # Optional minor Gaussian blur to smooth any micro-textures
    filtered_float = cv2.GaussianBlur(filtered_float, (3, 3), 0)

    # ==========================================
    # STEP 3: NORMALIZE THE DEPTH RANGE
    # ==========================================
    print("Stretching depth values to normalize full 16-bit range...", flush=True)
    # Find the lowest and highest values in the filtered image
    min_val, max_val, _, _ = cv2.minMaxLoc(filtered_float)

    # Stretch the values to fill the exact 16-bit range (0 to 65535)
    if max_val > min_val:
        normalized_float = (filtered_float - min_val) * (65535.0 / (max_val - min_val))
    else:
        normalized_float = filtered_float

    final_16bit = normalized_float.astype(np.uint16)

    # ==========================================
    # STEP 5: EXPORT AS LOSSLESS 16-BIT PNG
    # ==========================================
    print(f"Exporting processed 16-bit PNG to {output_path}...", flush=True)
    # Explicitly use compression parameters for maximum file safety
    cv2.imwrite(output_path, final_16bit, [cv2.IMWRITE_PNG_COMPRESSION, 9])

def remove_bg(input_path, output_path):
    print(f"Removing background from {input_path}...", flush=True)
    img_8bit = cv2.imread(input_path, cv2.IMREAD_COLOR)
    
    if img_8bit is None:
        print(f"Error: Could not load {input_path}", flush=True)
        sys.exit(1)
        
    # Apply rembg
    # rembg expects RGB or BGR image, returns RGBA
    isolated_rgba = rembg.remove(img_8bit)
    
    # Extract alpha channel
    alpha = isolated_rgba[:, :, 3]
    
    # Create pure black background
    black_bg = np.zeros_like(img_8bit)
    
    # Composite the foreground onto the black background
    # Normalize alpha to 0.0 - 1.0
    alpha_float = alpha.astype(np.float32) / 255.0
    
    # Multiply foreground by alpha and background by (1 - alpha)
    # Since background is 0, we just multiply foreground by alpha
    for c in range(3):
        black_bg[:, :, c] = (isolated_rgba[:, :, c].astype(np.float32) * alpha_float).astype(np.uint8)
        
    print(f"Exporting background-removed PNG to {output_path}...", flush=True)
    cv2.imwrite(output_path, black_bg)

def create_mesh(input_path, output_path):
    print("Error: 3D mesh generation is not yet implemented.", flush=True)
    print("To enable this, install 'trimesh' and implement displacement mesh generation here.", flush=True)
    sys.exit(1)

def main():
    if len(sys.argv) < 4:
        print("Usage: python processor.py <command> <input_path> <output_path>")
        sys.exit(1)

    command = sys.argv[1]
    input_path = sys.argv[2]
    output_path = sys.argv[3]

    if command == "smooth":
        smooth_image(input_path, output_path)
    elif command == "remove_bg":
        remove_bg(input_path, output_path)
    elif command == "mesh":
        create_mesh(input_path, output_path)
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()