import os
import json
import uuid
import traceback
from fastapi import FastAPI, Request, Form, File, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import uvicorn
from dotenv import load_dotenv

# Import the new Google GenAI SDK exclusively
from google import genai
from google.genai import types

# Load environment variables from .env file
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize the Gemini Client
if API_KEY:
    client = genai.Client(api_key=API_KEY)
else:
    print("WARNING: GEMINI_API_KEY not found in .env file!")
    client = None

app = FastAPI(title="DepthForge - 3D Relief Assistant")

# Ensure our directories exist
os.makedirs("static", exist_ok=True)
os.makedirs("static/generated", exist_ok=True)
os.makedirs("static/uploads", exist_ok=True) # Folder for student file drops

# Mount the static directory
app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

# --- PROMPT ARCHITECTURE ---
def build_improve_prompt(user_idea: str) -> str:
    return (
        f"Act as a master CNC relief artist. User Idea: {user_idea} "
        "TASK: Rewrite this into a highly detailed prompt for a 3D grayscale height map. "
        "REQUIREMENTS: Demand perfectly smooth continuous gradients, soft shading, and organic rounded transitions. "
        "Do NOT include any mention of contours, layers, or topography. "
        "Output in JSON format with key 'improved_prompt'."
    )

def build_final_prompt(improved_prompt: str) -> str:
    return (
        f"A perfect, ultra-smooth 3D grayscale height map of {improved_prompt}. "
        "CRITICAL: The subject must be ISOLATED on a PURE BLACK BACKGROUND (#000000). "
        "STYLE: Flawless, continuous gradients. Soft, airbrushed shading to represent height. "
        "TECHNICAL: Pure black to pure white linear Z-axis distribution. "
        "FORBIDDEN: ABSOLUTELY NO topographic lines, NO contour lines, NO terracing, NO stepped plateaus, NO harsh outlines, NO banding, NO posterization. "
        "OUTPUT: A perfectly smooth, seamless 16-bit depth map optimized for 3D CNC laser engraving."
    )

@app.get("/", response_class=HTMLResponse)
async def read_landing(request: Request):
    return templates.TemplateResponse(request=request, name="landing.html", context={"request": request})

@app.get("/menu", response_class=HTMLResponse)
async def read_menu(request: Request):
    return templates.TemplateResponse(request=request, name="menu.html", context={"request": request})

@app.get("/depth-map", response_class=HTMLResponse)
async def read_depth_map(request: Request):
    return templates.TemplateResponse(request=request, name="depth_map.html", context={"request": request})

@app.get("/help", response_class=HTMLResponse)
async def read_help(request: Request):
    return templates.TemplateResponse(request=request, name="help.html", context={"request": request})

@app.get("/submit", response_class=HTMLResponse)
async def read_submit(request: Request):
    """Serves the Student Class File Drop form."""
    return templates.TemplateResponse(request=request, name="submit.html", context={"request": request})

@app.post("/api/generate")
async def generate_depth_map(request: Request):
    if not client:
        return JSONResponse(status_code=500, content={"error": "API key missing."})

    try:
        data = await request.json()
        student_prompt = data.get("prompt", "")
        if not student_prompt:
            return JSONResponse(status_code=400, content={"error": "Prompt cannot be empty."})

        # Step 1: Improve prompt (Using Gemini 2.5)
        try:
            improve_response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=build_improve_prompt(student_prompt),
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            response_json = json.loads(improve_response.text)
            improved_prompt = response_json.get("improved_prompt", student_prompt)
        except Exception as text_err:
            print(f"[2] Warning: Prompt Improver failed ({text_err}). Using original.")
            improved_prompt = student_prompt

        # Step 2: Generate image (Using Imagen 4.0)
        final_prompt = build_final_prompt(improved_prompt)
        image_result = client.models.generate_images(
            model='imagen-4.0-generate-001',
            prompt=final_prompt,
            config=types.GenerateImagesConfig(number_of_images=1, output_mime_type="image/png", aspectRatio="1:1")
        )

        # Step 3: Save
        generated_image = image_result.generated_images[0]
        filename = f"{uuid.uuid4().hex[:10]}.png"
        filepath = os.path.join("static", "generated", filename)
        with open(filepath, "wb") as f:
            f.write(generated_image.image.image_bytes)

        return JSONResponse(content={"status": "success", "image_url": f"/static/generated/{filename}"})

    except Exception:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Forge Engine Error"})

@app.post("/api/chat")
async def chat_endpoint(request: Request):
    if not client:
        return JSONResponse(status_code=500, content={"error": "API key missing."})

    try:
        data = await request.json()
        user_message = data.get("message", "")
        
        if not user_message:
            return JSONResponse(status_code=400, content={"error": "Message cannot be empty."})

        system_context = (
            "You are the helpful AI studio assistant for SLCreations, LLC, located in the Utah Art Alliance 'Art Hub'. "
            "You help users learn about 3D relief carvings, OmTech laser engraving, and the DepthForge app. "
            "Keep your answers concise, friendly, and helpful. "
            f"User asks: {user_message}"
        )

        # Chat model updated to Gemini 2.5
        chat_response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=system_context,
            config=types.GenerateContentConfig(response_mime_type="text/plain")
        )
        
        return JSONResponse(content={"reply": chat_response.text})

    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": "Chat Engine Error"})

@app.post("/api/submit")
async def handle_submission(
    name: str = Form(...),
    email: str = Form(...),
    premium_interest: bool = Form(False),
    file: UploadFile = File(...)
):
    """Handles the student file drop and saves their lead info with their name as the file name."""
    try:
        # Get the file extension (e.g., png, jpg, ai)
        file_ext = file.filename.split(".")[-1]
        
        # Scrub the student's name of any weird characters so Windows doesn't freak out
        clean_name = "".join(c for c in name if c.isalnum() or c in (' ', '_', '-')).strip().replace(' ', '_')
        
        # Create a file name like: "Jeff_Smith_a1b2.png" 
        # (The short random code at the end prevents overwriting if they upload a second time)
        safe_filename = f"{clean_name}_{uuid.uuid4().hex[:4]}.{file_ext}"
        filepath = os.path.join("static", "uploads", safe_filename)
        
        with open(filepath, "wb") as f:
            f.write(await file.read())
            
        # Log the student info to your JSON database file
        student_data = {
            "name": name,
            "email": email,
            "premium_interest": premium_interest,
            "uploaded_file": safe_filename
        }
        
        db_path = "students.json"
        existing_data = []
        if os.path.exists(db_path):
            with open(db_path, "r") as db:
                existing_data = json.load(db)
                
        existing_data.append(student_data)
        
        with open(db_path, "w") as db:
            json.dump(existing_data, db, indent=4)
            
        return JSONResponse(content={"status": "success", "message": "File received securely!"})
        
    except Exception as e:
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)