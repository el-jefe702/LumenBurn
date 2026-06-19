<div align="center">
  <img src="static/logo.png" alt="DepthForge Logo" width="150" />
  <h1>DepthForge</h1>
  <p><em>A mixed web and mobile workspace for depth-map generation and CNC laser workflow.</em></p>

  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status" />
</div>

<hr />

## 🌟 Overview

The main runtime operates as a local **Node.js + Express Edge Server** that coordinates a hybrid cloud-and-hardware workflow:

* **Cloud AI Generation (Gemini & Imagen):** Offloads prompt expansion and initial 3D height-map generation to centralized cloud APIs.
* **Local Edge Processing (OpenCV & Python):** Runs bilateral filtering, inpainting, and normalization locally near the hardware to remove stair-stepping artifacts.
* **CNC Laser Toolpathing:** Generates native **LightBurn (.lbrn2)** project files for direct CNC laser integration.
* **Local Web UI & API Hub:** Renders the web interface and exposes API endpoints for student submission queues and hardware controls.

*The repo also includes a native Android Jetpack Compose application and a Blender helper folder for future device and post-processing work.*

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
 ┣ 📂 android_app/      # Native Android Kotlin + Jetpack Compose application
 ┣ 📂 blender_plugin/   # Blender-side helper code and notes
 ┗ 📂 lib/              # LightBurn file generator tools
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
| `GET` | `/api/admin/queue` | 🗃️ Fetches the list of submitted LightBurn files |
| `GET` | `/api/admin/leads` | 📈 Fetches current login sign-up leads |
| `POST` | `/api/generate` | ✨ Improves a text prompt & generates an image |
| `POST` | `/api/postprocess`| 🧽 Smooths a generated image via Python |
| `POST` | `/api/preview3d` | 🧊 Creates a placeholder 3D preview artifact |
| `POST` | `/api/laser/lightburn`| 🎯 Generates a LightBurn `.lbrn2` project file from a depth map |
| `POST` | `/api/chat` | 💬 Gemini-backed assistant chat endpoint |
| `POST` | `/api/submit` | 📂 Uploads a file into `static/uploads/` |

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

`android_app/` is a native Android application built using **Kotlin & Jetpack Compose**. It perfectly mirrors the features and functions of the web UI (Mailing list landing modal, The Forge with full post-processing pipeline visualization, Support AI chat assistant, and the Admin Queue/Leads dashboard) and supports a direct laser launch workflow with live WebSocket status monitoring.

**Typical Workflow:**
1. Open `android_app/` in Android Studio.
2. Sync Gradle.
3. Run the `app` module on an emulator or physical device.

> **Server Configuration & Connection:**
> By default, the app expects the backend server at `http://10.0.2.2:8000` when running in the Android emulator. If you are running on a physical device, tap the **Settings (Gear)** icon in the top-right of any screen to update the Server URL to match your host machine's LAN IP address (e.g., `http://192.168.1.100:8000/`).

---

## 📝 Audit & Dev Notes

- 🎯 **LightBurn Integration:** Laser integration is handled elegantly via downloadable `.lbrn2` LightBurn project files instead of direct machine compilation. 
- 🛡️ **Admin Tools:** The Admin dashboard allows tracking leads and managing the queue of LightBurn files submitted by students. Files can be opened directly into LightBurn from the browser!
- 🧊 **Mesh Generation:** `processor.py` provides smoothing, but 3D mesh generation is currently a placeholder implementation.
- 🗑️ **STL Export:** STL export functionality has been formally removed from the application as the focus shifted fully to the LightBurn laser workflow.

---

<div align="center">
  <i>Developed for SLCreations, LLC</i><br>
  Available under the <a href="LICENSE">MIT License</a>.
</div>