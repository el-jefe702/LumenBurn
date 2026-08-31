import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8000;

// Ensure directories exist
const staticDir = path.join(__dirname, 'static');
const generatedDir = path.join(staticDir, 'generated');
const uploadsDir = path.join(staticDir, 'uploads');

[staticDir, generatedDir, uploadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use('/static', express.static(staticDir));
app.use(express.json({ limit: '50kb' }));

// Global unhandled rejection guard — prevents silent process crashes
process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason);
});


// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleTimeString()}] 🌍 ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

app.get('/', (req, res) => res.redirect('/static/index.html'));

const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY
});
if (!process.env.GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is missing from .env! Image generation will fail.");
}

// --- PROMPT ARCHITECTURE ---
const buildImprovePrompt = (userIdea) => 
    `Act as a master CNC relief artist. User Idea: ${userIdea} ` +
    "TASK: Rewrite this into a highly detailed prompt for a 3D grayscale height map. " +
    "REQUIREMENTS: Demand perfectly smooth continuous gradients, soft shading, and organic rounded transitions. " +
    "Do NOT include any mention of contours, layers, or topography. " +
    "Output in JSON format with key 'improved_prompt'.";

const buildFinalPrompt = (improvedPrompt) => 
    `A perfect, ultra-smooth 3D grayscale height map of ${improvedPrompt}. ` +
    "CRITICAL: The subject must be ISOLATED on a PURE BLACK BACKGROUND (#000000). " +
    "STYLE: Flawless, continuous gradients. Soft, airbrushed shading to represent height. " +
    "TECHNICAL: Pure black to pure white linear Z-axis distribution. " +
    "FORBIDDEN: ABSOLUTELY NO topographic lines, NO contour lines, NO terracing, NO stepped plateaus, NO harsh outlines, NO banding, NO posterization. " +
    "OUTPUT: A perfectly smooth, seamless 16-bit depth map optimized for 3D CNC laser engraving.";

// --- HELPER FOR PYTHON TASKS ---
const resolvePythonExecutable = () => {
    const candidates = [
        process.env.PYTHON_EXEC,
        path.join(__dirname, '.venv', 'Scripts', 'python.exe'),
        path.join(__dirname, '.venv', 'bin', 'python'),
        path.join(__dirname, '.venv', 'Scripts', 'python')
    ];
    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) return candidate;
    }
    return process.env.PYTHON_EXEC || (process.platform === 'win32' ? 'python.exe' : 'python');
};

