import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import { spawn, exec } from 'child_process';
import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import ruidaMock from './lib/ruida_mock.js';
import { generateLightburnXML } from './lib/lightburn.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 8000;

// Create HTTP server so we can attach WebSocket server
const server = http.createServer(app);

// Ensure directories exist
const staticDir = path.join(__dirname, 'static');
const generatedDir = path.join(staticDir, 'generated');
const uploadsDir = path.join(staticDir, 'uploads');
const dataDir = path.join(__dirname, 'data');

[staticDir, generatedDir, uploadsDir, dataDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// --- PERIODIC CLEANUP JOB ---
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
const MAX_FILE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const cleanupOldFiles = (directory) => {
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error(`Cleanup error reading directory ${directory}:`, err);
            return;
        }
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(directory, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                if (now - stats.mtimeMs > MAX_FILE_AGE_MS) {
                    fs.unlink(filePath, err => {
                        if (err) console.error(`Failed to delete old file ${filePath}:`, err);
                        else console.log(`Cleaned up old file: ${file}`);
                    });
                }
            });
        });
    });
};

// Run cleanup on startup and then periodically
cleanupOldFiles(generatedDir);
cleanupOldFiles(uploadsDir);
setInterval(() => {
    cleanupOldFiles(generatedDir);
    cleanupOldFiles(uploadsDir);
}, CLEANUP_INTERVAL_MS);

app.use('/static', express.static(staticDir));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toLocaleTimeString()}] 🌍 ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
});

// Render standard .html files using ejs behind the scenes
app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'templates'));

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
        path.join(__dirname, 'DepthForgeApp', '.venv', 'Scripts', 'python.exe'),
        path.join(__dirname, '.venv', 'Scripts', 'python'),
        path.join(__dirname, 'DepthForgeApp', '.venv', 'Scripts', 'python')
    ];

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return process.env.PYTHON_EXEC || (process.platform === 'win32' ? 'python.exe' : 'python');
};

const runPythonProcessor = (command, args) => {
    return new Promise((resolve, reject) => {
        const pythonExec = resolvePythonExecutable();
        // Use -u to run Python in unbuffered mode so print statements are output in real-time
        const pyProg = spawn(pythonExec, ['-u', 'processor.py', command, ...args]);
        
        pyProg.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    console.log(`[Python Processor] ${line.trim()}`);
                }
            });
        });

        let errorOutput = '';
        pyProg.stderr.on('data', (data) => errorOutput += data.toString());
        
        pyProg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Python script failed (${code}): ${errorOutput}`));
        });
        pyProg.on('error', (err) => {
            reject(new Error(`Could not start Python (${pythonExec}): ${err.message}`));
        });
    });
};

// --- ROUTES ---
app.get('/', (req, res) => res.render('landing'));
app.get('/menu', (req, res) => res.render('menu'));
app.get('/depth-map', (req, res) => res.render('depth_map'));
app.get('/help', (req, res) => res.render('help'));
app.get('/submit', (req, res) => res.render('submit'));
app.get('/admin', (req, res) => {
    // In a real-world scenario, you would protect this route with authentication middleware.
    res.render('admin');
});

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
            model: 'imagen-4.0-generate-001',
            prompt: finalPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: "image/png",
                aspectRatio: "1:1"
            }
        });
        
        if (!imageResult || !imageResult.generatedImages || imageResult.generatedImages.length === 0) {
            throw new Error("No image returned from the API. The prompt may have triggered a safety filter, or the model 'imagen-4' is currently unavailable.");
        }

        const filename = `${uuidv4().substring(0, 10)}.png`;
        const filepath = path.join(generatedDir, filename);
        
        const base64Data = imageResult.generatedImages[0].image.imageBytes;
        fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));

        console.log(`[${new Date().toLocaleTimeString()}] ✅ POST /api/generate - Generation complete: ${filename}`);
        res.json({ status: "success", image_url: `/static/generated/${filename}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/postprocess', async (req, res) => {
    console.log(`[${new Date().toLocaleTimeString()}] ⚙️ POST /api/postprocess - Triggering Python helpers...`);
    try {
        const filename = path.basename(req.body.image_url || "");
        const inputPath = path.join(generatedDir, filename);
        const outputPath = path.join(generatedDir, `forge_${filename}`);
        await runPythonProcessor('smooth', [inputPath, outputPath]);
        console.log(`[${new Date().toLocaleTimeString()}] ✅ POST /api/postprocess - Smoothing complete: forge_${filename}`);
        res.json({ status: "success", image_url: `/static/generated/forge_${filename}` });
    } catch (error) {
        console.error("Python smoothing failed, bypassing:", error.message);
        const filename = path.basename(req.body.image_url || "");
        res.json({ status: "success", image_url: `/static/generated/${filename}` });
    }
});

