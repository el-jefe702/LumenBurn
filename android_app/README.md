# Native Android App (Kotlin & Jetpack Compose)

This directory contains the native Android application for **DepthForge**. Built with Jetpack Compose, it features a complete user interface and direct backend API connections.

## 🌟 Key Features

* **Landing Page & Lead Form:** Visual entry screen showing the brand logo. Includes a popup mailing list registration form (Full Name, Email, Premium Interest checkbox) that records entries via `/api/lead` and skips prompting on subsequent app launches.
* **The Forge (Depth-Map Generator):** 
  * Generates 16-bit depth maps using prompt entries via the cloud `/api/generate` route.
  * **Aspect Ratio Selector:** Native selectable chips (`1:1`, `4:3`, `3:2`, `16:9`, `2:3`) for custom aspect ratios in both text prompt and photo upload modes.
  * **Invert Depth Map:** Direct action button to invert depth maps via `/api/invert`.
  * **Post-Processing pipeline animation:** A beautiful visual sequence demonstrating the bilateral filtering, inpainting, scaling, normalization, and export stages during `/api/postprocess`.
  * **Admin Queue Submission:** Prompts for student name and exports the LightBurn project file to `/api/laser/lightburn` on the server.
  * **Direct Spindle Control:** Strict safety check dialog verifying laser pathway clear and exhaust active. Authenticated with typed `CONFIRM` verification. It initiates the Ruida mock sequence and streams status updates over WebSockets (`/ws`) or fallback HTTP status polling.
* **Support AI:** Direct chat connection with the SLCreations studio assistant (via `/api/chat`), with unique local session persistence.
* **Admin Dashboard:** Access to the Student Queue (with direct "Open in LightBurn" triggers) and Login Leads tracker.
* **Dynamic Connection Settings:** Tap the **Settings (Gear)** icon in the top-right corner of any screen to quickly adjust the API Base URL.

---

## 🚀 Getting Started

### 1. Open the Project
Open the `android_app/` folder directly in **Android Studio**.

### 2. Sync and Build
Let Gradle sync project dependencies, and build the `app` configuration.

### 3. Setup Connection Address
* **Android Emulator:** The emulator automatically routes localhost of your computer to `http://10.0.2.2:8000/`. This is the default.
* **Physical Device:** Ensure your phone is connected to the same Wi-Fi network as your host machine. Tap the gear icon in the top-right corner of the app's landing screen and enter your computer's LAN IP address (e.g. `http://192.168.1.100:8000/`).

---

## 🛠️ Tech Stack & Dependencies
* **Core:** Kotlin & Jetpack Compose (Material 2 Theme)
* **Networking & Parsing:** OkHttp3 & Gson (using coroutines for asynchronous calls)
* **Status Updates:** WebSocket connections for Ruida job updates, with regular HTTP polling fallbacks.