const runPythonProcessor = (command, args) => {
    return new Promise((resolve, reject) => {
        const pythonExec = resolvePythonExecutable();
        const pyProg = spawn(pythonExec, ['-u', 'processor.py', command, ...args]);
        
        pyProg.stdout.on('data', (data) => console.log(`[Python] ${data.toString().trim()}`));
        let errorOutput = '';
        pyProg.stderr.on('data', (data) => errorOutput += data.toString());
        
        pyProg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Python script failed (${code}): ${errorOutput}`));
        });
        pyProg.on('error', (err) => reject(new Error(`Could not start Python: ${err.message}`)));
    });
};

const photoUpload = multer({
    dest: uploadsDir,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed.'));
        }
        cb(null, true);
    }
});

// --- ROUTES ---

app.post('/api/generate', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] 🚀 POST /api/generate - Starting generation...`);
    try {
        const studentPrompt = req.body.prompt || "";
        
        const improveResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: buildImprovePrompt(studentPrompt),
            config: { responseMimeType: "application/json" }
        });
        const responseJson = JSON.parse(improveResponse.text);
        const finalPrompt = buildFinalPrompt(responseJson.improved_prompt || studentPrompt);
        
        const imageResult = await ai.models.generateImages({
            model: 'imagen-4.0-fast-generate-001',
            prompt: finalPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: "image/png",
                aspectRatio: "1:1"
            }
        });
        
        if (!imageResult?.generatedImages?.length) {
            throw new Error("No image returned from the API.");
        }

        const filename = `${uuidv4().substring(0, 10)}.png`;
        const filepath = path.join(generatedDir, filename);
        
        const base64Data = imageResult.generatedImages[0].image.imageBytes;
        await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));

        res.json({ status: "success", image_url: `/static/generated/${filename}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/postprocess', async (req, res) => {
    const filename = path.basename(req.body.image_url || "");
    if (!filename) return res.status(400).json({ error: 'Missing image_url.' });
    const inputPath = path.join(generatedDir, filename);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Image not found on server.' });
    try {
        const outputPath = path.join(generatedDir, `forge_${filename}`);
        await runPythonProcessor('smooth', [inputPath, outputPath]);
        res.json({ status: "success", image_url: `/static/generated/forge_${filename}` });
    } catch (error) {
        console.error("Python smoothing failed, bypassing:", error.message);
        res.json({ status: "success", image_url: `/static/generated/${filename}` });
    }
});

app.post('/api/remove_bg', async (req, res) => {
    const filename = path.basename(req.body.image_url || "");
    if (!filename) return res.status(400).json({ error: 'Missing image_url.' });
    const inputPath = path.join(generatedDir, filename);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: 'Image not found on server.' });
    try {
        const outputPath = path.join(generatedDir, `iso_${filename}`);
        await runPythonProcessor('remove_bg', [inputPath, outputPath]);
        res.json({ status: "success", image_url: `/static/generated/iso_${filename}` });
    } catch (error) {
        console.error("Python remove_bg failed, bypassing:", error.message);

        res.json({ status: "success", image_url: `/static/generated/${filename}` });
    }
});

app.post('/api/photo-to-depth', photoUpload.single('photo'), async (req, res) => {
    const uploadedPath = req.file?.path;
    try {
        if (!req.file) return res.status(400).json({ error: 'No photo uploaded.' });

        const photoBytes = await fs.promises.readFile(uploadedPath);
        const photoBase64 = photoBytes.toString('base64');
        const mimeType = req.file.mimetype || 'image/jpeg';

        const analysisResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{
                parts: [
                    { inlineData: { mimeType: mimeType, data: photoBase64 } },
                    { text: 'Analyze this photo for 3D depth and spatial structure. Identify the primary subject, its relative depth layers (foreground, midground, background), surface textures, and overall spatial composition. Then write a highly detailed prompt for generating a grayscale 3D height map of this scene. The height map should place the closest/tallest elements in pure white and the farthest/lowest in pure black. REQUIREMENTS: Demand perfectly smooth continuous gradients, soft shading, and organic rounded transitions. Do NOT include any mention of contours, layers, or topography. Output in JSON format with key "depth_prompt" containing the Imagen prompt string, and key "subject_description" with a one-sentence description of what was detected in the photo.' }
                ]
            }],
            config: { responseMimeType: 'application/json' }
        });

        const analysisJson = JSON.parse(analysisResponse.text);
        const depthPrompt = analysisJson.depth_prompt;
        const subjectDescription = analysisJson.subject_description || 'photo subject';

        if (!depthPrompt) throw new Error('Gemini could not analyze depth structure.');

        const finalDepthPrompt = buildFinalPrompt(depthPrompt);

        const imageResult = await ai.models.generateImages({
            model: 'imagen-4.0-fast-generate-001',
            prompt: finalDepthPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1'
            }
        });

        if (!imageResult?.generatedImages?.length) {
            throw new Error('No depth map returned from Imagen.');
        }

        const filename = `photo_depth_${uuidv4().substring(0, 10)}.png`;
        const filepath = path.join(generatedDir, filename);
        const base64Data = imageResult.generatedImages[0].image.imageBytes;
        await fs.promises.writeFile(filepath, Buffer.from(base64Data, 'base64'));

        await fs.promises.unlink(uploadedPath).catch(() => {});

        res.json({
            status: 'success',
            image_url: `/static/generated/${filename}`,
            subject: subjectDescription
        });
    } catch (error) {
        if (uploadedPath) await fs.promises.unlink(uploadedPath).catch(() => {});
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, '0.0.0.0', () => console.log(`DepthForge running on http://0.0.0.0:${port}`));