const processMesh = async (imageUrl, extension) => {
    try {
        const filename = path.basename(imageUrl || "");
        const inputPath = path.join(generatedDir, filename);
        const meshPath = path.join(generatedDir, `${path.parse(filename).name}.${extension}`);
        if (!fs.existsSync(meshPath)) {
            if (extension === 'glb') {
                console.log(`[DepthForge] Sending depth map to SpatialScrap edge server on port 8080...`);
                try {
                    const formData = new FormData();
                    const fileBuffer = fs.readFileSync(inputPath);
                    const fileBlob = new Blob([fileBuffer], { type: 'image/png' });
                    formData.append('file', fileBlob, filename);
                    formData.append('target_triangles', '0');
                    formData.append('reduction_ratio', '0.75');
                    formData.append('depth_scale', '0.15');
                    formData.append('depth_downsample', '1');
                    formData.append('depth_pixel_size', '1.0');
                    formData.append('depth_invert', 'false');
                    formData.append('depth_smooth_passes', '1');
                    formData.append('use_blender', 'true');
                    formData.append('bake_relief', 'false');

                    const response = await fetch('http://127.0.0.1:8080/process/sync', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`Edge server error: ${response.status} - ${await response.text()}`);
                    }

                    const arrayBuffer = await response.arrayBuffer();
                    fs.writeFileSync(meshPath, Buffer.from(arrayBuffer));
                    console.log(`[DepthForge] Real GLB generated successfully using SpatialScrap: ${path.basename(meshPath)}`);
                } catch (edgeErr) {
                    console.warn(`[DepthForge] SpatialScrap edge server failed/unavailable, falling back: ${edgeErr.message}`);
                    await runPythonProcessor('mesh', [inputPath, meshPath]);
                }
            } else {
                await runPythonProcessor('mesh', [inputPath, meshPath]);
            }
        }
        return meshPath;
    } catch (error) {
        console.error(`Mesh generation for ${extension} failed, generating fallback.`, error.message);
        const filename = path.basename(imageUrl || "");
        const meshPath = path.join(generatedDir, `${path.parse(filename).name}.${extension}`);
        fs.writeFileSync(meshPath, "solid dummy\nendsolid dummy\n");
        return meshPath;
    }
};

