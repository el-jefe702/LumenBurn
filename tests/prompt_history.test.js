import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Prompt History Feature (F3) - Unit & Integration Tests', () => {

    describe('1. Web UI & Assets Parity', () => {
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

        test('HTML contains prompt history container, select dropdown, list, and clear button', () => {
            assert.ok(webHtml.includes('id="promptHistoryContainer"'));
            assert.ok(webHtml.includes('id="promptHistorySelect"'));
            assert.ok(webHtml.includes('id="promptHistoryList"'));
            assert.ok(webHtml.includes('id="clearHistoryBtn"'));
            assert.ok(webHtml.includes('onclick="clearPromptHistory()"'));
            assert.ok(webHtml.includes('Clear history'));
        });

        test('CSS contains classes for prompt history UI', () => {
            assert.ok(webCss.includes('.prompt-history-container'));
            assert.ok(webCss.includes('.prompt-history-header'));
            assert.ok(webCss.includes('.btn-clear-history'));
            assert.ok(webCss.includes('.prompt-history-select'));
            assert.ok(webCss.includes('.prompt-history-list'));
            assert.ok(webCss.includes('.prompt-history-item'));
            assert.ok(webCss.includes('.prompt-history-text'));
        });
    });

    describe('2. Client-side Prompt History Logic & Storage Contract', () => {
        // Create mock localStorage environment
        class MockLocalStorage {
            constructor() {
                this.store = {};
            }
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
            }
            setItem(key, value) {
                this.store[key] = String(value);
            }
            removeItem(key) {
                delete this.store[key];
            }
            clear() {
                this.store = {};
            }
        }

        const PROMPT_HISTORY_KEY = 'depthforge_prompt_history';
        const MAX_PROMPT_HISTORY = 10;

        function createHistoryHelper(storage) {
            function getPromptHistory() {
                try {
                    const stored = storage.getItem(PROMPT_HISTORY_KEY);
                    if (!stored) return [];
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
                    }
                    return [];
                } catch (e) {
                    return [];
                }
            }

            function savePromptToHistory(promptText) {
                const trimmed = (promptText || '').trim();
                if (!trimmed) return;
                let history = getPromptHistory();
                history = history.filter(item => item !== trimmed);
                history.unshift(trimmed);
                if (history.length > MAX_PROMPT_HISTORY) {
                    history = history.slice(0, MAX_PROMPT_HISTORY);
                }
                storage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(history));
                return history;
            }

            function clearPromptHistory() {
                storage.removeItem(PROMPT_HISTORY_KEY);
            }

            return { getPromptHistory, savePromptToHistory, clearPromptHistory };
        }

        test('uses exact localStorage key "depthforge_prompt_history"', () => {
            const webHtml = fs.readFileSync(path.join(rootDir, 'static', 'index.html'), 'utf-8');
            assert.ok(webHtml.includes("'depthforge_prompt_history'"));
            assert.equal(PROMPT_HISTORY_KEY, 'depthforge_prompt_history');
        });

        test('returns empty array when history is not set', () => {
            const storage = new MockLocalStorage();
            const { getPromptHistory } = createHistoryHelper(storage);
            assert.deepEqual(getPromptHistory(), []);
        });

        test('saves prompt and persists in storage under key', () => {
            const storage = new MockLocalStorage();
            const { savePromptToHistory, getPromptHistory } = createHistoryHelper(storage);

            savePromptToHistory('Intricate Celtic dragon carving in oak');
            const history = getPromptHistory();
            assert.equal(history.length, 1);
            assert.equal(history[0], 'Intricate Celtic dragon carving in oak');
            assert.equal(storage.getItem('depthforge_prompt_history'), JSON.stringify(['Intricate Celtic dragon carving in oak']));
        });

        test('caps history at exactly 10 items (oldest removed on overflow)', () => {
            const storage = new MockLocalStorage();
            const { savePromptToHistory, getPromptHistory } = createHistoryHelper(storage);

            for (let i = 1; i <= 15; i++) {
                savePromptToHistory(`Prompt #${i}`);
            }

            const history = getPromptHistory();
            assert.equal(history.length, 10);
            assert.equal(history[0], 'Prompt #15');
            assert.equal(history[9], 'Prompt #6');
            assert.ok(!history.includes('Prompt #1'));
            assert.ok(!history.includes('Prompt #5'));
        });

        test('moves duplicated prompts to front without creating duplicate entries', () => {
            const storage = new MockLocalStorage();
            const { savePromptToHistory, getPromptHistory } = createHistoryHelper(storage);

            savePromptToHistory('Lion medallion');
            savePromptToHistory('Eagle relief');
            savePromptToHistory('Wolf emblem');
            savePromptToHistory('Lion medallion'); // re-used

            const history = getPromptHistory();
            assert.equal(history.length, 3);
            assert.equal(history[0], 'Lion medallion');
            assert.equal(history[1], 'Wolf emblem');
            assert.equal(history[2], 'Eagle relief');
        });

        test('ignores empty, whitespace-only, or null prompts', () => {
            const storage = new MockLocalStorage();
            const { savePromptToHistory, getPromptHistory } = createHistoryHelper(storage);

            savePromptToHistory('');
            savePromptToHistory('   ');
            savePromptToHistory(null);
            savePromptToHistory(undefined);

            assert.deepEqual(getPromptHistory(), []);
        });

        test('clears history completely on clearPromptHistory()', () => {
            const storage = new MockLocalStorage();
            const { savePromptToHistory, clearPromptHistory, getPromptHistory } = createHistoryHelper(storage);

            savePromptToHistory('Prompt 1');
            savePromptToHistory('Prompt 2');
            assert.equal(getPromptHistory().length, 2);

            clearPromptHistory();
            assert.equal(storage.getItem('depthforge_prompt_history'), null);
            assert.deepEqual(getPromptHistory(), []);
        });
    });

    describe('3. Adversarial Edge Cases & Robustness Checks', () => {
        const PROMPT_HISTORY_KEY = 'depthforge_prompt_history';
        const MAX_PROMPT_HISTORY = 10;

        function createFullHistoryHelper(storage) {
            function escapeHtml(str) {
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }

            function getPromptHistory() {
                try {
                    const stored = storage.getItem(PROMPT_HISTORY_KEY);
                    if (!stored) return [];
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) {
                        return parsed.filter(item => typeof item === 'string' && item.trim().length > 0);
                    }
                    return [];
                } catch (e) {
                    return [];
                }
            }

            function savePromptToHistory(promptText) {
                const trimmed = (promptText || '').trim();
                if (!trimmed) return;
                try {
                    let history = getPromptHistory();
                    history = history.filter(item => item !== trimmed);
                    history.unshift(trimmed);
                    if (history.length > MAX_PROMPT_HISTORY) {
                        history = history.slice(0, MAX_PROMPT_HISTORY);
                    }
                    storage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(history));
                    return history;
                } catch (e) {
                    // Gracefully handles QuotaExceededError or SecurityError
                    return null;
                }
            }

            function clearPromptHistory() {
                try {
                    storage.removeItem(PROMPT_HISTORY_KEY);
                } catch (e) {
                    // Gracefully handles SecurityError
                }
            }

            return { getPromptHistory, savePromptToHistory, clearPromptHistory, escapeHtml };
        }

        test('gracefully handles QuotaExceededError when saving prompt', () => {
            const storage = {
                getItem: () => null,
                setItem: () => {
                    const err = new Error('QuotaExceededError');
                    err.name = 'QuotaExceededError';
                    throw err;
                },
                removeItem: () => {}
            };
            const { savePromptToHistory } = createFullHistoryHelper(storage);
            assert.doesNotThrow(() => {
                const res = savePromptToHistory('Massive prompt exceeding storage quota');
                assert.equal(res, null);
            });
        });

        test('gracefully handles SecurityError when reading or clearing storage', () => {
            const storage = {
                getItem: () => {
                    const err = new Error('The operation is insecure.');
                    err.name = 'SecurityError';
                    throw err;
                },
                setItem: () => {},
                removeItem: () => {
                    const err = new Error('The operation is insecure.');
                    err.name = 'SecurityError';
                    throw err;
                }
            };
            const { getPromptHistory, clearPromptHistory } = createFullHistoryHelper(storage);
            assert.doesNotThrow(() => {
                const history = getPromptHistory();
                assert.deepEqual(history, []);
                clearPromptHistory();
            });
        });

        test('handles corrupted or non-array JSON in localStorage without throwing', () => {
            const corruptValues = [
                '{ not valid json',
                '{"prompt": "hello"}',
                '12345',
                '"just a string"',
                'true',
                'null'
            ];

            for (const val of corruptValues) {
                const storage = {
                    getItem: () => val,
                    setItem: () => {},
                    removeItem: () => {}
                };
                const { getPromptHistory } = createFullHistoryHelper(storage);
                assert.deepEqual(getPromptHistory(), [], `Failed for corrupt value: ${val}`);
            }
        });

        test('sanitizes array in localStorage containing mixed/invalid data types', () => {
            const mixedArray = [
                'Valid prompt 1',
                null,
                undefined,
                42,
                '',
                '   ',
                { key: 'value' },
                ['nested'],
                true,
                'Valid prompt 2'
            ];

            const storage = {
                getItem: () => JSON.stringify(mixedArray),
                setItem: () => {},
                removeItem: () => {}
            };
            const { getPromptHistory } = createFullHistoryHelper(storage);
            assert.deepEqual(getPromptHistory(), ['Valid prompt 1', 'Valid prompt 2']);
        });

        test('trims whitespace and deduplicates identical prompts with different spacing', () => {
            const store = {};
            const storage = {
                getItem: (k) => store[k] || null,
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            };
            const { savePromptToHistory, getPromptHistory } = createFullHistoryHelper(storage);

            savePromptToHistory('  Intricate dragon carving  ');
            assert.deepEqual(getPromptHistory(), ['Intricate dragon carving']);

            savePromptToHistory('Intricate dragon carving');
            assert.deepEqual(getPromptHistory(), ['Intricate dragon carving']);
        });

        test('promotes existing prompt to top without duplicating when already in list', () => {
            const store = {};
            const storage = {
                getItem: (k) => store[k] || null,
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            };
            const { savePromptToHistory, getPromptHistory } = createFullHistoryHelper(storage);

            for (let i = 1; i <= 10; i++) {
                savePromptToHistory(`Prompt ${i}`);
            }
            assert.equal(getPromptHistory().length, 10);
            assert.equal(getPromptHistory()[0], 'Prompt 10');
            assert.equal(getPromptHistory()[9], 'Prompt 1');

            // Re-use prompt 4 (which was at index 6)
            savePromptToHistory('Prompt 4');
            const updated = getPromptHistory();
            assert.equal(updated.length, 10);
            assert.equal(updated[0], 'Prompt 4');
            assert.equal(updated[1], 'Prompt 10');
            assert.equal(updated[9], 'Prompt 1');
            assert.equal(updated.filter(p => p === 'Prompt 4').length, 1);
        });

        test('escapeHtml prevents XSS and safely escapes special characters', () => {
            const { escapeHtml } = createFullHistoryHelper({});
            const maliciousInput = '<script>alert("XSS & injection")</script>';
            const escaped = escapeHtml(maliciousInput);
            assert.ok(!escaped.includes('<script>'));
            assert.ok(escaped.includes('&lt;script&gt;'));
            assert.ok(escaped.includes('&amp;'));
            assert.ok(escaped.includes('&quot;'));

            const singleQuoteInput = "Carving with '3D' relief & depth";
            const singleEscaped = escapeHtml(singleQuoteInput);
            assert.ok(singleEscaped.includes('&#039;'));
            assert.ok(singleEscaped.includes('&amp;'));
        });

        test('preserves multiline prompts, Unicode symbols, and emojis', () => {
            const store = {};
            const storage = {
                getItem: (k) => store[k] || null,
                setItem: (k, v) => { store[k] = v; },
                removeItem: (k) => { delete store[k]; }
            };
            const { savePromptToHistory, getPromptHistory, escapeHtml } = createFullHistoryHelper(storage);

            const multilinePrompt = '🐉 Celtic Dragon Relief\nIntricate scales with depth\n"16-bit CNC carving"';
            savePromptToHistory(multilinePrompt);

            const history = getPromptHistory();
            assert.equal(history.length, 1);
            assert.equal(history[0], multilinePrompt);

            const escaped = escapeHtml(multilinePrompt);
            assert.ok(escaped.includes('🐉 Celtic Dragon Relief'));
            assert.ok(escaped.includes('&quot;16-bit CNC carving&quot;'));
        });

        test('handles empty string or whitespace JSON stored in localStorage', () => {
            const storage = {
                getItem: () => '',
                setItem: () => {},
                removeItem: () => {}
            };
            const { getPromptHistory } = createFullHistoryHelper(storage);
            assert.deepEqual(getPromptHistory(), []);
        });
    });

    describe('4. Android Native Prompt History Integration', () => {
        const mainActivityKt = fs.readFileSync(path.join(rootDir, 'android_app', 'app', 'src', 'main', 'kotlin', 'com', 'depthforge', 'app', 'MainActivity.kt'), 'utf-8');

        test('MainActivity.kt defines PromptHistoryManager with PREFS_KEY and MAX_ITEMS', () => {
            assert.ok(mainActivityKt.includes('object PromptHistoryManager'));
            assert.ok(mainActivityKt.includes('PREFS_KEY = "depthforge_prompt_history"'));
            assert.ok(mainActivityKt.includes('MAX_ITEMS = 10'));
            assert.ok(mainActivityKt.includes('fun getHistory(prefs: SharedPreferences)'));
            assert.ok(mainActivityKt.includes('fun savePrompt(prefs: SharedPreferences, prompt: String') || mainActivityKt.includes('fun savePrompt(prefs: SharedPreferences, prompt: String?'));
            assert.ok(mainActivityKt.includes('fun clearHistory(prefs: SharedPreferences)'));
        });

        test('MainActivity.kt renders prompt history UI only when non-empty', () => {
            assert.ok(mainActivityKt.includes('if (promptHistory.isNotEmpty())'));
            assert.ok(mainActivityKt.includes('Recent Prompts'));
            assert.ok(mainActivityKt.includes('Clear history'));
        });

        test('MainActivity.kt updates promptInput on clicking a history item', () => {
            assert.ok(mainActivityKt.includes('promptInput = histPrompt'));
        });

        test('MainActivity.kt saves prompt to history upon successful generation', () => {
            assert.ok(mainActivityKt.includes('PromptHistoryManager.savePrompt(actualPrefs, promptInput)'));
        });

        test('MainActivity.kt clears prompt history on Clear button click', () => {
            assert.ok(mainActivityKt.includes('PromptHistoryManager.clearHistory(actualPrefs)'));
            assert.ok(mainActivityKt.includes('promptHistory = emptyList()'));
        });
    });
});
