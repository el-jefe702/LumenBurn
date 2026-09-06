<div align="center">
  <h1>⚡ DepthForge</h1>
  <p><strong>AI-Powered 16-bit 3D Relief & Depth Map Generator for CNC Laser Engraving</strong></p>

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
- **Aspect Ratio Selector (F1)**: Choose from `1:1` (default), `4:3`, `3:2`, `16:9`, or `2:3` for both text prompt and photo-to-depth modes
- **Invert Depth Map (F2)**: Invert depth values (`65535 - pixel` for 16-bit, `255 - pixel` for 8-bit) to switch between convex/concave reliefs
- **Prompt History (F3)**: Automatically persists recent prompts in `localStorage` / `SharedPreferences` with quick selection and clear support
- **Real-Time Pipeline Progress via SSE (F4)**: Live 5-step progress streaming over Server-Sent Events (`/api/postprocess-stream`)
- **Session Gallery / History Panel (F5)**: Horizontal scrollable thumbnail strip below the preview area displaying all generated and post-processed versions in the session. Clicking any thumbnail restores that version to the active preview with all action buttons (Invert, Remove BG, Polish, Download) re-targeted to it. Includes Hide/Show and Clear controls.
- **Depth Intensity Slider (F6)**: Adjust carve depth and relief contrast from 0 to 100% (default 70%). Modulates prompts dynamically: 0–30% produces gentle, shallow relief with subtle height transitions; 31–69% applies standard relief depth; 70–100% generates dramatic, maximum-depth carving with extreme black-to-white contrast. Includes full WCAG 2.1 AA accessibility (ARIA value indicators, title tooltips, keyboard focus states) and automatic panel synchronization.
- **Background Removal**: Isolate subjects onto pure black backgrounds with `rembg`
- **Lossless Export**: Export production-ready 16-bit PNG depth maps

### Platforms

- **Web**: Single-page static frontend served from Express with built-in aspect ratio selector, depth intensity slider, prompt history, session gallery, real-time SSE progress, and action controls
- **Android**: Native Jetpack Compose app (single-screen forge with native chips, depth intensity slider, prompt history dropdown, session gallery LazyRow, real-time SSE animation, and action controls)

---

## Architecture

```
┌─────────────────────────┐       ┌────────────────────────────────┐
│  Web Browser            │       │  Android App (Kotlin/Compose)  │
│  static/index.html      │       │  Single-screen forge UI        │
└─────────┬───────────────┘       └──────────┬─────────────────────┘
          │ HTTP/REST / SSE                   │ HTTP/REST / SSE
          ▼                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│  Express Server (server.js)  — Port 8000                         │
│                                                                  │
│  POST /api/generate            → Gemini + Imagen 4 (aspectRatio, depth_intensity) │
│  POST /api/photo-to-depth      → Gemini Vision + Imagen 4 (depth_intensity)       │
│  POST /api/invert              → spawns processor.py invert      │
│  GET  /api/postprocess-stream  → spawns processor.py smooth (SSE)│
│  POST /api/remove_bg           → spawns processor.py remove_bg   │
│  POST /api/lumenburn/convert   → SVG to LBRN2 XML conversion     │
└───────────────────────────────┬──────────────────────────────────┘
                                │ child_process.spawn
                                ▼
┌──────────────────────────────────────────────────────────────────┐
│  Python Processor (processor.py)                                 │
│                                                                  │
│  invert:     pixel inversion (65535 - pixel / 255 - pixel)       │
│  smooth:     8→16bit upscale → inpaint → bilateral → normalize   │
│  remove_bg:  rembg foreground isolation → black background       │
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
| `/api/generate` | POST | `{"prompt": "...", "aspectRatio": "1:1", "depth_intensity": 70}` | `{"status": "success", "image_url": "/static/generated/xxx.png"}` | Generates depth map from text prompt. `aspectRatio` defaults to `1:1` (`1:1`, `4:3`, `3:2`, `16:9`, `2:3`). `depth_intensity` (0–100) defaults to `70`. |
| `/api/photo-to-depth` | POST | Multipart `photo` file, optional `aspectRatio`, optional `depth_intensity` | `{"status": "success", "image_url": "...", "subject": "..."}` | Analyzes photo and generates depth map with requested aspect ratio and depth intensity (default 70). |
| `/api/invert` | POST | `{"image_url": "..."}` | `{"status": "success", "image_url": "/static/generated/inv_xxx.png"}` | Inverts depth map pixel values (16-bit or 8-bit). |
| `/api/postprocess-stream` | GET / POST | `?image_url=...` | `text/event-stream` | Streams 5-step smoothing progress in real-time over SSE. |
| `/api/remove_bg` | POST | `{"image_url": "..."}` | `{"status": "success", "image_url": "/static/generated/iso_xxx.png"}` | Isolates subject onto pure black background. |
| `/api/lumenburn/convert` | POST | Multipart `svg` file | `application/xml` | Converts SVG path data to LightBurn .lbrn2 project file. |

---

## Post-Processing Pipeline

The Python processor (`processor.py`) applies a 5-stage pipeline:

1. **16-Bit Upscaling**: Converts 8-bit (0–255) → 16-bit (0–65535) via ×257 multiplication
2. **Inpainting**: Detects and fills zero-value holes using morphological closing + Telea inpainting
3. **Bilateral Filtering**: `cv2.bilateralFilter(d=9, sigmaColor=5000, sigmaSpace=5)` — removes banding while preserving edges
4. **Normalization**: Linear stretch to full 0–65535 range for maximum Z-axis depth utilization
5. **Lossless Export**: 16-bit PNG with compression level 9

---

## Android App

The Android app (`android_app/`) is a native Jetpack Compose application providing the same forge experience on mobile:

- Single-screen UI with text prompt and photo upload modes
- Native prompt history dropdown and aspect ratio chip selectors
- Horizontal session gallery thumbnail strip with restore and clear/hide controls
- Real-time SSE post-processing progress animation
- Save depth maps directly to device gallery
- Configurable server URL via settings dialog

---

## License

SLCreations, LLC © 2026