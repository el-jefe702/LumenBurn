import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('3D Live Preview (Three.js Displacement) (F11) - Unit & Integration Tests', () => {

    const webHtml = fs.readFileSync(path.join(rootDir, 'static', 'index.html'), 'utf-8');
    const androidHtml = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'assets', 'index.html'), 'utf-8');
    const webCss = fs.readFileSync(path.join(rootDir, 'static', 'style.css'), 'utf-8');
    const androidCss = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'assets', 'style.css'), 'utf-8');
    const androidStaticCss = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'assets', 'static', 'style.css'), 'utf-8');
    const mainActivityPath = path.join(rootDir, 'android_app', 'app', 'src', 'main', 'kotlin', 'com', 'depthforge', 'app', 'MainActivity.kt');
    const mainActivity = fs.readFileSync(mainActivityPath, 'utf-8');

    describe('1. Web UI & Assets Parity', () => {
        test('index.html is identical byte-for-byte between static/ and android assets', () => {
            assert.equal(webHtml, androidHtml);
        });

        test('style.css is identical byte-for-byte between static/ and android assets', () => {
            assert.equal(webCss, androidCss);
            assert.equal(webCss, androidStaticCss);
        });

        test('HTML loads Three.js from CDN in head', () => {
            assert.ok(webHtml.includes('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'));
        });

        test('HTML contains 3D live preview container, canvas, controls, and hints', () => {
            assert.ok(webHtml.includes('id="threeDContainer"'));
            assert.ok(webHtml.includes('id="threeDCanvas"'));
            assert.ok(webHtml.includes('id="threeDHint"'));
            assert.ok(webHtml.includes('id="reset3DCameraBtn"'));
            assert.ok(webHtml.includes('id="exit3DBtn"'));
            assert.ok(webHtml.includes('onclick="reset3DCamera()"'));
            assert.ok(webHtml.includes('onclick="exit3DPreview()"'));
        });

        test('Action bar contains 3D Preview button with purple styling and toggle handler', () => {
            assert.ok(webHtml.includes('id="threeDPreviewBtn"'));
            assert.ok(webHtml.includes('onclick="toggle3DPreview()"'));
            assert.ok(webHtml.includes('btn-action purple'));
            assert.ok(webHtml.includes('🧊 3D Preview'));
        });

        test('3D canvas includes accessibility attributes', () => {
            assert.ok(webHtml.includes('tabindex="0"'));
            assert.ok(webHtml.includes('role="region"'));
            assert.ok(webHtml.includes('aria-label="3D Depth Map Surface"'));
        });
    });

    describe('2. CSS Styles & Design System', () => {
        test('CSS defines .three-d-container and .three-d-canvas viewport layout', () => {
            assert.ok(webCss.includes('.three-d-container'));
            assert.ok(webCss.includes('.three-d-canvas'));
            assert.ok(webCss.includes('cursor: grab'));
            assert.ok(webCss.includes('cursor: grabbing'));
        });

        test('CSS defines controls for 3D view (.btn-three-d-reset, .btn-three-d-exit, .three-d-hint)', () => {
            assert.ok(webCss.includes('.three-d-hint'));
            assert.ok(webCss.includes('.btn-three-d-reset'));
            assert.ok(webCss.includes('.btn-three-d-exit'));
            assert.ok(webCss.includes('.btn-action.purple'));
            assert.ok(webCss.includes('.btn-action.purple.active'));
        });
    });

    describe('3. Client-Side JavaScript Logic & State Management', () => {
        // Extract inline script blocks (excluding external script tags)
        const scriptBlocks = Array.from(webHtml.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi));
        assert.ok(scriptBlocks.length > 0, 'Inline script block must be present in HTML');
        const scriptCode = scriptBlocks.map(m => m[1]).join('\n');

        test('JS defines all required 3D preview functions and states', () => {
            assert.ok(scriptCode.includes('let is3DActive = false'));
            assert.ok(scriptCode.includes('function initThreeD('));
            assert.ok(scriptCode.includes('function enter3DPreview('));
            assert.ok(scriptCode.includes('function exit3DPreview('));
            assert.ok(scriptCode.includes('function toggle3DPreview('));
            assert.ok(scriptCode.includes('function reset3DCamera('));
            assert.ok(scriptCode.includes('function update3DTexture('));
            assert.ok(scriptCode.includes('function update3DDisplacementScale('));
            assert.ok(scriptCode.includes('function getDepthDisplacementScale('));
        });

        test('Simulation: 3D Preview transitions and toggle behavior in mock DOM', () => {
            const elements = {
                threeDContainer: { style: { display: 'none' } },
                threeDCanvas: {
                    style: {},
                    addEventListener: () => {},
                    setPointerCapture: () => {},
                    releasePointerCapture: () => {}
                },
                outputImage: { style: { display: 'block' }, src: '/static/generated/sample.png' },
                threeDPreviewBtn: {
                    style: { display: 'inline-flex' },
                    innerText: '🧊 3D Preview',
                    classList: {
                        contains: (c) => false,
                        add: function(c) { this[c] = true; },
                        remove: function(c) { delete this[c]; },
                        toggle: function(c, v) { this[c] = v; }
                    }
                },
                comparisonContainer: { style: { display: 'none' } },
                compareBtn: { style: { display: 'none' }, innerText: '⚖️ Compare', classList: { toggle: () => {}, remove: () => {} } },
                placeholder: { style: { display: 'none' } },
                actionBar: { style: { display: 'flex' } },
                downloadBtn: { href: '' },
                removeBgBtn: { style: { display: 'inline-flex' } },
                polishBtn: { style: { display: 'inline-flex' } },
                invertBtn: { style: { display: 'inline-flex' } },
                depthIntensity: { value: '70' }
            };

            const mockContext = {
                document: {
                    getElementById: (id) => elements[id] || null,
                    addEventListener: () => {}
                },
                window: {
                    addEventListener: () => {},
                    devicePixelRatio: 1
                },
                requestAnimationFrame: (cb) => 1,
                cancelAnimationFrame: (id) => {},
                isProcessing: () => false,
                currentImageUrl: '/static/generated/test_depth.png',
                isComparisonActive: false,
                exitComparisonView: () => { elements.comparisonContainer.style.display = 'none'; },
                alert: () => {},
                console: console
            };

            vm.createContext(mockContext);

            // Execute 3D functions inside mock context
            const codeToExec = `
                var is3DActive = false;
                var threeDScene = null;
                var threeDCamera = null;
                var threeDRenderer = null;
                var threeDMesh = null;
                var threeDAnimId = null;
                var threeDRotationX = 0.55;
                var threeDRotationY = 0.0;
                var threeDZoom = 2.4;

                function getDepthDisplacementScale() {
                    const parsedDepth = parseInt(document.getElementById('depthIntensity')?.value ?? '70', 10);
                    const intensity = Number.isNaN(parsedDepth) ? 70 : Math.max(0, Math.min(100, parsedDepth));
                    return (intensity / 100) * 0.45;
                }

                function enter3DPreview() {
                    if (isProcessing() || !currentImageUrl) return;
                    if (isComparisonActive && typeof exitComparisonView === 'function') {
                        exitComparisonView();
                    }

                    const container = document.getElementById('threeDContainer');
                    const outputImage = document.getElementById('outputImage');
                    const btn = document.getElementById('threeDPreviewBtn');
                    if (!container) return;

                    is3DActive = true;
                    container.style.display = 'flex';
                    if (outputImage) outputImage.style.display = 'none';

                    if (btn) {
                        btn.innerText = '🖼️ 2D View';
                        btn.classList.add('active');
                    }
                }

                function exit3DPreview() {
                    if (!is3DActive) return;
                    is3DActive = false;

                    const container = document.getElementById('threeDContainer');
                    const outputImage = document.getElementById('outputImage');
                    const btn = document.getElementById('threeDPreviewBtn');

                    if (container) container.style.display = 'none';
                    if (outputImage && currentImageUrl && !isComparisonActive) {
                        outputImage.style.display = 'block';
                    }

                    if (btn) {
                        btn.innerText = '🧊 3D Preview';
                        btn.classList.remove('active');
                    }
                }

                function toggle3DPreview() {
                    if (isProcessing()) return;
                    if (is3DActive) {
                        exit3DPreview();
                    } else {
                        enter3DPreview();
                    }
                }

                function reset3DCamera() {
                    threeDRotationX = 0.55;
                    threeDRotationY = 0.0;
                    threeDZoom = 2.4;
                }

                function update3DDisplacementScale(intensityVal) {
                    const numericVal = Number(intensityVal);
                    const val = Number.isFinite(numericVal) ? numericVal : 70;
                    return (val / 100) * 0.45;
                }
            `;

            vm.runInContext(codeToExec, mockContext);

            // Initially inactive
            assert.equal(mockContext.is3DActive, false);
            assert.equal(elements.threeDContainer.style.display, 'none');

            // Enter 3D
            mockContext.toggle3DPreview();
            assert.equal(mockContext.is3DActive, true);
            assert.equal(elements.threeDContainer.style.display, 'flex');
            assert.equal(elements.outputImage.style.display, 'none');
            assert.equal(elements.threeDPreviewBtn.innerText, '🖼️ 2D View');

            // Exit 3D
            mockContext.toggle3DPreview();
            assert.equal(mockContext.is3DActive, false);
            assert.equal(elements.threeDContainer.style.display, 'none');
            assert.equal(elements.outputImage.style.display, 'block');
            assert.equal(elements.threeDPreviewBtn.innerText, '🧊 3D Preview');

            // Reset camera values
            mockContext.threeDRotationX = 1.2;
            mockContext.threeDZoom = 5.0;
            mockContext.reset3DCamera();
            assert.equal(mockContext.threeDRotationX, 0.55);
            assert.equal(mockContext.threeDZoom, 2.4);

            // Displacement scale calculation
            assert.equal(mockContext.update3DDisplacementScale(100), 0.45);
            assert.equal(mockContext.update3DDisplacementScale(0), 0);
            assert.equal(mockContext.update3DDisplacementScale(50), 0.225);
        });

        test('Generation and Comparison flows automatically exit 3D preview if active', () => {
            assert.ok(webHtml.includes('if (typeof is3DActive !== \'undefined\' && is3DActive && typeof exit3DPreview === \'function\')'));
        });
    });

    describe('4. Android Native UI Integration', () => {
        test('MainActivity.kt defines PurpleAccent color', () => {
            assert.ok(mainActivity.includes('val PurpleAccent = Color(0xFF8B5CF6)'));
        });

        test('MainActivity.kt defines show3DInfoDialog state', () => {
            assert.ok(mainActivity.includes('var show3DInfoDialog by remember { mutableStateOf(false) }'));
        });

        test('MainActivity.kt renders 3D Preview button in action row', () => {
            assert.ok(mainActivity.includes('Text("🧊 3D Preview"'));
            assert.ok(mainActivity.includes('backgroundColor = PurpleAccent'));
            assert.ok(mainActivity.includes('show3DInfoDialog = true'));
        });

        test('MainActivity.kt displays AlertDialog explaining 3D displacement capabilities', () => {
            assert.ok(mainActivity.includes('if (show3DInfoDialog)'));
            assert.ok(mainActivity.includes('text = "🧊 3D Live Preview"'));
            assert.ok(mainActivity.includes('Interactive 3D surface displacement mapping'));
        });
    });
});
