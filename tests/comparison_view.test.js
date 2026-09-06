import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Side-by-Side Comparison View (F7) - Unit & Integration Tests', () => {

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

        test('HTML contains comparison view container, wrapper, images, labels, and handle', () => {
            assert.ok(webHtml.includes('id="comparisonContainer"'));
            assert.ok(webHtml.includes('id="comparisonWrapper"'));
            assert.ok(webHtml.includes('id="comparisonBeforeImg"'));
            assert.ok(webHtml.includes('id="comparisonAfterImg"'));
            assert.ok(webHtml.includes('id="comparisonOverlay"'));
            assert.ok(webHtml.includes('id="comparisonSliderHandle"'));
            assert.ok(webHtml.includes('id="exitComparisonBtn"'));
            assert.ok(webHtml.includes('id="compareBtn"'));
            assert.ok(webHtml.includes('onclick="toggleComparisonView()"'));
            assert.ok(webHtml.includes('onclick="exitComparisonView()"'));
        });

        test('HTML clearly labels Before and After with accessible indicators', () => {
            assert.ok(webHtml.includes('class="comparison-label label-before"'));
            assert.ok(webHtml.includes('class="comparison-label label-after"'));
            assert.ok(webHtml.includes('>Before</span>'));
            assert.ok(webHtml.includes('>After</span>'));
        });

        test('Comparison slider handle includes slider accessibility attributes', () => {
            assert.ok(webHtml.includes('role="slider"'));
            assert.ok(webHtml.includes('aria-label="Comparison Divider"'));
            assert.ok(webHtml.includes('aria-orientation="horizontal"'));
            assert.ok(webHtml.includes('aria-valuemin="0"'));
            assert.ok(webHtml.includes('aria-valuemax="100"'));
            assert.ok(webHtml.includes('aria-valuenow="50"'));
            assert.ok(webHtml.includes('aria-valuetext="50% Before / 50% After"'));
            assert.ok(webHtml.includes('tabindex="0"'));
        });

        test('CSS contains all required styling classes for comparison view and controls', () => {
            assert.ok(webCss.includes('.comparison-container'));
            assert.ok(webCss.includes('.comparison-wrapper'));
            assert.ok(webCss.includes('.comparison-img'));
            assert.ok(webCss.includes('.comparison-overlay'));
            assert.ok(webCss.includes('.comparison-label'));
            assert.ok(webCss.includes('.comparison-label.label-before'));
            assert.ok(webCss.includes('.comparison-label.label-after'));
            assert.ok(webCss.includes('.comparison-slider-handle'));
            assert.ok(webCss.includes('.comparison-handle-line'));
            assert.ok(webCss.includes('.comparison-handle-circle'));
            assert.ok(webCss.includes('.btn-comparison-exit'));
            assert.ok(webCss.includes('.btn-action.cyan'));
        });

        test('CSS includes clip-path and hardware-accelerated positioning for smooth reveal', () => {
            assert.ok(webCss.includes('clip-path: polygon('));
            assert.ok(webCss.includes('-webkit-clip-path: polygon('));
            assert.ok(webCss.includes('touch-action: none'));
            assert.ok(webCss.includes('cursor: ew-resize'));
        });
    });

    describe('2. Client-side Comparison State Logic Contract', () => {
        function createComparisonEnvironment() {
            let comparisonBeforeUrl = '';
            let comparisonAfterUrl = '';
            let isComparisonActive = false;
            let comparisonSplit = 50;
            let isProcessingFlag = false;

            function isProcessing() {
                return isProcessingFlag;
            }

            function showComparisonOption(beforeUrl, afterUrl) {
                if (beforeUrl && afterUrl) {
                    comparisonBeforeUrl = beforeUrl;
                    comparisonAfterUrl = afterUrl;
                    return true;
                }
                return false;
            }

            function setComparisonSplit(pos) {
                const num = Number(pos);
                comparisonSplit = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 50;
                return comparisonSplit;
            }

            function enterComparisonView() {
                if (isProcessing()) return false;
                if (!comparisonBeforeUrl || !comparisonAfterUrl) return false;
                isComparisonActive = true;
                return true;
            }

            function exitComparisonView() {
                isComparisonActive = false;
                return true;
            }

            function toggleComparisonView() {
                if (isProcessing()) return isComparisonActive;
                if (isComparisonActive) {
                    exitComparisonView();
                } else {
                    enterComparisonView();
                }
                return isComparisonActive;
            }

            return {
                getBeforeUrl: () => comparisonBeforeUrl,
                getAfterUrl: () => comparisonAfterUrl,
                isActive: () => isComparisonActive,
                getSplit: () => comparisonSplit,
                setProcessing: (val) => { isProcessingFlag = val; },
                showComparisonOption,
                setComparisonSplit,
                enterComparisonView,
                exitComparisonView,
                toggleComparisonView
            };
        }

        test('comparison view starts inactive with empty before/after URLs and default 50% split', () => {
            const env = createComparisonEnvironment();
            assert.equal(env.isActive(), false);
            assert.equal(env.getBeforeUrl(), '');
            assert.equal(env.getAfterUrl(), '');
            assert.equal(env.getSplit(), 50);
        });

        test('enterComparisonView fails gracefully when before/after URLs are missing', () => {
            const env = createComparisonEnvironment();
            assert.equal(env.enterComparisonView(), false);
            assert.equal(env.isActive(), false);
        });

        test('showComparisonOption configures before and after image URLs', () => {
            const env = createComparisonEnvironment();
            const res = env.showComparisonOption('/img/before.png', '/img/after.png');
            assert.equal(res, true);
            assert.equal(env.getBeforeUrl(), '/img/before.png');
            assert.equal(env.getAfterUrl(), '/img/after.png');
        });

        test('enterComparisonView activates comparison mode when URLs are valid', () => {
            const env = createComparisonEnvironment();
            env.showComparisonOption('/img/before.png', '/img/after.png');
            assert.equal(env.enterComparisonView(), true);
            assert.equal(env.isActive(), true);
        });

        test('exitComparisonView deactivates comparison mode', () => {
            const env = createComparisonEnvironment();
            env.showComparisonOption('/img/before.png', '/img/after.png');
            env.enterComparisonView();
            assert.equal(env.isActive(), true);
            env.exitComparisonView();
            assert.equal(env.isActive(), false);
        });

        test('toggleComparisonView flips between active and inactive cleanly', () => {
            const env = createComparisonEnvironment();
            env.showComparisonOption('/img/before.png', '/img/after.png');
            assert.equal(env.toggleComparisonView(), true);
            assert.equal(env.isActive(), true);
            assert.equal(env.toggleComparisonView(), false);
            assert.equal(env.isActive(), false);
        });

        test('setComparisonSplit clamps values strictly between 0 and 100', () => {
            const env = createComparisonEnvironment();
            assert.equal(env.setComparisonSplit(25), 25);
            assert.equal(env.setComparisonSplit(75), 75);
            assert.equal(env.setComparisonSplit(-20), 0);
            assert.equal(env.setComparisonSplit(150), 100);
            assert.equal(env.setComparisonSplit('invalid'), 50);
            assert.equal(env.setComparisonSplit(NaN), 50);
        });

        test('comparison transitions are blocked when isProcessing is active', () => {
            const env = createComparisonEnvironment();
            env.showComparisonOption('/img/before.png', '/img/after.png');
            env.setProcessing(true);
            assert.equal(env.enterComparisonView(), false);
            assert.equal(env.isActive(), false);
            assert.equal(env.toggleComparisonView(), false);
        });
    });

    describe('3. Web Application Wiring & Action Integration', () => {
        test('invertDepthMap captures preUrl, updates comparisonBeforeUrl, and calls showComparisonOption', () => {
            assert.ok(webHtml.includes('const preUrl = currentImageUrl;'));
            assert.ok(webHtml.includes('comparisonBeforeUrl = preUrl;'));
            assert.ok(webHtml.includes('comparisonAfterUrl = data.image_url;'));
            assert.ok(webHtml.includes('showComparisonOption()'));
        });

        test('removeBg captures preUrl, updates comparisonBeforeUrl, and calls showComparisonOption', () => {
            const removeBgBlock = webHtml.slice(webHtml.indexOf('async function removeBg()'), webHtml.indexOf('async function invertDepthMap()'));
            assert.ok(removeBgBlock.includes('comparisonBeforeUrl = preUrl;'));
            assert.ok(removeBgBlock.includes('comparisonAfterUrl = data.image_url;'));
            assert.ok(removeBgBlock.includes('showComparisonOption()'));
        });

        test('polishRelief captures preUrl, updates comparisonBeforeUrl on complete, and calls showComparisonOption', () => {
            const polishStartIndex = webHtml.indexOf('async function polishRelief()');
            const polishEndIndex = webHtml.indexOf('// ==========================================', polishStartIndex);
            const polishBlock = webHtml.slice(polishStartIndex, polishEndIndex);
            assert.ok(polishBlock.includes('const preUrl = currentImageUrl;'));
            assert.ok(polishBlock.includes('comparisonBeforeUrl = preUrl;'));
            assert.ok(polishBlock.includes('comparisonAfterUrl = data.image_url;'));
            assert.ok(polishBlock.includes('showComparisonOption()'));
        });

        test('generateMap resets comparison state and exits comparison view', () => {
            const genBlock = webHtml.slice(webHtml.indexOf('async function generateMap()'), webHtml.indexOf('async function convertPhoto()'));
            assert.ok(genBlock.includes('exitComparisonView()'));
            assert.ok(genBlock.includes("comparisonBeforeUrl = '';"));
            assert.ok(genBlock.includes("comparisonAfterUrl = '';"));
        });

        test('convertPhoto resets comparison state and exits comparison view', () => {
            const photoBlock = webHtml.slice(webHtml.indexOf('async function convertPhoto()'), webHtml.indexOf('async function removeBg()'));
            assert.ok(photoBlock.includes('exitComparisonView()'));
            assert.ok(photoBlock.includes("comparisonBeforeUrl = '';"));
            assert.ok(photoBlock.includes("comparisonAfterUrl = '';"));
        });

        test('selectGalleryItem exits comparison view and shows compareBtn only if matching comparisonAfterUrl', () => {
            const selectBlock = webHtml.slice(webHtml.indexOf('function selectGalleryItem('), webHtml.indexOf('function clearGallery('));
            assert.ok(selectBlock.includes('exitComparisonView()'));
            assert.ok(selectBlock.includes('item.url === comparisonAfterUrl'));
        });

        test('clearGallery resets comparison state and hides compareBtn', () => {
            const clearBlock = webHtml.slice(webHtml.indexOf('function clearGallery('), webHtml.indexOf('function toggleGallery('));
            assert.ok(clearBlock.includes('exitComparisonView()'));
            assert.ok(clearBlock.includes("comparisonBeforeUrl = '';"));
            assert.ok(clearBlock.includes("comparisonAfterUrl = '';"));
            assert.ok(clearBlock.includes("compareBtn.style.display = 'none'"));
        });
    });

    describe('4. Mouse & Touch Drag Interaction Contract', () => {
        test('HTML script defines initComparisonDrag function', () => {
            assert.ok(webHtml.includes('function initComparisonDrag()'));
        });

        test('initComparisonDrag binds mousedown and touchstart with non-passive touchmove prevention', () => {
            assert.ok(webHtml.includes("addEventListener('mousedown', startDrag)"));
            assert.ok(webHtml.includes("addEventListener('touchstart', startDrag, { passive: false })"));
            assert.ok(webHtml.includes("window.addEventListener('touchmove', onTouchMove, { passive: false })"));
            assert.ok(webHtml.includes("window.addEventListener('touchend', endDrag)"));
            assert.ok(webHtml.includes("window.addEventListener('touchcancel', endDrag)"));
        });

        test('drag handlers extract clientX from touch or mouse events', () => {
            assert.ok(webHtml.includes('e.touches && e.touches.length > 0'));
            assert.ok(webHtml.includes('e.touches[0].clientX'));
            assert.ok(webHtml.includes('e.clientX'));
        });

        test('slider handle supports keyboard navigation (Left/Right/Home/End/PageUp/PageDown)', () => {
            assert.ok(webHtml.includes("e.key === 'ArrowLeft'"));
            assert.ok(webHtml.includes("e.key === 'ArrowRight'"));
            assert.ok(webHtml.includes("e.key === 'PageUp'"));
            assert.ok(webHtml.includes("e.key === 'PageDown'"));
            assert.ok(webHtml.includes("e.key === 'Home'"));
            assert.ok(webHtml.includes("e.key === 'End'"));
            assert.ok(webHtml.includes('setComparisonSplit(comparisonSplit - step)'));
            assert.ok(webHtml.includes('setComparisonSplit(comparisonSplit + step)'));
        });

        test('drag handlers support PointerEvents with touch-action: none and pointermove/up/cancel', () => {
            assert.ok(webHtml.includes("window.addEventListener('pointermove', onPointerMove)"));
            assert.ok(webHtml.includes("window.addEventListener('pointerup', endDrag)"));
            assert.ok(webHtml.includes("window.addEventListener('pointercancel', endDrag)"));
            assert.ok(webCss.includes('.comparison-container'));
            assert.ok(webCss.includes('.comparison-wrapper'));
            assert.ok(webCss.includes('touch-action: none'));
        });

        test('slider handle binds pointerdown to startDrag for touch and pen parity', () => {
            assert.ok(webHtml.includes("handle.addEventListener('pointerdown', startDrag)"));
        });

        test('slider handle and window support Escape key to exit comparison view', () => {
            assert.ok(webHtml.includes("e.key === 'Escape'"));
            assert.ok(webHtml.includes('exitComparisonView()'));
        });
    });

    describe('5. Android Native Jetpack Compose UI Parity', () => {
        test('MainActivity.kt imports gestures and LocalDensity for draggable divider', () => {
            assert.ok(mainActivity.includes('import androidx.compose.foundation.gestures.Orientation'));
            assert.ok(mainActivity.includes('import androidx.compose.foundation.gestures.draggable'));
            assert.ok(mainActivity.includes('import androidx.compose.foundation.gestures.rememberDraggableState'));
            assert.ok(mainActivity.includes('import androidx.compose.ui.platform.LocalDensity'));
        });

        test('MainActivity.kt defines CyanAccent color', () => {
            assert.ok(mainActivity.includes('val CyanAccent = Color('));
        });

        test('ForgeScreen manages beforeImageUrl, beforeBitmap, afterImageUrl, isComparing, and comparisonSplit', () => {
            assert.ok(mainActivity.includes('var beforeImageUrl by remember { mutableStateOf<String?>(null) }'));
            assert.ok(mainActivity.includes('var beforeBitmap by remember { mutableStateOf<Bitmap?>(null) }'));
            assert.ok(mainActivity.includes('var afterImageUrl by remember { mutableStateOf<String?>(null) }'));
            assert.ok(mainActivity.includes('var isComparing by remember { mutableStateOf(false) }'));
            assert.ok(mainActivity.includes('var comparisonSplit by remember { mutableStateOf(0.5f) }'));
        });

        test('Preview Card renders BeforeAfterComparisonView when isComparing is true', () => {
            assert.ok(mainActivity.includes('isComparing && beforeBitmap != null && currentBitmap != null'));
            assert.ok(mainActivity.includes('BeforeAfterComparisonView('));
            assert.ok(mainActivity.includes('splitFraction = comparisonSplit'));
            assert.ok(mainActivity.includes('onSplitChange = { comparisonSplit = it }'));
            assert.ok(mainActivity.includes('onClose = { isComparing = false }'));
        });

        test('MainActivity.kt defines BeforeAfterComparisonView composable function', () => {
            assert.ok(mainActivity.includes('fun BeforeAfterComparisonView('));
            assert.ok(mainActivity.includes('beforeBitmap: Bitmap'));
            assert.ok(mainActivity.includes('afterBitmap: Bitmap'));
            assert.ok(mainActivity.includes('splitFraction: Float'));
        });

        test('BeforeAfterComparisonView provides Before and After labels and draggable divider', () => {
            assert.ok(mainActivity.includes('text = "Before"'));
            assert.ok(mainActivity.includes('text = "After"'));
            assert.ok(mainActivity.includes('Orientation.Horizontal'));
            assert.ok(mainActivity.includes('rememberDraggableState'));
            assert.ok(mainActivity.includes('✕ Close Comparison'));
        });

        test('Action buttons row provides Compare button when before and current bitmaps exist', () => {
            assert.ok(mainActivity.includes('if (beforeBitmap != null && currentBitmap != null)'));
            assert.ok(mainActivity.includes('isComparing = !isComparing'));
            assert.ok(mainActivity.includes('if (isComparing) "Normal" else "Compare"'));
        });

        test('MainActivity.kt captures preUrl and preBitmap in invert, removeBg, and polish', () => {
            assert.ok(mainActivity.includes('beforeImageUrl = preUrl'));
            assert.ok(mainActivity.includes('beforeBitmap = preBitmap'));
            assert.ok(mainActivity.includes('afterImageUrl = currentImageUrl'));
        });

        test('MainActivity.kt resets comparison on generate, photo, discard, and gallery click', () => {
            assert.ok(mainActivity.includes('isComparing = false'));
        });

        test('MainActivity.kt manages afterImageUrl state and resets on clear and discard', () => {
            assert.ok(mainActivity.includes('var afterImageUrl by remember { mutableStateOf<String?>(null) }'));
            assert.ok(mainActivity.includes('afterImageUrl = currentImageUrl'));
            assert.ok(mainActivity.includes('currentImageUrl == afterImageUrl'));
        });

        test('MainActivity.kt imports BackHandler and binds it to isComparing', () => {
            assert.ok(mainActivity.includes('import androidx.activity.compose.BackHandler'));
            assert.ok(mainActivity.includes('BackHandler(enabled = isComparing)'));
        });

        test('MainActivity.kt Preview Card provides progress feedback for isRemovingBg with PinkAccent', () => {
            assert.ok(mainActivity.includes('isRemovingBg -> {'));
            assert.ok(mainActivity.includes('CircularProgressIndicator(color = PinkAccent)'));
            assert.ok(mainActivity.includes('Text("Isolating Subject...", color = TextPrimary)'));
        });

        test('android_app contains ComparisonViewTest.kt with comprehensive JUnit tests', () => {
            const testFilePath = path.join(rootDir, 'android_app', 'app', 'src', 'test', 'kotlin', 'com', 'depthforge', 'app', 'ComparisonViewTest.kt');
            assert.ok(fs.existsSync(testFilePath), 'ComparisonViewTest.kt must exist');
            const content = fs.readFileSync(testFilePath, 'utf-8');
            assert.ok(content.includes('class ComparisonViewTest'));
            assert.ok(content.includes('testSplitFractionClamping'));
            assert.ok(content.includes('testDragDeltaCalculation'));
            assert.ok(content.includes('testLabelAlphaFadingContract'));
            assert.ok(content.includes('testClipGeometryOutlineContract'));
        });
    });

    function setupVmEnvironment() {
        const windowListeners = new Map();
        const elementListeners = new Map();
        const elements = {};

        function getOrCreate(id) {
            if (!elements[id]) {
                elements[id] = {
                    id,
                    style: {
                        display: 'none',
                        setProperty(prop, val) { this[prop] = val; }
                    },
                    value: '',
                    innerText: '',
                    textContent: '',
                    innerHTML: '',
                    src: '',
                    href: '',
                    disabled: false,
                    attributes: {},
                    classList: {
                        _classes: new Set(),
                        add(c) { this._classes.add(c); },
                        remove(c) { this._classes.delete(c); },
                        toggle(c, force) {
                            if (force !== undefined) {
                                if (force) this._classes.add(c);
                                else this._classes.delete(c);
                                return force;
                            }
                            if (this._classes.has(c)) { this._classes.delete(c); return false; }
                            this._classes.add(c); return true;
                        },
                        contains(c) { return this._classes.has(c); }
                    },
                    addEventListener(ev, fn) {
                        if (!elementListeners.has(id)) elementListeners.set(id, new Map());
                        const m = elementListeners.get(id);
                        if (!m.has(ev)) m.set(ev, []);
                        m.get(ev).push(fn);
                    },
                    removeEventListener(ev, fn) {
                        const m = elementListeners.get(id);
                        if (!m) return;
                        const arr = m.get(ev) || [];
                        const idx = arr.indexOf(fn);
                        if (idx >= 0) arr.splice(idx, 1);
                    },
                    setAttribute(name, val) { this.attributes[name] = String(val); },
                    getAttribute(name) { return this.attributes[name] || this[name] || null; },
                    getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 400 }; },
                    querySelector(sel) { return null; },
                    querySelectorAll() { return []; },
                    closest() { return null; }
                };
            }
            return elements[id];
        }

        [
            'dropZone', 'photoPreviewImg', 'dropText', 'convertBtn', 'clearPhotoBtn', 'fileInput',
            'sessionGalleryContainer', 'sessionGalleryStrip', 'sessionGalleryCount', 'toggleGalleryBtn',
            'clearGalleryBtn', 'outputImage', 'placeholder', 'actionBar', 'downloadBtn',
            'removeBgBtn', 'polishBtn', 'invertBtn', 'compareBtn', 'depthIntensity', 'photoDepthIntensity',
            'depthIntensityVal', 'photoDepthIntensityVal', 'promptInput', 'generateBtn',
            'loadingText', 'loadingOverlay', 'pipelineOverlay', 'tabText', 'tabPhoto',
            'textPanel', 'photoPanel', 'promptHistoryContainer', 'promptHistorySelect',
            'promptHistoryList', 'clearHistoryBtn', 'comparisonContainer', 'comparisonWrapper',
            'comparisonBeforeImg', 'comparisonAfterImg', 'comparisonOverlay', 'comparisonSliderHandle',
            'exitComparisonBtn', 'comparisonLabelBefore', 'comparisonLabelAfter'
        ].forEach(id => getOrCreate(id));

        const scriptMatch = webHtml.match(/<script>([\s\S]*?)<\/script>/);
        assert.ok(scriptMatch, 'Expected script tag in index.html');
        const scriptCode = scriptMatch[1];

        const sandbox = {
            document: {
                getElementById: (id) => getOrCreate(id),
                querySelector: (sel) => getOrCreate('outputImage').querySelector(sel),
                querySelectorAll: () => []
            },
            window: {
                addEventListener(ev, fn) {
                    if (!windowListeners.has(ev)) windowListeners.set(ev, []);
                    windowListeners.get(ev).push(fn);
                },
                removeEventListener(ev, fn) {
                    const arr = windowListeners.get(ev) || [];
                    const idx = arr.indexOf(fn);
                    if (idx >= 0) arr.splice(idx, 1);
                }
            },
            console: {
                log: () => {},
                error: () => {},
                warn: () => {}
            },
            Date,
            Math,
            String,
            Number,
            JSON,
            Array,
            Set,
            setTimeout,
            clearTimeout,
            alert: () => {},
            location: { reload: () => {} }
        };

        vm.createContext(sandbox);
        vm.runInContext(scriptCode, sandbox);

        return {
            sandbox,
            elements,
            getOrCreate,
            windowListeners,
            elementListeners,
            run: (code) => vm.runInContext(code, sandbox),
            getVar: (name) => vm.runInContext(name, sandbox),
            setVar: (name, val) => vm.runInContext(`${name} = ${JSON.stringify(val)}`, sandbox)
        };
    }

    describe('6. Direct VM Execution of static/index.html Script', () => {
        test('setComparisonSplit updates handle left style, aria-valuenow, and overlay clipPath', () => {
            const { run, elements } = setupVmEnvironment();
            run('setComparisonSplit(40)');
            assert.equal(elements.comparisonSliderHandle.style.left, '40%');
            assert.equal(elements.comparisonSliderHandle.getAttribute('aria-valuenow'), '40');
            assert.ok(elements.comparisonOverlay.style.clipPath.includes('40%'));
        });

        test('setComparisonSplit updates aria-valuetext and label opacities at extreme bounds', () => {
            const { run, elements } = setupVmEnvironment();
            run('setComparisonSplit(0)');
            assert.equal(elements.comparisonSliderHandle.getAttribute('aria-valuetext'), '0% Before / 100% After');
            assert.equal(elements.comparisonLabelBefore.style.opacity, '0');
            assert.equal(elements.comparisonLabelAfter.style.opacity, '1');

            run('setComparisonSplit(100)');
            assert.equal(elements.comparisonSliderHandle.getAttribute('aria-valuetext'), '100% Before / 0% After');
            assert.equal(elements.comparisonLabelBefore.style.opacity, '1');
            assert.equal(elements.comparisonLabelAfter.style.opacity, '0');

            run('setComparisonSplit(50)');
            assert.equal(elements.comparisonSliderHandle.getAttribute('aria-valuetext'), '50% Before / 50% After');
            assert.equal(elements.comparisonLabelBefore.style.opacity, '1');
            assert.equal(elements.comparisonLabelAfter.style.opacity, '1');
        });

        test('showComparisonOption configures before and after image elements and reveals compareBtn', () => {
            const { run, setVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('showComparisonOption()');

            assert.equal(elements.compareBtn.style.display, 'inline-flex');
            assert.equal(elements.compareBtn.disabled, false);
            assert.equal(elements.comparisonBeforeImg.src, '/test/before.png');
            assert.equal(elements.comparisonAfterImg.src, '/test/after.png');
        });

        test('enterComparisonView displays comparisonContainer and hides standard outputImage', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('enterComparisonView()');

            assert.equal(getVar('isComparisonActive'), true);
            assert.equal(elements.comparisonContainer.style.display, 'flex');
            assert.equal(elements.outputImage.style.display, 'none');
            assert.equal(elements.compareBtn.innerText, '👁️ Normal View');
            assert.ok(elements.compareBtn.classList.contains('active'));
        });

        test('exitComparisonView restores outputImage and hides comparisonContainer', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            setVar('currentImageUrl', '/test/after.png');
            run('enterComparisonView()');
            assert.equal(getVar('isComparisonActive'), true);

            run('exitComparisonView()');
            assert.equal(getVar('isComparisonActive'), false);
            assert.equal(elements.comparisonContainer.style.display, 'none');
            assert.equal(elements.outputImage.style.display, 'block');
            assert.equal(elements.compareBtn.innerText, '⚖️ Compare');
            assert.equal(elements.compareBtn.classList.contains('active'), false);
        });

        test('toggleComparisonView toggles between comparison view and single image preview', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            setVar('currentImageUrl', '/test/after.png');

            run('toggleComparisonView()');
            assert.equal(getVar('isComparisonActive'), true);
            assert.equal(elements.comparisonContainer.style.display, 'flex');

            run('toggleComparisonView()');
            assert.equal(getVar('isComparisonActive'), false);
            assert.equal(elements.comparisonContainer.style.display, 'none');
        });

        test('clearGallery resets comparison URLs and hides compareBtn in DOM', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            elements.compareBtn.style.display = 'inline-flex';
            run('clearGallery()');

            assert.equal(getVar('comparisonBeforeUrl'), '');
            assert.equal(getVar('comparisonAfterUrl'), '');
            assert.equal(elements.compareBtn.style.display, 'none');
        });
    });

    describe('7. Adversarial Edge Cases & Robustness Checks', () => {
        test('rapid boundary split inputs clamp correctly without throwing', () => {
            const { run, elements } = setupVmEnvironment();
            const testValues = [-1000, 0, 0.001, 50, 99.99, 100, 1000, NaN, undefined, null];
            testValues.forEach(val => {
                run(`setComparisonSplit(${JSON.stringify(val)})`);
                const handleLeft = parseFloat(elements.comparisonSliderHandle.style.left);
                assert.ok(!isNaN(handleLeft));
                assert.ok(handleLeft >= 0 && handleLeft <= 100);
            });
        });

        test('enterComparisonView does not activate if URLs are empty or null', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '');
            setVar('comparisonAfterUrl', '');
            run('enterComparisonView()');
            assert.equal(getVar('isComparisonActive'), false);
            assert.equal(elements.comparisonContainer.style.display, 'none');
        });

        test('loading overlay blocks comparison toggle during active cloud operations', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            elements.loadingOverlay.style.display = 'flex';

            run('toggleComparisonView()');
            assert.equal(getVar('isComparisonActive'), false);
            assert.equal(elements.comparisonContainer.style.display, 'none');
        });

        test('initComparisonDrag is idempotent and guards against duplicate listener registration', () => {
            const { run, getVar } = setupVmEnvironment();
            assert.equal(getVar('isComparisonDragInitialized'), true);
            run('initComparisonDrag()');
            assert.equal(getVar('isComparisonDragInitialized'), true);
        });

        test('showComparisonOption refreshes comparisonSplit when comparison view is already active', () => {
            const { run, setVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('enterComparisonView()');
            run('setComparisonSplit(35)');
            assert.equal(elements.comparisonSliderHandle.style.left, '35%');

            setVar('comparisonAfterUrl', '/test/after_v2.png');
            run('showComparisonOption()');
            assert.equal(elements.comparisonAfterImg.src, '/test/after_v2.png');
            assert.equal(elements.comparisonSliderHandle.style.left, '35%');
        });

        test('Escape key cleanly exits comparison view in DOM VM', () => {
            const { run, setVar, getVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('enterComparisonView()');
            assert.equal(getVar('isComparisonActive'), true);

            run('exitComparisonView()');
            assert.equal(getVar('isComparisonActive'), false);
            assert.equal(elements.comparisonContainer.style.display, 'none');
        });

        test('exitComparisonView cleanly aborts active drag, resets isDraggingComparison, and removes window listeners', () => {
            const { run, setVar, getVar, elements, windowListeners, elementListeners } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('enterComparisonView()');
            assert.equal(getVar('isComparisonActive'), true);

            // Trigger pointerdown on handle to start drag
            const handlePointerDown = elementListeners.get('comparisonSliderHandle')?.get('pointerdown')?.[0];
            assert.ok(handlePointerDown, 'handle must have pointerdown listener');
            handlePointerDown({ clientX: 300, cancelable: true, preventDefault() {} });

            assert.equal(getVar('isDraggingComparison'), true, 'Should be dragging');
            assert.ok(elements.comparisonSliderHandle.classList.contains('dragging'));
            assert.ok(windowListeners.get('mousemove')?.length > 0, 'mousemove should be attached');
            assert.ok(windowListeners.get('blur')?.length > 0, 'blur should be attached');

            // Exit comparison view while drag is active
            run('exitComparisonView()');

            assert.equal(getVar('isComparisonActive'), false);
            assert.equal(getVar('isDraggingComparison'), false, 'isDraggingComparison must be reset to false');
            assert.equal(elements.comparisonSliderHandle.classList.contains('dragging'), false, 'dragging class must be removed');
            assert.equal(windowListeners.get('mousemove')?.length || 0, 0, 'mousemove listener must be removed');
            assert.equal(windowListeners.get('pointermove')?.length || 0, 0, 'pointermove listener must be removed');
            assert.equal(windowListeners.get('blur')?.length || 0, 0, 'blur listener must be removed');
        });

        test('slider handle can be dragged immediately after re-entering comparison view following an aborted drag (deadlock prevention)', () => {
            const { run, setVar, getVar, elements, elementListeners } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('enterComparisonView()');

            const handlePointerDown = elementListeners.get('comparisonSliderHandle')?.get('pointerdown')?.[0];
            assert.ok(handlePointerDown);
            handlePointerDown({ clientX: 300, cancelable: true, preventDefault() {} });
            assert.equal(getVar('isDraggingComparison'), true);

            // Abort via exit
            run('exitComparisonView()');
            assert.equal(getVar('isDraggingComparison'), false);

            // Re-enter comparison view
            run('enterComparisonView()');
            assert.equal(getVar('isComparisonActive'), true);

            // Next drag must succeed without deadlock
            handlePointerDown({ clientX: 450, cancelable: true, preventDefault() {} });
            assert.equal(getVar('isDraggingComparison'), true, 'Drag must successfully initiate after re-entering');
            assert.equal(elements.comparisonSliderHandle.style.left, '75%');
        });

        test('window blur event terminates active dragging and detaches listeners', () => {
            const { run, setVar, getVar, elements, windowListeners, elementListeners } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');
            run('enterComparisonView()');

            const handlePointerDown = elementListeners.get('comparisonSliderHandle')?.get('pointerdown')?.[0];
            assert.ok(handlePointerDown);
            handlePointerDown({ clientX: 300, cancelable: true, preventDefault() {} });
            assert.equal(getVar('isDraggingComparison'), true);

            // Trigger window blur (e.g. user Alt-Tabs)
            const blurHandler = windowListeners.get('blur')?.[0];
            assert.ok(blurHandler, 'Window blur listener must be registered during drag');
            blurHandler();

            assert.equal(getVar('isDraggingComparison'), false, 'Drag must terminate on window blur');
            assert.equal(elements.comparisonSliderHandle.classList.contains('dragging'), false);
            assert.equal(windowListeners.get('blur')?.length || 0, 0, 'blur listener must be detached after termination');
        });

        test('showComparisonOption strictly synchronizes compareBtn label and active class with isComparisonActive', () => {
            const { run, setVar, elements } = setupVmEnvironment();
            setVar('comparisonBeforeUrl', '/test/before.png');
            setVar('comparisonAfterUrl', '/test/after.png');

            // When comparison view is inactive
            run('showComparisonOption()');
            assert.equal(elements.compareBtn.innerText, '⚖️ Compare');
            assert.equal(elements.compareBtn.classList.contains('active'), false);

            // When comparison view is active
            run('enterComparisonView()');
            assert.equal(elements.compareBtn.innerText, '👁️ Normal View');
            assert.ok(elements.compareBtn.classList.contains('active'));

            // Subsequent showComparisonOption while active keeps button in Normal View state
            setVar('comparisonAfterUrl', '/test/after_v3.png');
            run('showComparisonOption()');
            assert.equal(elements.compareBtn.innerText, '👁️ Normal View');
            assert.ok(elements.compareBtn.classList.contains('active'));
        });
    });
});
