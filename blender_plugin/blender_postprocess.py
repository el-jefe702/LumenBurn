"""Blender post-processing script.

This script is intended to be run with Blender's Python interpreter:
  blender --background --python blender_postprocess.py -- input.png output.png

It loads the input image into Blender, performs minimal processing, and writes
out a PNG to the output path. Keep processing simple to avoid external deps.
"""
import sys
import os

import bpy


def main():
    argv = sys.argv
    if "--" in argv:
        idx = argv.index("--")
        args = argv[idx + 1:]
    else:
        args = []

    if len(args) < 2:
        print("Usage: blender --background --python blender_postprocess.py -- input_path output_path")
        sys.exit(1)

    input_path, output_path = args[0], args[1]

    if not os.path.exists(input_path):
        print("Input file not found:", input_path)
        sys.exit(1)

    # Load the image into Blender's data-blocks
    try:
        img = bpy.data.images.load(input_path)
    except Exception:
        # If loading fails, check if it's already loaded
        img = None
        for im in bpy.data.images:
            if os.path.abspath(bpy.path.abspath(im.filepath)) == os.path.abspath(input_path):
                img = im
                break
        if not img:
            print("Failed to load image into Blender:", input_path)
            sys.exit(1)

    # Example processing placeholder: ensure PNG output and save raw image.
    img.filepath_raw = output_path
    img.file_format = 'PNG'
    try:
        img.save()
        print("Saved processed image to", output_path)
    except Exception as e:
        print("Failed to save image:", e)
        sys.exit(1)


if __name__ == '__main__':
    main()
