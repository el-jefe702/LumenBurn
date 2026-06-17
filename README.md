<div align="center">
  <img src="static/logo.png" alt="DepthForge Logo" width="150" />
  <h1>DepthForge</h1>
  <p><em>A mixed web and mobile workspace for depth-map generation and laser workflow prototyping.</em></p>

  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Status-Prototyping-FF8C00?style=for-the-badge" alt="Status" />
</div>

<hr />

## 🌟 Overview

The main runtime is a **Node.js + Express** server that:

🎨 Renders the beautifully styled web UI from `templates/`  
🧠 Generates depth-map images utilizing **Google Gemini / Imagen**  
⚙️ Post-processes images with custom **Python** helpers  
🚀 Exposes a mock laser job workflow over HTTP and WebSocket  
📁 Serves generated files and assets from `static/`  

*The repo also includes an Android Studio WebView scaffold and a Blender helper folder for future device and post-processing work.*

## 📋 Table of Contents
- [Repository Layout](#-repository-layout)
- [Requirements](#-requirements)
- [Setup & Installation](#-setup--installation)
- [Run the Web App](#-run-the-web-app)
- [Web API & Features](#-web-api--features)
- [Python Helpers](#-python-helpers)
- [Android App](#-android-app)
- [Audit & Dev Notes](#-audit--dev-notes)

---

## 🏗️ Repository Layout

```text
📦 DepthForge
 ┣ 📜 server.js         # Primary Express application and API surface
 ┣ 📜 processor.py      # Image smoothing and mesh placeholder helpers
 ┣ 📜 tune_depth.py     # Interactive OpenCV depth-map tuner
 ┣ 📂 templates/        # HTML pages for the web UI
 ┣ 📂 static/           # Uploaded and generated assets (images, STLs, etc.)
 ┣ 📂 android_app/      # Android WebView scaffold mirroring the local server
 ┣ 📂 blender_plugin/   # Blender-side helper code and notes
 ┗ 📂 lib/              # LightBurn file generator and mock machine controllers
```

---

## 💻 Requirements

- **Node.js:** 18 or newer
- **npm:** Node Package Manager
- **Python:** 3.10+ *(if you want the smoothing or mesh helper paths to run)*
- **API Key:** A Google Gemini API key mapped in `GEMINI_API_KEY`
- **Android Studio:** *(Optional)* if you want to build the Android app
- **LightBurn:** Installed locally to open the exported `.lbrn2` files

---

## 🛠️ Setup & Installation

**1. Install the Node dependencies:**
```bash
npm install
```

**2. Configure Environment Variables:**
Create a `.env` file in the repo root and add your keys:
```env
GEMINI_API_KEY=your_api_key_here
PORT=8000
# Optional: point this at a specific Python executable if needed
# PYTHON_EXEC=C:\Path\To\python.exe
```

**3. Install Python Dependencies:**
If you plan to use the Python helpers, install the required packages:
```bash
pip install opencv-python numpy
```

---

## 🚀 Run the Web App

Start the server from the repo root:

```bash
npm start
```

> **Note:** The app listens on `http://localhost:8000` by default.

---

## 🌐 Web API & Features

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | 🏠 Landing page |
| `GET` | `/menu` | 📋 Main menu page |
| `GET` | `/depth-map` | 🗺️ Depth-map generation page |
| `GET` | `/help` | ❓ Help and support page |
| `GET` | `/submit` | 📤 User submission page |
| `GET` | `/admin` | 🛡️ Admin dashboard |
| `GET` | `/api/admin/queue` | 🗃️ Fetches current laser queue jobs |
| `GET` | `/api/admin/leads` | 📈 Fetches current login sign-up leads |
| `POST` | `/api/generate` | ✨ Improves a text prompt & generates an image |
| `POST` | `/api/postprocess`| 🧽 Smooths a generated image via Python |
| `POST` | `/api/preview3d` | 🧊 Creates a placeholder 3D preview artifact |
| `POST` | `/api/laser/prepare`| 🔍 Validates an image and creates a mock laser job |
| `POST` | `/api/laser/launch` | 🚀 Launches the mock laser workflow (requires safety check) |
| `GET` | `/api/laser/status/:jobId`| ⏳ Checks the current state of a job |
| `POST` | `/api/chat` | 💬 Gemini-backed assistant chat endpoint |
| `POST` | `/api/submit` | 📂 Uploads a file into `static/uploads/` |

> *WebSocket clients receive real-time job updates from the same server instance.*

---

## 🐍 Python Helpers

The Node server calls `processor.py` for two helper commands:
- **`smooth`** - Applies bilateral and Gaussian smoothing to a depth map.
- **`mesh`** - Writes a placeholder mesh file so the API can return an artifact even when real mesh generation is not implemented yet.

**Interactive Tuner Script:**
You can run the tuner script manually against a depth image to adjust settings:
```bash
python tune_depth.py path\to\image.png
```

---

## 📱 Android App

`android_app/` is an Android application that perfectly mirrors the web UI using a **WebView wrapper**. It expects the local server at `http://10.0.2.2:8000` when running on the Android emulator.

**Typical Workflow:**
1. Open `android_app/` in Android Studio.
2. Sync Gradle.
3. Run the `app` module on an emulator or physical device.

> **Running on a Physical Device:**
> Update `WebViewScreen("http://10.0.2.2:8000/")` in `android_app/app/src/main/kotlin/com/depthforge/app/MainActivity.kt` to match your machine's LAN IP address.

---

## 📝 Audit & Dev Notes

- ⚠️ **Machine Connection:** The laser workflow is currently mocked in `lib/ruida_mock.js`; it is not connected to a real machine yet.
- ⚙️ **Compiler Needs:** True machine communication will require integrating a compiler to convert PNG depth maps into `.rd` files and activating the UDP client located in `lib/ruida_udp.js`.
- 🧊 **Mesh Generation:** `processor.py` provides smoothing, but 3D mesh generation is currently a placeholder implementation.
- 🗑️ **STL Export:** STL export functionality has been removed from the application.
- 🛡️ **Admin Tools:** The Admin dashboard allows tracking leads and pending laser queue items effortlessly.

---

<div align="center">
  <i>Developed for SLCreations, LLC</i><br>
  Available under the <a href="LICENSE">MIT License</a>.
</div>