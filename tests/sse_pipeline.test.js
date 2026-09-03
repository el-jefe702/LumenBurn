import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Set NODE_ENV to test to avoid starting listening server
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test_key';

const { app, parseStepFromLog } = await import('../server.js');

describe('Real-Time Pipeline Progress via SSE (F4) - Unit & Integration Tests', () => {

    describe('1. Step Parser Logic (parseStepFromLog)', () => {
        test('correctly parses [STEP 1/5] to [STEP 5/5] formatted log lines', () => {
            assert.equal(parseStepFromLog('[STEP 1/5] Loading image and converting to 16-bit grayscale...'), 1);
            assert.equal(parseStepFromLog('[STEP 2/5] Identifying and cleaning up missing data (inpainting)...'), 2);
            assert.equal(parseStepFromLog('[STEP 3/5] Applying bilateral spatial filtering to fix banding while preserving edges...'), 3);
            assert.equal(parseStepFromLog('[STEP 4/5] Stretching depth values to normalize full 16-bit range...'), 4);
            assert.equal(parseStepFromLog('[STEP 5/5] Exporting processed 16-bit PNG to /path/out.png...'), 5);
        });

        test('handles variations in case and spacing in [step X/Y] tags', () => {
            assert.equal(parseStepFromLog('[step 1/5] Loading image'), 1);
            assert.equal(parseStepFromLog('[STEP  2/5] Inpainting'), 2);
            assert.equal(parseStepFromLog('[STEP 3/5] Filtering'), 3);
            assert.equal(parseStepFromLog('[Step 4/5] Normalizing'), 4);
            assert.equal(parseStepFromLog('[STEP 5/5] Exporting'), 5);
        });

        test('fallback heuristic matches relevant processing keywords', () => {
            assert.equal(parseStepFromLog('Loading image and converting to 16-bit grayscale...'), 1);
            assert.equal(parseStepFromLog('Upscaling from 8-bit to 16-bit'), 1);
            assert.equal(parseStepFromLog('Identifying and cleaning up missing data (inpainting)...'), 2);
            assert.equal(parseStepFromLog('Large missing data holes detected; applying telea inpainting...'), 2);
            assert.equal(parseStepFromLog('Applying bilateral spatial filtering to fix banding while preserving edges...'), 3);
            assert.equal(parseStepFromLog('Applying Gaussian blur to smooth micro-textures...'), 3);
            assert.equal(parseStepFromLog('Stretching depth values to normalize full 16-bit range...'), 4);
            assert.equal(parseStepFromLog('Exporting processed 16-bit PNG to output.png...'), 5);
        });

        test('returns null for non-step logs and invalid inputs', () => {
            assert.equal(parseStepFromLog(''), null);
            assert.equal(parseStepFromLog('Random log line'), null);
            assert.equal(parseStepFromLog(null), null);
            assert.equal(parseStepFromLog(undefined), null);
            assert.equal(parseStepFromLog(123), null);
            assert.equal(parseStepFromLog({}), null);
        });
    });

    describe('2. Live Server SSE Endpoint (/api/postprocess-stream)', () => {
        test('configures standard SSE streaming headers including X-Accel-Buffering', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream?image_url=`);
                assert.equal(response.headers.get('content-type'), 'text/event-stream');
                assert.ok(response.headers.get('cache-control')?.includes('no-cache'));
                assert.equal(response.headers.get('x-accel-buffering'), 'no');
                assert.equal(response.headers.get('connection'), 'keep-alive');
            } finally {
                server.close();
            }
        });

        test('returns SSE error event when image_url is missing via GET', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream`);
                const text = await response.text();
                assert.ok(text.startsWith('data: '));
                const jsonStr = text.replace(/^data:\s*/, '').trim();
                const data = JSON.parse(jsonStr);
                assert.equal(data.status, 'error');
                assert.equal(data.error, 'Missing image_url.');
            } finally {
                server.close();
            }
        });

        test('returns SSE error event when image_url is missing via POST', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });
                const text = await response.text();
                assert.ok(text.startsWith('data: '));
                const jsonStr = text.replace(/^data:\s*/, '').trim();
                const data = JSON.parse(jsonStr);
                assert.equal(data.status, 'error');
                assert.equal(data.error, 'Missing image_url.');
            } finally {
                server.close();
            }
        });

        test('returns SSE error event when image file is not found on server', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream?image_url=/static/generated/non_existent_image_123.png`);
                const text = await response.text();
                assert.ok(text.startsWith('data: '));
                const jsonStr = text.replace(/^data:\s*/, '').trim();
                const data = JSON.parse(jsonStr);
                assert.equal(data.status, 'error');
                assert.equal(data.error, 'Image not found on server.');
            } finally {
                server.close();
            }
        });

        test('safely handles path traversal attempts without leaking files', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream?image_url=../../package.json`);
                const text = await response.text();
                assert.ok(text.includes('data:'));
                const jsonStr = text.replace(/^data:\s*/, '').trim();
                const data = JSON.parse(jsonStr);
                assert.equal(data.status, 'error');
                assert.equal(data.error, 'Image not found on server.');
            } finally {
                server.close();
            }
        });

        test('handles query parameters and hash fragments in image_url', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream?image_url=/static/generated/sample.png?v=12345#ref`);
                const text = await response.text();
                assert.ok(text.includes('data:'));
                const jsonStr = text.replace(/^data:\s*/, '').trim();
                const data = JSON.parse(jsonStr);
                assert.equal(data.status, 'error');
                assert.equal(data.error, 'Image not found on server.');
            } finally {
                server.close();
            }
        });

        test('rejects directory paths and dot paths as invalid image_url', async () => {
            const server = app.listen(0);
            const port = server.address().port;

            try {
                for (const badPath of ['.', '..', '   ', '/static/generated/']) {
                    const response = await fetch(`http://127.0.0.1:${port}/api/postprocess-stream?image_url=${encodeURIComponent(badPath)}`);
                    const text = await response.text();
                    assert.ok(text.includes('data:'));
                    const jsonStr = text.replace(/^data:\s*/, '').trim();
                    const data = JSON.parse(jsonStr);
                    assert.equal(data.status, 'error');
                }
            } finally {
                server.close();
            }
        });
    });

    describe('3. Stream Line Chunk Buffering Contract', () => {
        test('assembles fragmented chunks across line boundaries without dropping steps', () => {
            let buffer = '';
            const events = [];

            const simulateChunk = (chunk) => {
                buffer += chunk;
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    const step = parseStepFromLog(line);
                    if (step) {
                        events.push({ step, message: line });
                    }
                }
            };

            // Send fragmented chunks
            simulateChunk('[STEP 1/');
            simulateChunk('5] Loading image and converting...\n[STEP');
            simulateChunk(' 2/5] Inpainting holes...\r\n');
            simulateChunk('[STEP 3/5] Bilateral filter\r\n[STEP 4/5] Normalizing\n[STEP 5/5] Exporting');

            // Close stream and flush buffer
            if (buffer.trim()) {
                const remainingLine = buffer.trim();
                const step = parseStepFromLog(remainingLine);
                if (step) events.push({ step, message: remainingLine });
            }

            assert.equal(events.length, 5);
            assert.deepEqual(events.map(e => e.step), [1, 2, 3, 4, 5]);
        });

        test('handles mixed CRLF and LF line separators in chunk buffering', () => {
            let buffer = '';
            const events = [];

            const simulateChunk = (chunk) => {
                buffer += chunk;
                const lines = buffer.split(/\r?\n/);
                buffer = lines.pop() || '';
                for (const rawLine of lines) {
                    const line = rawLine.trim();
                    if (!line) continue;
                    const step = parseStepFromLog(line);
                    if (step) events.push({ step, message: line });
                }
            };

            simulateChunk('[STEP 1/5] Loading\r\n[STEP 2/5] Inpainting\n[STEP 3/5] Filtering\r\n');
            assert.equal(events.length, 3);
            assert.deepEqual(events.map(e => e.step), [1, 2, 3]);
        });
    });

    describe('4. Web UI & Assets Parity', () => {
        const webHtml = fs.readFileSync(path.join(rootDir, 'static', 'index.html'), 'utf-8');
        const androidHtml = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'assets', 'index.html'), 'utf-8');
        const webCss = fs.readFileSync(path.join(rootDir, 'static', 'style.css'), 'utf-8');
        const androidCss = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'assets', 'style.css'), 'utf-8');
        const androidStaticCss = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'assets', 'static', 'style.css'), 'utf-8');

        test('index.html is identical between static/ and android assets', () => {
            assert.equal(webHtml, androidHtml);
        });

        test('style.css is identical between static/ and android assets', () => {
            assert.equal(webCss, androidCss);
            assert.equal(webCss, androidStaticCss);
        });

        test('HTML contains pipeline overlay with 5 discrete steps', () => {
            assert.ok(webHtml.includes('id="pipelineOverlay"'));
            assert.ok(webHtml.includes('id="step1"'));
            assert.ok(webHtml.includes('id="step2"'));
            assert.ok(webHtml.includes('id="step3"'));
            assert.ok(webHtml.includes('id="step4"'));
            assert.ok(webHtml.includes('id="step5"'));
        });

        test('HTML JS subscribes to /api/postprocess-stream using EventSource', () => {
            assert.ok(webHtml.includes('new EventSource('));
            assert.ok(webHtml.includes('/api/postprocess-stream'));
            assert.ok(webHtml.includes('eventSource.onmessage'));
            assert.ok(webHtml.includes('eventSource.onerror'));
            assert.ok(webHtml.includes('eventSource.close()'));
        });

        test('HTML JS contains safety watchdog timeout and cleanup handler', () => {
            assert.ok(webHtml.includes('streamTimeout'));
            assert.ok(webHtml.includes('clearTimeout(streamTimeout)'));
            assert.ok(webHtml.includes('120000'));
        });

        test('HTML JS completely removes fake setTimeout pipeline step animation loop', () => {
            assert.ok(!webHtml.includes('setTimeout(r, 2500)'));
            assert.ok(!webHtml.includes('setTimeout(r,2500)'));
        });

        test('HTML JS defines setPipelineStep to dynamically advance active and done steps', () => {
            assert.ok(webHtml.includes('function setPipelineStep'));
            assert.ok(webHtml.includes('stepEl.className = \'pipeline-step done\''));
            assert.ok(webHtml.includes('stepEl.className = \'pipeline-step active\''));
        });
    });

    describe('5. Android Native Integration', () => {
        const apiClientKt = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'kotlin', 'com', 'depthforge', 'app', 'ApiClient.kt'), 'utf-8');
        const mainActivityKt = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'kotlin', 'com', 'depthforge', 'app', 'MainActivity.kt'), 'utf-8');

        test('ApiClient.kt implements postprocessStream with SSE parsing and progress callback', () => {
            assert.ok(apiClientKt.includes('fun postprocessStream'));
            assert.ok(apiClientKt.includes('/api/postprocess-stream'));
            assert.ok(apiClientKt.includes('text/event-stream'));
            assert.ok(apiClientKt.includes('onProgress: (step: Int, message: String) -> Unit'));
            assert.ok(apiClientKt.includes('data:'));
            assert.ok(apiClientKt.includes('response.use'));
        });

        test('MainActivity.kt invokes ApiClient.postprocessStream and removes fake delay loop', () => {
            assert.ok(mainActivityKt.includes('ApiClient.postprocessStream(currentImageUrl)'));
            assert.ok(mainActivityKt.includes('activePolishStep = (step - 1).coerceIn(0, 4)'));
            assert.ok(!mainActivityKt.includes('delay(2500)'));
        });
    });

    describe('6. Python OpenCV Processor Step Output', () => {
        const procPy = fs.readFileSync(path.join(rootDir, 'processor.py'), 'utf-8');

        test('processor.py smooth_image emits [STEP 1/5] through [STEP 5/5] with flush=True', () => {
            assert.ok(procPy.includes('[STEP 1/5]'));
            assert.ok(procPy.includes('[STEP 2/5]'));
            assert.ok(procPy.includes('[STEP 3/5]'));
            assert.ok(procPy.includes('[STEP 4/5]'));
            assert.ok(procPy.includes('[STEP 5/5]'));
            assert.ok(procPy.includes('flush=True'));
        });

        test('processor.py maintains all CLI commands (smooth, remove_bg, invert, mesh)', () => {
            assert.ok(procPy.includes('command == "smooth"'));
            assert.ok(procPy.includes('command == "remove_bg"'));
            assert.ok(procPy.includes('command == "invert"'));
            assert.ok(procPy.includes('command == "mesh"'));
        });
    });
});
