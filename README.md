# 🔥 DepthForge
> **Laser Class Assistant & 3D Relief Generator by SLCreations, LLC**

DepthForge is a custom FastAPI web application designed specifically for studio operations. It streamlines the CNC laser engraving workflow for the OmTech 100W CO2 laser by providing in-house AI tools for 16-bit depth map generation, student file drops, and an intelligent studio assistant.

---

## ✨ Features

* **The Forge (Depth Map Generator):** Leverages Google's Imagen 4.0 and Gemini 2.5 models to convert standard prompts into flawless, ultra-smooth 16-bit grayscale height maps optimized for 3D relief carving in maple wood.
* **AI Support Desk:** A custom-trained Gemini 2.5 assistant that helps students troubleshoot OmTech laser settings, material constraints, and CNC workflows.
* **Class File Drop:** A lead-generation and file submission portal where students can securely upload their `.png`, `.svg`, or `.ai` files directly to the studio queue, automatically logging their data to a local `students.json` database.
* **Class Syllabus:** Digital presentation deck (`depthforge_presentation.html`) for laser class recaps, aesthetic vision, and safety instruction.

## 🛠️ Tech Stack

| Component | Technology |
| :--- | :--- |
| **Backend** | FastAPI, Python 3 |
| **AI Engine** | Google GenAI SDK (`gemini-2.5-flash-preview-09-2025`, `imagen-4.0-generate-001`) |
| **Frontend** | HTML5, Tailwind CSS, JavaScript (Fetch API) |
| **Server** | Uvicorn |

---

## 🚀 Installation & Setup

### Prerequisites
Ensure you have **Python 3.10+** installed on your machine.

### 1. Clone the repository
```bash
git clone [https://github.com/your-username/DepthForge.git](https://github.com/your-username/DepthForge.git)
cd DepthForge
2. Create and activate a virtual environment
PowerShell
python -m venv .venv
.\.venv\Scripts\activate
3. Install dependencies
PowerShell
pip install fastapi uvicorn google-genai python-multipart python-dotenv jinja2
4. Environment Setup
Create a .env file in the root directory and add your Google Gemini API key:

Code snippet
GEMINI_API_KEY=your_api_key_here
5. Directory Setup
The application will automatically generate the static/generated and static/uploads folders upon the first run. Ensure you place your logo.png and favicon.png in the base static/ directory before launching.

⚡ Running the Application
Start the local Uvicorn server from your active virtual environment:

PowerShell
python -m uvicorn main:app --reload
The app will instantly be available at http://127.0.0.1:8000.

📂 Directory Structure
Plaintext
DepthForge/
├── main.py                          # Core FastAPI backend and routing
├── .env                             # API keys and environment variables (Not tracked in Git)
├── students.json                    # Auto-generated database for student leads
├── depthforge_presentation.html     # Class syllabus and pitch deck
├── templates/                       # HTML UI templates
│   ├── landing.html                 # Title screen
│   ├── menu.html                    # Main navigation hub
│   ├── depth_map.html               # Imagen 4.0 generator UI
│   ├── help.html                    # AI chat support UI
│   └── submit.html                  # File drop and lead capture UI
└── static/                          # Static assets and auto-created folders
    ├── logo.png                     # SLCreations branding
    ├── favicon.png                  
    ├── generated/                   # AI generated depth maps save here
    └── uploads/                     # Student submitted files save here
© 2026 SLCreations, LLC. All rights reserved. Built for internal studio operations at the Utah Art Alliance 'Art Hub'.