app.post('/api/preview3d', async (req, res) => {
    try {
        const glbPath = await processMesh(req.body.image_url, 'glb');
        res.json({ status: "success", glb_url: `/static/generated/${path.basename(glbPath)}` });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/export_stl', async (req, res) => {
    try {
        const stlPath = await processMesh(req.body.image_url, 'stl');
        res.json({ status: "success", stl_url: `/static/generated/${path.basename(stlPath)}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- In-memory job store + WebSocket notifications ---
const jobs = new Map();

const broadcastJobUpdate = (job) => {
    const payload = JSON.stringify({ type: 'job_update', job });
    wss.clients.forEach((client) => {
        if (client.readyState === 1) client.send(payload);
    });
};

// Basic WebSocket server for job updates
const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (request, socket, head) => {
    // Accept all upgrades to the WS endpoint
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'hello', message: 'Connected to DepthForge job updates' }));
});

// Laser API: prepare job (validate image + enqueue)
app.post('/api/laser/prepare', (req, res) => {
    try {
        const imageUrl = req.body.image_url || '';
        const filename = path.basename(imageUrl);
        const imagePath = path.join(generatedDir, filename);
        if (!fs.existsSync(imagePath)) return res.status(400).json({ error: 'Image not found on server.' });

        const id = uuidv4();
        const job = {
            id,
            image_url: `/static/generated/${filename}`,
            params: req.body.params || {},
            status: 'prepared',
            progress: 0,
            createdAt: new Date().toISOString()
        };
        jobs.set(id, job);
        broadcastJobUpdate(job);
        res.json({ status: 'ok', jobId: id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/queue', async (req, res) => {
    try {
        const allFiles = await fs.promises.readdir(generatedDir);
        const lbrnFiles = allFiles.filter(f => f.endsWith('.lbrn2'));

        const fileDetails = await Promise.all(
            lbrnFiles.map(async (file) => {
                const filePath = path.join(generatedDir, file);
                const stats = await fs.promises.stat(filePath);
                
                // Derive the original PNG filename from the .lbrn2 filename
                const lbrn2BaseName = path.parse(file).name;
                let originalPngBaseName = lbrn2BaseName;
                let studentName = 'Anonymous';

                // If file is labeled with a student name (e.g., Jane_Doe___forge_abc)
                if (lbrn2BaseName.includes('___')) {
                    const parts = lbrn2BaseName.split('___');
                    studentName = parts[0].replace(/_/g, ' '); // Convert safe underscores back to spaces
                    originalPngBaseName = parts[1];
                } else {
                    // Fallback to extract student name if it's implicitly part of the forge_xxx.png name
                    // This handles cases where the original forge_xxx.png might contain a name if that naming convention is also used.
                    const forgeMatch = originalPngBaseName.match(/forge_([a-zA-Z_]+)_/);
                    if (forgeMatch && forgeMatch[1]) {
                        studentName = forgeMatch[1].replace(/_/g, ' ');
                    }
                }
                const originalPng = `${originalPngBaseName}.png`;

                return {
                    lbrn2Filename: file,
                    studentName: studentName,
                    imageUrl: `/static/generated/${originalPng}`,
                    createdAt: stats.mtime,
                };
            })
        );

        // Sort by creation date, newest first
        fileDetails.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json(fileDetails);
    } catch (err) {
        console.error("Admin queue error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Laser API: generate a LightBurn project file
app.post('/api/laser/lightburn', (req, res) => {
    try {
        const imageUrl = req.body.image_url || '';
        const studentName = req.body.student_name || '';
        const originalPngFilename = path.basename(imageUrl);
        const imagePath = path.join(generatedDir, originalPngFilename);
        
        if (!fs.existsSync(imagePath)) {
            return res.status(400).json({ error: 'Image not found on server.' });
        }

        let baseName = path.parse(originalPngFilename).name;
        let lbrn2Filename = `${baseName}.lbrn2`;
        
        if (studentName) {
            const safeName = studentName.replace(/[^a-zA-Z0-9]/g, '_'); // Make OS safe
            lbrn2Filename = `${safeName}___${baseName}.lbrn2`;
        }

        const lbrn2Path = path.join(generatedDir, lbrn2Filename);
        const xmlContent = generateLightburnXML(imagePath, 100, 100);
        
        fs.writeFileSync(lbrn2Path, xmlContent, 'utf-8');
        
        // Attempt to auto-open if requested by the client
        if (req.body.auto_open) {
            let command;
            switch (process.platform) {
                case 'darwin': command = `open "${lbrn2Path}"`; break;
                case 'win32': command = `start "" "${lbrn2Path}"`; break;
                default: command = `xdg-open "${lbrn2Path}"`; break;
            }
            exec(command, (err) => {
                if (err) console.error("Failed to automatically open LightBurn:", err);
            });
        }

        res.json({ status: 'success', lbrn2_url: `/static/generated/${lbrn2Filename}` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Laser API: launch job (requires safety confirmation)
app.post('/api/laser/launch', async (req, res) => {
    try {
        const { jobId, safetyConfirmed } = req.body;
        if (!safetyConfirmed) return res.status(400).json({ error: 'Safety confirmation required.' });
        const job = jobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Job not found.' });
        if (job.status === 'running' || job.status === 'completed') return res.status(400).json({ error: 'Job already started or finished.' });

        job.status = 'running';
        job.startedAt = new Date().toISOString();
        jobs.set(jobId, job);
        broadcastJobUpdate(job);

        // Stream to Ruida (mock). ruidaMock.sendJob will call progress callbacks
        ruidaMock.sendJob(job, (progress) => {
            job.progress = progress;
            broadcastJobUpdate(job);
        }).then(() => {
            job.status = 'completed';
            job.finishedAt = new Date().toISOString();
            job.progress = 100;
            jobs.set(jobId, job);
            broadcastJobUpdate(job);
        }).catch((err) => {
            job.status = 'error';
            job.error = err.message;
            jobs.set(jobId, job);
            broadcastJobUpdate(job);
        });

        res.json({ status: 'launched', jobId });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/laser/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    res.json({ job });
});

const chatCache = {};

app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message || "";
        const sessionId = req.body.sessionId || req.ip || "default";

        if (!userMessage) {
            return res.status(400).json({ error: "Message cannot be empty." });
        }

        if (!chatCache[sessionId]) {
            const systemContext = `You are the helpful AI studio assistant for SLCreations, LLC, located in the Utah Art Alliance 'Art Hub'. You help users learn about 3D relief carvings, OmTech laser engraving, and the DepthForge app. Keep your answers concise, friendly, and helpful.`;
            chatCache[sessionId] = ai.chats.create({
                model: 'gemini-2.5-flash',
                config: {
                    systemInstruction: systemContext
                }
            });
        }

        const chatSession = chatCache[sessionId];
        const chatResponse = await chatSession.sendMessage({ message: userMessage });

        res.json({ reply: chatResponse.text });
    } catch (error) {
        console.error("Chat Engine Error:", error);
        res.status(500).json({ error: "Chat Engine Error" });
    }
});

app.post('/api/lead', (req, res) => {
    try {
        const { name, email, premium_interest } = req.body;
        const timestamp = new Date().toISOString();
        const leadsCsvPath = path.join(dataDir, 'leads.csv');
        
        const header = 'timestamp,name,email,premium_interest\n';
        // Basic CSV-safe formatting: quote strings and escape internal quotes.
        const safeName = `"${(name || '').replace(/"/g, '""')}"`;
        const safeEmail = `"${(email || '').replace(/"/g, '""')}"`;
        const record = `${timestamp},${safeName},${safeEmail},${!!premium_interest}\n`;

        if (!fs.existsSync(leadsCsvPath)) {
            // If file doesn't exist, create it with the header
            fs.writeFileSync(leadsCsvPath, header + record, 'utf-8');
        } else {
            // Otherwise, append the new record
            fs.appendFileSync(leadsCsvPath, record, 'utf-8');
        }

        res.json({ status: "success" });
    } catch (error) {
        console.error('Lead capture failed:', error);
        res.status(500).json({ error: 'Failed to process lead information.' });
    }
});

app.get('/api/admin/leads', (req, res) => {
    try {
        const leadsCsvPath = path.join(dataDir, 'leads.csv');
        if (!fs.existsSync(leadsCsvPath)) {
            return res.json([]);
        }
        
        const fileContent = fs.readFileSync(leadsCsvPath, 'utf-8');
        const lines = fileContent.trim().split('\n');
        
        if (lines.length <= 1) {
            return res.json([]); // Only header or empty
        }
        
        const leads = lines.slice(1).map(line => {
            // Very simple CSV parser for our basic structure
            // Assumes fields are: timestamp, "name", "email", premium_interest
            const parts = [];
            let inQuotes = false;
            let currentPart = '';
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    parts.push(currentPart);
                    currentPart = '';
                } else {
                    currentPart += char;
                }
            }
            parts.push(currentPart);
            
            return {
                timestamp: parts[0] || '',
                name: (parts[1] || '').replace(/^"|"$/g, '').replace(/""/g, '"'),
                email: (parts[2] || '').replace(/^"|"$/g, '').replace(/""/g, '"'),
                premium_interest: parts[3] === 'true'
            };
        });
        
        // Return latest first
        res.json(leads.reverse());
    } catch (error) {
        console.error("Admin leads error:", error);
        res.status(500).json({ error: error.message });
    }
});

const upload = multer({ dest: uploadsDir });
app.post('/api/submit', upload.single('file'), (req, res) => {
    try {
        const { name, email, premium_interest } = req.body;
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: "No file uploaded." });
        }
        const ext = path.extname(file.originalname);
        const safeFilename = `${name}_${uuidv4().substring(0, 4)}${ext}`;
        fs.renameSync(file.path, path.join(uploadsDir, safeFilename));
        res.json({ status: "success", message: "File received!" });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

server.listen(port, '0.0.0.0', () => console.log(`Node.js DepthForge running on http://0.0.0.0:${port}`));