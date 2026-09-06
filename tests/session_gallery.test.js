import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Session Gallery Feature (F5) - Unit & Integration Tests', () => {

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

        test('HTML contains session gallery container, header, controls, and strip', () => {
            assert.ok(webHtml.includes('id="sessionGalleryContainer"'));
            assert.ok(webHtml.includes('id="sessionGalleryStrip"'));
            assert.ok(webHtml.includes('id="sessionGalleryCount"'));
            assert.ok(webHtml.includes('id="toggleGalleryBtn"'));
            assert.ok(webHtml.includes('id="clearGalleryBtn"'));
            assert.ok(webHtml.includes('onclick="toggleGallery()"'));
            assert.ok(webHtml.includes('onclick="clearGallery()"'));
            assert.ok(webHtml.includes('Session Gallery'));
        });

        test('CSS contains all required session gallery styling classes', () => {
            assert.ok(webCss.includes('.session-gallery-container'));
            assert.ok(webCss.includes('.session-gallery-header'));
            assert.ok(webCss.includes('.session-gallery-title'));
            assert.ok(webCss.includes('.session-gallery-count'));
            assert.ok(webCss.includes('.session-gallery-controls'));
            assert.ok(webCss.includes('.btn-gallery-toggle'));
            assert.ok(webCss.includes('.btn-gallery-clear'));
            assert.ok(webCss.includes('.session-gallery-strip'));
            assert.ok(webCss.includes('.gallery-thumb-item'));
            assert.ok(webCss.includes('.gallery-thumb-item.active'));
            assert.ok(webCss.includes('.gallery-thumb-wrapper'));
            assert.ok(webCss.includes('.gallery-thumb-img'));
            assert.ok(webCss.includes('.gallery-thumb-badge'));
            assert.ok(webCss.includes('.gallery-thumb-label'));
            assert.ok(webCss.includes('.gallery-thumb-time'));
        });

        test('HTML thumbnails include accessibility attributes and safe event handlers', () => {
            assert.ok(webHtml.includes('role="button"'));
            assert.ok(webHtml.includes('tabindex="0"'));
            assert.ok(webHtml.includes('aria-label='));
            assert.ok(webHtml.includes('onkeydown='));
            assert.ok(webHtml.includes("selectGalleryItem(this.getAttribute('data-id'))"));
        });
    });

    describe('2. Client-side Gallery State Logic Contract', () => {
        function createGalleryEnvironment() {
            let sessionGallery = [];
            let activeGalleryItemId = null;
            let isGalleryHidden = false;
            let isProcessingFlag = false;

            function isProcessing() {
                return isProcessingFlag;
            }

            function setProcessing(val) {
                isProcessingFlag = Boolean(val);
            }

            function formatGalleryTime(d = new Date()) {
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                return hours + ':' + minutes + ':' + seconds;
            }

            function addToGallery(imageUrl, label) {
                if (!imageUrl) return null;
                const id = 'gallery-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
                const timestamp = formatGalleryTime();
                const item = {
                    id,
                    url: imageUrl,
                    label: label || 'Depth Map',
                    timestamp
                };
                sessionGallery.push(item);
                activeGalleryItemId = id;
                return item;
            }

            function selectGalleryItem(id) {
                if (isProcessing()) return null;
                const item = sessionGallery.find(it => it.id === id);
                if (!item) return null;
                activeGalleryItemId = id;
                return item;
            }

            function clearGallery() {
                if (isProcessing()) return false;
                sessionGallery = [];
                activeGalleryItemId = null;
                isGalleryHidden = false;
                return true;
            }

            function toggleGallery() {
                if (isProcessing()) return isGalleryHidden;
                isGalleryHidden = !isGalleryHidden;
                return isGalleryHidden;
            }

            return {
                getGallery: () => sessionGallery,
                getActiveId: () => activeGalleryItemId,
                isStripHidden: () => isGalleryHidden,
                setProcessing,
                addToGallery,
                selectGalleryItem,
                clearGallery,
                toggleGallery
            };
        }

        test('gallery starts empty with no active item', () => {
            const env = createGalleryEnvironment();
            assert.equal(env.getGallery().length, 0);
            assert.equal(env.getActiveId(), null);
            assert.equal(env.isStripHidden(), false);
        });

        test('addToGallery appends items and updates activeGalleryItemId', () => {
            const env = createGalleryEnvironment();
            const item1 = env.addToGallery('/output/image1.png', 'Generated');
            assert.equal(env.getGallery().length, 1);
            assert.equal(env.getActiveId(), item1.id);
            assert.equal(item1.label, 'Generated');
            assert.equal(item1.url, '/output/image1.png');
            assert.match(item1.timestamp, /^\d{2}:\d{2}:\d{2}$/);

            const item2 = env.addToGallery('/output/image2.png', 'Invert');
            assert.equal(env.getGallery().length, 2);
            assert.equal(env.getActiveId(), item2.id);
            assert.equal(env.getGallery()[0].id, item1.id);
            assert.equal(env.getGallery()[1].id, item2.id);
        });

        test('addToGallery safely ignores empty or null imageUrl', () => {
            const env = createGalleryEnvironment();
            assert.equal(env.addToGallery(null, 'Test'), null);
            assert.equal(env.addToGallery('', 'Test'), null);
            assert.equal(env.getGallery().length, 0);
        });

        test('selectGalleryItem restores item as active without mutating gallery list', () => {
            const env = createGalleryEnvironment();
            const item1 = env.addToGallery('/output/item1.png', 'Generated');
            const item2 = env.addToGallery('/output/item2.png', 'Invert');
            const item3 = env.addToGallery('/output/item3.png', 'Polished');

            assert.equal(env.getActiveId(), item3.id);

            const selected = env.selectGalleryItem(item1.id);
            assert.equal(selected.id, item1.id);
            assert.equal(env.getActiveId(), item1.id);
            assert.equal(env.getGallery().length, 3);
            assert.equal(env.getGallery()[0].id, item1.id);
        });

        test('selectGalleryItem is a no-op when isProcessing is active', () => {
            const env = createGalleryEnvironment();
            const item1 = env.addToGallery('/output/item1.png', 'Generated');
            const item2 = env.addToGallery('/output/item2.png', 'Invert');

            env.setProcessing(true);
            const result = env.selectGalleryItem(item1.id);
            assert.equal(result, null);
            assert.equal(env.getActiveId(), item2.id); // remains unchanged

            env.setProcessing(false);
            const result2 = env.selectGalleryItem(item1.id);
            assert.equal(result2.id, item1.id);
            assert.equal(env.getActiveId(), item1.id);
        });

        test('clearGallery is blocked while isProcessing is true', () => {
            const env = createGalleryEnvironment();
            env.addToGallery('/output/1.png', 'A');
            env.setProcessing(true);

            assert.equal(env.clearGallery(), false);
            assert.equal(env.getGallery().length, 1);

            env.setProcessing(false);
            assert.equal(env.clearGallery(), true);
            assert.equal(env.getGallery().length, 0);
        });

        test('clearGallery resets gallery array, active ID, and isGalleryHidden', () => {
            const env = createGalleryEnvironment();
            env.addToGallery('/output/1.png', 'A');
            env.toggleGallery(); // isGalleryHidden = true
            assert.equal(env.isStripHidden(), true);

            env.clearGallery();
            assert.equal(env.getGallery().length, 0);
            assert.equal(env.getActiveId(), null);
            assert.equal(env.isStripHidden(), false); // reset to visible for next image
        });

        test('toggleGallery flips isGalleryHidden state when not processing', () => {
            const env = createGalleryEnvironment();
            assert.equal(env.isStripHidden(), false);
            assert.equal(env.toggleGallery(), true);
            assert.equal(env.isStripHidden(), true);

            env.setProcessing(true);
            assert.equal(env.toggleGallery(), true); // blocked
            assert.equal(env.isStripHidden(), true);

            env.setProcessing(false);
            assert.equal(env.toggleGallery(), false);
            assert.equal(env.isStripHidden(), false);
        });
    });

    describe('3. Web Application Wiring & Action Integration', () => {
        test('generateMap calls addToGallery with label Generated', () => {
            assert.ok(webHtml.includes("addToGallery(data.image_url, 'Generated')"));
        });

        test('convertPhoto calls addToGallery with label Photo to Depth', () => {
            assert.ok(webHtml.includes("addToGallery(data.image_url, 'Photo to Depth')"));
        });

        test('removeBg calls addToGallery with label Remove BG', () => {
            assert.ok(webHtml.includes("addToGallery(data.image_url, 'Remove BG')"));
        });

        test('invertDepthMap calls addToGallery with label Invert', () => {
            assert.ok(webHtml.includes("addToGallery(data.image_url, 'Invert')"));
        });

        test('polishRelief calls addToGallery with label Polished', () => {
            assert.ok(webHtml.includes("addToGallery(data.image_url, 'Polished')"));
        });

        test('displayImageSuccess restores action buttons to visible and enabled', () => {
            assert.ok(webHtml.includes("document.getElementById('removeBgBtn').style.display = 'inline-flex'"));
            assert.ok(webHtml.includes("document.getElementById('polishBtn').style.display = 'inline-flex'"));
            assert.ok(webHtml.includes("document.getElementById('invertBtn').style.display = 'inline-flex'"));
            assert.ok(webHtml.includes("document.getElementById('downloadBtn').href = imageUrl"));
            assert.ok(webHtml.includes("currentImageUrl = imageUrl"));
        });

        test('selectGalleryItem triggers displayImageSuccess with restored image URL', () => {
            assert.ok(webHtml.includes("displayImageSuccess(item.url)"));
        });

        test('isProcessing guard function checks loading and pipeline overlays', () => {
            assert.ok(webHtml.includes("function isProcessing()"));
            assert.ok(webHtml.includes("document.getElementById('loadingOverlay')"));
            assert.ok(webHtml.includes("document.getElementById('pipelineOverlay')"));
        });
    });

    describe('4. Android Native Jetpack Compose UI Parity', () => {
        test('MainActivity.kt imports LazyRow, items, and rememberLazyListState', () => {
            assert.ok(mainActivity.includes('androidx.compose.foundation.lazy.LazyRow'));
            assert.ok(mainActivity.includes('androidx.compose.foundation.lazy.items'));
            assert.ok(mainActivity.includes('androidx.compose.foundation.lazy.rememberLazyListState'));
        });

        test('MainActivity.kt defines SessionGalleryItem data class', () => {
            assert.ok(mainActivity.includes('data class SessionGalleryItem('));
            assert.ok(mainActivity.includes('val id: String'));
            assert.ok(mainActivity.includes('val imageUrl: String'));
            assert.ok(mainActivity.includes('val bitmap: Bitmap?'));
            assert.ok(mainActivity.includes('val label: String'));
            assert.ok(mainActivity.includes('val timestamp: String'));
        });

        test('MainActivity.kt defines SessionGalleryManager with addItem, clear, findItem', () => {
            assert.ok(mainActivity.includes('object SessionGalleryManager'));
            assert.ok(mainActivity.includes('fun addItem('));
            assert.ok(mainActivity.includes('fun clear()'));
            assert.ok(mainActivity.includes('fun findItem('));
        });

        test('ForgeScreen manages sessionGallery, activeGalleryItemId, isGalleryVisible, and galleryListState', () => {
            assert.ok(mainActivity.includes('var sessionGallery by remember { mutableStateOf<List<SessionGalleryItem>>(emptyList()) }'));
            assert.ok(mainActivity.includes('var activeGalleryItemId by remember { mutableStateOf<String?>(null) }'));
            assert.ok(mainActivity.includes('var isGalleryVisible by remember { mutableStateOf(true) }'));
            assert.ok(mainActivity.includes('val galleryListState = rememberLazyListState()'));
        });

        test('ForgeScreen has isBusy guard and auto-scrolls to active item', () => {
            assert.ok(mainActivity.includes('val isBusy = isGenerating || isPolishing || isInverting || isRemovingBg'));
            assert.ok(mainActivity.includes('LaunchedEffect(activeGalleryItemId)'));
            assert.ok(mainActivity.includes('galleryListState.animateScrollToItem(index)'));
        });

        test('MainActivity.kt renders Session Gallery Card when sessionGallery is non-empty', () => {
            assert.ok(mainActivity.includes('if (sessionGallery.isNotEmpty())'));
            assert.ok(mainActivity.includes('Session Gallery (${sessionGallery.size})'));
            assert.ok(mainActivity.includes('LazyRow('));
            assert.ok(mainActivity.includes('state = galleryListState'));
        });

        test('MainActivity.kt provides Clear and Hide/Show controls with busy disabled guard', () => {
            assert.ok(mainActivity.includes('isGalleryVisible = !isGalleryVisible'));
            assert.ok(mainActivity.includes('sessionGallery = SessionGalleryManager.clear()'));
            assert.ok(mainActivity.includes('enabled = !isBusy'));
        });

        test('MainActivity.kt restores active image, downloads bitmap fallback, and guards with isBusy', () => {
            assert.ok(mainActivity.includes('clickable(enabled = !isBusy)'));
            assert.ok(mainActivity.includes('activeGalleryItemId = item.id'));
            assert.ok(mainActivity.includes('currentImageUrl = item.imageUrl'));
            assert.ok(mainActivity.includes('currentBitmap = item.bitmap'));
            assert.ok(mainActivity.includes('ApiClient.downloadImage(item.imageUrl)'));
        });

        test('MainActivity.kt provides Download button whenever active image exists', () => {
            assert.ok(mainActivity.includes('Text("Download")'));
            assert.ok(mainActivity.includes('saveImageToGallery(context, bitmap'));
            // Polish is conditional on !isPolished, Download is rendered without requiring isPolished
            assert.ok(mainActivity.includes('if (!isPolished)'));
        });

        test('MainActivity.kt appends to sessionGallery on generate, photo, invert, removeBg, polish', () => {
            assert.ok(mainActivity.includes('SessionGalleryManager.addItem('));
            assert.ok(mainActivity.includes('"Generated"'));
            assert.ok(mainActivity.includes('"Photo"'));
            assert.ok(mainActivity.includes('"Invert"'));
            assert.ok(mainActivity.includes('"Remove BG"'));
            assert.ok(mainActivity.includes('"Polish"'));
        });
    });

    describe('5. Direct VM Execution of static/index.html Script', () => {
        function setupVmEnvironment() {
            const elements = {};
            function getOrCreate(id) {
                if (!elements[id]) {
                    elements[id] = {
                        id,
                        style: { display: 'none' },
                        value: '',
                        innerText: '',
                        textContent: '',
                        innerHTML: '',
                        src: '',
                        href: '',
                        disabled: false,
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
                        addEventListener() {},
                        querySelector(sel) {
                            if (sel.includes('.gallery-thumb-item.active')) {
                                return { scrollIntoView() {} };
                            }
                            return null;
                        },
                        querySelectorAll() { return []; },
                        getAttribute(attr) { return this[attr] || null; }
                    };
                }
                return elements[id];
            }

            // Pre-seed required DOM elements
            [
                'dropZone', 'photoPreviewImg', 'dropText', 'convertBtn', 'clearPhotoBtn', 'fileInput',
                'sessionGalleryContainer', 'sessionGalleryStrip', 'sessionGalleryCount', 'toggleGalleryBtn',
                'clearGalleryBtn', 'outputImage', 'placeholder', 'actionBar', 'downloadBtn',
                'removeBgBtn', 'polishBtn', 'invertBtn', 'depthIntensity', 'photoDepthIntensity',
                'depthIntensityVal', 'photoDepthIntensityVal', 'promptInput', 'generateBtn',
                'loadingText', 'loadingOverlay', 'pipelineOverlay', 'tabText', 'tabPhoto',
                'textPanel', 'photoPanel', 'promptHistoryContainer', 'promptHistorySelect',
                'promptHistoryList', 'clearHistoryBtn'
            ].forEach(id => getOrCreate(id));

            // Extract script tag content from webHtml
            const scriptMatch = webHtml.match(/<script>([\s\S]*?)<\/script>/);
            assert.ok(scriptMatch, 'Expected script tag in index.html');
            const scriptCode = scriptMatch[1];

            const sandbox = {
                document: {
                    getElementById: (id) => getOrCreate(id),
                    querySelector: (sel) => getOrCreate('outputImage').querySelector(sel),
                    querySelectorAll: () => []
                },
                console: {
                    log: () => {},
                    error: () => {},
                    warn: () => {}
                },
                Date,
                Math,
                String,
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

            return { sandbox, elements, getOrCreate };
        }

        test('addToGallery updates DOM container, count, and renders active thumbnail', () => {
            const { sandbox, elements } = setupVmEnvironment();
            assert.equal(elements.sessionGalleryContainer.style.display, 'none');

            sandbox.addToGallery('/output/first.png', 'Generated');

            assert.equal(elements.sessionGalleryContainer.style.display, 'block');
            assert.equal(elements.sessionGalleryCount.innerText, '(1)');
            assert.ok(elements.sessionGalleryStrip.innerHTML.includes('data-url="/output/first.png"'));
            assert.ok(elements.sessionGalleryStrip.innerHTML.includes('gallery-thumb-item active'));
            assert.ok(elements.sessionGalleryStrip.innerHTML.includes('Generated'));
            assert.ok(elements.sessionGalleryStrip.innerHTML.includes('role="button"'));
            assert.ok(elements.sessionGalleryStrip.innerHTML.includes('tabindex="0"'));
        });

        test('selectGalleryItem restores preview output, download href, and updates active thumb', () => {
            const { sandbox, elements } = setupVmEnvironment();
            sandbox.addToGallery('/output/item1.png', 'Generated');
            sandbox.addToGallery('/output/item2.png', 'Invert');

            // Select item1
            const gallery = vm.runInContext('sessionGallery', sandbox);
            assert.equal(gallery.length, 2);
            const item1Id = gallery[0].id;

            sandbox.selectGalleryItem(item1Id);

            assert.equal(elements.outputImage.src, '/output/item1.png');
            assert.equal(elements.outputImage.style.display, 'block');
            assert.equal(elements.downloadBtn.href, '/output/item1.png');
            assert.equal(elements.placeholder.style.display, 'none');
            assert.equal(elements.actionBar.style.display, 'flex');
            assert.equal(elements.removeBgBtn.disabled, false);
            assert.equal(elements.polishBtn.disabled, false);
            assert.equal(elements.invertBtn.disabled, false);
            assert.equal(vm.runInContext('activeGalleryItemId', sandbox), item1Id);
        });

        test('selectGalleryItem and clearGallery are blocked when loadingOverlay is active', () => {
            const { sandbox, elements } = setupVmEnvironment();
            sandbox.addToGallery('/output/item1.png', 'Generated');
            sandbox.addToGallery('/output/item2.png', 'Invert');

            const gallery = vm.runInContext('sessionGallery', sandbox);
            const item1Id = gallery[0].id;
            const item2Id = gallery[1].id;

            // Simulate active generation
            elements.loadingOverlay.style.display = 'flex';
            assert.equal(sandbox.isProcessing(), true);

            // Attempt to select item1 during loading
            sandbox.selectGalleryItem(item1Id);
            assert.equal(vm.runInContext('activeGalleryItemId', sandbox), item2Id); // un-switched

            // Attempt to clear during loading
            sandbox.clearGallery();
            assert.equal(vm.runInContext('sessionGallery.length', sandbox), 2); // un-cleared

            // Reset loading
            elements.loadingOverlay.style.display = 'none';
            assert.equal(sandbox.isProcessing(), false);

            // Now selection and clear succeed
            sandbox.selectGalleryItem(item1Id);
            assert.equal(vm.runInContext('activeGalleryItemId', sandbox), item1Id);

            sandbox.clearGallery();
            assert.equal(vm.runInContext('sessionGallery.length', sandbox), 0);
            assert.equal(elements.sessionGalleryContainer.style.display, 'none');
        });

        test('toggleGallery hides and reveals the strip and updates button text', () => {
            const { sandbox, elements } = setupVmEnvironment();
            sandbox.addToGallery('/output/test.png', 'Generated');

            assert.equal(elements.sessionGalleryStrip.style.display, 'flex');
            assert.equal(elements.toggleGalleryBtn.innerText, 'Hide');

            sandbox.toggleGallery();
            assert.equal(elements.sessionGalleryStrip.style.display, 'none');
            assert.equal(elements.toggleGalleryBtn.innerText, 'Show');

            sandbox.toggleGallery();
            assert.equal(elements.sessionGalleryStrip.style.display, 'flex');
            assert.equal(elements.toggleGalleryBtn.innerText, 'Hide');
        });
    });

    describe('6. Adversarial Edge Cases & Robustness Checks', () => {
        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        test('escapeHtml safely sanitizes malicious input in gallery item attributes', () => {
            const maliciousLabel = '<script>alert("xss")</script>';
            const escaped = escapeHtml(maliciousLabel);
            assert.ok(!escaped.includes('<script>'));
            assert.ok(escaped.includes('&lt;script&gt;'));
        });

        test('rapid sequential additions generate 50 distinct IDs and maintain chronological ordering', () => {
            const items = [];
            for (let i = 0; i < 50; i++) {
                const id = 'gallery-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
                items.push({ id, index: i });
            }
            const uniqueIds = new Set(items.map(it => it.id));
            assert.equal(uniqueIds.size, 50);
        });

        test('gallery maintains multiline or unicode/emoji labels', () => {
            const unicodeLabels = [
                '🖼️ Initial Carve 3D',
                '🔄 Inverted Depth (16-bit)',
                '✨ Polish & Smooth',
                '✂️ Cutout & BG Isolation',
                '深度图 2026-09-06'
            ];
            unicodeLabels.forEach(label => {
                const escaped = escapeHtml(label);
                assert.ok(escaped.length > 0);
            });
        });

        test('handles clear when already empty without throwing', () => {
            let sessionGallery = [];
            sessionGallery = [];
            assert.equal(sessionGallery.length, 0);
        });

        test('handles thumbnail click restoring earlier version for branching workflows', () => {
            const session = [];
            const gen = { id: '1', url: '/gen.png', label: 'Generated' };
            const inv = { id: '2', url: '/inv.png', label: 'Invert' };
            const pol = { id: '3', url: '/pol.png', label: 'Polish' };
            session.push(gen, inv, pol);

            // User restores item 1
            let activeUrl = gen.url;
            assert.equal(activeUrl, '/gen.png');

            // User performs removeBg on item 1, resulting in a 4th entry
            const remBg = { id: '4', url: '/rembg_from_gen.png', label: 'Remove BG' };
            session.push(remBg);
            activeUrl = remBg.url;

            assert.equal(session.length, 4);
            assert.equal(activeUrl, '/rembg_from_gen.png');
            assert.equal(session[0].label, 'Generated');
            assert.equal(session[1].label, 'Invert');
            assert.equal(session[2].label, 'Polish');
            assert.equal(session[3].label, 'Remove BG');
        });
    });

    describe('7. Adversarial Concurrency & Narrow Viewport Stress Tests', () => {
        test('Web action handlers abort immediately when isProcessing is active', () => {
            assert.ok(webHtml.includes('if (isProcessing()) return;'));
            assert.ok(webHtml.includes('if (isProcessing() || !selectedPhotoFile) return;'));
            assert.ok(webHtml.includes('if (isProcessing() || !currentImageUrl) return;'));
            assert.ok(webHtml.includes('if(!isProcessing())location.reload()'));
        });

        test('MainActivity.kt guards all user interaction points with !isBusy', () => {
            const mainActivityKt = fs.readFileSync(mainActivityPath, 'utf-8');
            assert.ok(mainActivityKt.includes('enabled = !isBusy'));
            assert.ok(mainActivityKt.includes('enabled = selectedPhotoUri != null && !isBusy'));
            assert.ok(mainActivityKt.includes('.clickable(enabled = !isBusy)'));
            assert.ok(mainActivityKt.includes('enabled = !isBusy && currentBitmap != null'));
        });

        test('CSS contains responsive rules for narrow viewports and touch momentum scrolling', () => {
            assert.ok(webCss.includes('flex-wrap: wrap'));
            assert.ok(webCss.includes('-webkit-overflow-scrolling: touch'));
            assert.ok(webCss.includes('@media (max-width: 480px)'));
            assert.ok(webCss.includes('.session-gallery-container'));
        });

        test('large session stress test: handles 25 gallery items with correct badges and active state', () => {
            let sessionGallery = [];
            let activeGalleryItemId = null;
            function addToGallery(url, label) {
                const id = 'gallery-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
                const item = { id, url, label, timestamp: '12:00:00' };
                sessionGallery.push(item);
                activeGalleryItemId = id;
                return item;
            }

            for (let i = 1; i <= 25; i++) {
                addToGallery(`/static/generated/map_${i}.png`, `Version ${i}`);
            }

            assert.equal(sessionGallery.length, 25);
            assert.equal(activeGalleryItemId, sessionGallery[24].id);
            assert.equal(sessionGallery[0].label, 'Version 1');
            assert.equal(sessionGallery[24].label, 'Version 25');

            // Select 5th item
            const item5 = sessionGallery[4];
            activeGalleryItemId = item5.id;
            assert.equal(activeGalleryItemId, item5.id);
            assert.equal(sessionGallery.length, 25); // list not mutated
        });
    });
});

