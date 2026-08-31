<div align="center">
  <img src="static/logo.png" alt="DepthForge Logo" width="150" />
  <h1>DepthForge</h1>
  <p><em>AI-powered 16-bit depth map generator and post-processing pipeline for CNC laser engraving.</em></p>

  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Kotlin-Jetpack%20Compose-7F52FF?style=for-the-badge&logo=kotlin&logoColor=white" alt="Kotlin" />
</div>

<hr />

## Overview

DepthForge generates flawless 16-bit 3D grayscale height maps optimized for CNC laser engraving. It combines **Google Gemini** for intelligent prompt expansion, **Google Imagen 4** for depth map generation, and an **OpenCV post-processing pipeline** for production-quality output.

### Core Features

- **Text-to-Depth**: Describe what you want to carve → AI generates a 16-bit height map
- **Photo-to-Depth**: Upload a photo → Gemini Vision analyzes spatial structure → generates matching depth map
- **Aspect Ratio Selector**: Choose from `1:1` (default), `4:3`, `3:2`, `16:9`, or `2:3` for both text prompt and photo-to-depth modes
- **Post-Processing Pipeline**: 5-stage OpenCV pipeline (16-bit upscaling → inpainting → bilateral filtering → normalization → lossless export)
- **Background Removal**: Isolate subjects onto pure black backgrounds with `rembg`
- **Download**: Export production-ready 16-bit PNG depth maps

### Platforms

- **Web**: Single-page static frontend served from Express with built-in aspect ratio selector
- **Android**: Native Jetpack Compose app (single-screen forge with native aspect ratio chips)

---

## Architecture

```
┌─────────────────────────┐       ┌────────────────────────────────┐
│  Web Browser            │       │  Android App (Kotlin/Compose)  │
│  static/index.html      │       │  Single-screen forge UI        │
└─────────┬───────────────┘       └──────────┬─────────────────────┘
          │ HTTP/REST                         │ HTTP/REST
          ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Express Server (server.js)  — Port 8000                         │
│                                                                  │
│  POST /api/generate        → Gemini + Imagen 4 (aspectRatio)     │
│  POST /api/photo-to-depth  → Gemini Vision + Imagen 4 (ratio)    │
│  POST /api/postprocess     → spawns processor.py smooth           │
│  POST /api/remove_bg       → spawns processor.py remove_bg        │
└───────────────────────────────┬──────────────────────────────────┘
                                │ child_process.spawn
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Python Processor (processor.py)                                 │
│                                                                  │
│  smooth:     8→16bit upscale → inpaint → bilateral → normalize   │
│  remove_bg:  rembg foreground isolation → black background        │
│  export:     16-bit PNG depth map                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+ with `opencv-python`, `numpy`, `rembg`
- **Google Gemini API Key** (set in `.env`)

### Setup

```bash
# Clone
git clone https://github.com/el-jefe702/DepthForge.git
cd DepthForge

# Install Node dependencies
npm install

# Install Python dependencies
pip install opencv-python numpy rembg

# Configure API key
echo "GEMINI_API_KEY=your_key_here" > .env

# Start the server
npm start
```

Open **http://localhost:8000** in your browser.

### Development

```bash
npm run dev    # Hot-reload with --watch
npm test       # Run automated unit & integration test suite
```

---

## API Endpoints

| Endpoint | Method | Body / Params | Response | Description |
|---|---|---|---|---|
| `/api/generate` | POST | `{"prompt": "...", "aspectRatio": "1:1"}` | `{"status": "success", "image_url": "/static/generated/xxx.png"}` | Generates depth map from text prompt. `aspectRatio` defaults to `1:1` (`1:1`, `4:3`, `3:2`, `16:9`, `2:3`). |
| `/api/photo-to-depth` | POST | Multipart `photo` file, optional `aspectRatio` | `{"status": "success", "image_url": "...", "subject": "..."}` | Analyzes photo and generates depth map with requested aspect ratio. |
| `/api/postprocess` | POST | `{"image_url": "..."}` | `{"status": "success", "image_url": "/static/generated/forge_xxx.png"}` | Applies 5-stage OpenCV smoothing pipeline. |
| `/api/remove_bg` | POST | `{"image_url": "..."}` | `{"status": "success", "image_url": "/static/generated/iso_xxx.png"}` | Isolates subject onto pure black background. |

---

## Post-Processing Pipeline

The Python processor (`processor.py`) applies a 5-stage pipeline:

1. **16-Bit Upscaling**: Converts 8-bit (0–255) → 16-bit (0–65535) via ×257 multiplication
2. **Inpainting**: Detects and fills zero-value holes using morphological closing + Telea inpainting
3. **Bilateral Filtering**: `cv2.bilateralFilter(d=9, sigmaColor=5000, sigmaSpace=5)` — removes banding while preserving edges
4. **Normalization**: Linear stretch to full 0–65535 range for maximum Z-axis depth utilization
5. **Lossless Export**: 16-bit PNG with compression level 9

### Interactive Tuner

```bash
python tune_depth.py <input_image>
```

OpenCV GUI with live trackbars for filter parameter adjustment.

---

## Android App

The Android app (`android_app/`) is a native Jetpack Compose application providing the same forge experience on mobile:

- Single-screen UI with text prompt and photo upload modes
- Real-time API communication with the Express server
- Post-processing pipeline animation overlay
- Save depth maps directly to device gallery
- Configurable server URL via settings dialog

### Build

Open `android_app/` in Android Studio and run on device/emulator.

---

## Project Structure

```
DepthForge/
├── server.js                 # Express API server (~240 lines)
├── processor.py              # OpenCV post-processing pipeline
├── tune_depth.py             # Interactive filter tuner
├── package.json              # Node.js dependencies
├── .env                      # GEMINI_API_KEY
├── static/
│   ├── index.html            # Single-page web frontend
│   ├── style.css             # Dark theme design system
│   ├── logo.png / favicon.png
│   ├── generated/            # Output depth maps
│   └── uploads/              # Temp photo uploads
└── android_app/
    └── app/src/main/kotlin/com/depthforge/app/
        ├── MainActivity.kt   # Single-screen Compose UI (~550 lines)
        └── ApiClient.kt      # HTTP API client (~87 lines)
```

---

## License

SLCreations, LLC © 2026