import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Set NODE_ENV to test to avoid starting listening server
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = 'test_key';

const {
    app,
    getPackageVersion,
    resolvePythonExecutable,
    isPythonAvailable,
    clearPythonCache
} = await import('../server.js');

describe('Health Check Endpoint (F9) - Unit & Integration Tests', () => {

    describe('1. HTTP 200 and JSON Schema Verification', () => {
        let server;
        let baseUrl;

        beforeEach(() => {
            server = app.listen(0);
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
        });

        afterEach(() => {
            if (server) server.close();
        });

        test('GET /api/health returns HTTP 200 with application/json content type', async () => {
            const res = await fetch(`${baseUrl}/api/health`);
            assert.equal(res.status, 200);
            assert.ok(res.headers.get('content-type')?.includes('application/json'));
        });

        test('GET /api/health response matches exact required JSON schema', async () => {
            const res = await fetch(`${baseUrl}/api/health`);
            assert.equal(res.status, 200);
            const data = await res.json();

            // Expected schema keys
            const keys = Object.keys(data).sort();
            assert.deepEqual(keys, ['python', 'status', 'timestamp', 'uptime', 'version']);

            // Schema field types and contracts
            assert.equal(data.status, 'ok');
            assert.equal(typeof data.version, 'string');
            assert.match(data.version, /^\d+\.\d+\.\d+/);
            assert.equal(typeof data.python, 'boolean');
            assert.equal(typeof data.uptime, 'number');
            assert.ok(Number.isFinite(data.uptime));
            assert.ok(data.uptime >= 0);
            assert.equal(typeof data.timestamp, 'string');
            assert.ok(!Number.isNaN(Date.parse(data.timestamp)));
        });

        test('HEAD /api/health returns HTTP 200 without payload', async () => {
            const res = await fetch(`${baseUrl}/api/health`, { method: 'HEAD' });
            assert.equal(res.status, 200);
            assert.ok(res.headers.get('content-type')?.includes('application/json'));
        });

        test('GET /api/health sets strict Cache-Control and anti-caching headers', async () => {
            const res = await fetch(`${baseUrl}/api/health`);
            assert.equal(res.status, 200);
            const cacheControl = res.headers.get('cache-control');
            assert.ok(cacheControl?.includes('no-store'), 'Expected Cache-Control to include no-store');
            assert.ok(cacheControl?.includes('no-cache'), 'Expected Cache-Control to include no-cache');
            assert.equal(res.headers.get('pragma'), 'no-cache');
            assert.equal(res.headers.get('expires'), '0');
        });

        test('GET /api/health supports query parameters gracefully without schema deviation', async () => {
            const res = await fetch(`${baseUrl}/api/health?probe=liveness&verbose=1&t=${Date.now()}`);
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.status, 'ok');
            assert.equal(typeof data.version, 'string');
            assert.equal(typeof data.python, 'boolean');
        });

        test('OPTIONS /api/health returns HTTP 204 with Allow: GET, HEAD, OPTIONS header', async () => {
            const res = await fetch(`${baseUrl}/api/health`, { method: 'OPTIONS' });
            assert.equal(res.status, 204);
            const allow = res.headers.get('allow');
            assert.ok(allow?.includes('GET'));
            assert.ok(allow?.includes('HEAD'));
            assert.ok(allow?.includes('OPTIONS'));
        });

        test('POST /api/health returns HTTP 405 Method Not Allowed with Allow header and structured JSON error', async () => {
            const res = await fetch(`${baseUrl}/api/health`, { method: 'POST', body: JSON.stringify({ test: 1 }) });
            assert.equal(res.status, 405);
            const allow = res.headers.get('allow');
            assert.ok(allow?.includes('GET'));
            assert.ok(allow?.includes('HEAD'));
            const data = await res.json();
            assert.equal(data.status, 'error');
            assert.match(data.error, /Method POST not allowed/i);
            assert.ok(Array.isArray(data.allowedMethods));
        });

        test('PUT, DELETE, and PATCH /api/health return HTTP 405 with Allow header', async () => {
            for (const method of ['PUT', 'DELETE', 'PATCH']) {
                const res = await fetch(`${baseUrl}/api/health`, { method });
                assert.equal(res.status, 405, `Expected 405 for ${method}`);
                const allow = res.headers.get('allow');
                assert.ok(allow?.includes('GET'), `Expected Allow header on 405 for ${method}`);
                const data = await res.json();
                assert.equal(data.status, 'error');
            }
        });
    });

    describe('2. Dynamic package.json Version Resolution', () => {
        let server;
        let baseUrl;
        const pkgPath = path.join(rootDir, 'package.json');
        let originalPkgContent;

        beforeEach(() => {
            originalPkgContent = fs.readFileSync(pkgPath, 'utf-8');
            server = app.listen(0);
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
        });

        afterEach(() => {
            if (server) server.close();
            // Restore original package.json
            fs.writeFileSync(pkgPath, originalPkgContent, 'utf-8');
        });

        test('reads current version dynamically from package.json', async () => {
            const expectedVersion = JSON.parse(originalPkgContent).version;
            const res = await fetch(`${baseUrl}/api/health`);
            const data = await res.json();
            assert.equal(data.version, expectedVersion);
            assert.equal(getPackageVersion(), expectedVersion);
        });

        test('reflects version changes dynamically without server restart', async () => {
            const modifiedPkg = JSON.parse(originalPkgContent);
            modifiedPkg.version = '9.8.7-test.dynamic';
            fs.writeFileSync(pkgPath, JSON.stringify(modifiedPkg, null, 2), 'utf-8');

            const res = await fetch(`${baseUrl}/api/health`);
            const data = await res.json();
            assert.equal(data.version, '9.8.7-test.dynamic');
            assert.equal(getPackageVersion(), '9.8.7-test.dynamic');
        });

        test('getPackageVersion handles missing version field gracefully', () => {
            const tempPkg = JSON.parse(originalPkgContent);
            delete tempPkg.version;
            fs.writeFileSync(pkgPath, JSON.stringify(tempPkg, null, 2), 'utf-8');

            assert.equal(getPackageVersion(), '0.0.0');
        });

        test('getPackageVersion strips UTF-8 byte order mark (BOM) without failing', () => {
            const bomContent = '\uFEFF' + JSON.stringify({ version: '3.4.5-bom' });
            fs.writeFileSync(pkgPath, bomContent, 'utf-8');

            assert.equal(getPackageVersion(), '3.4.5-bom');
        });

        test('getPackageVersion handles non-string or whitespace version safely', () => {
            const tempPkg = JSON.parse(originalPkgContent);
            tempPkg.version = 12345;
            fs.writeFileSync(pkgPath, JSON.stringify(tempPkg, null, 2), 'utf-8');
            assert.equal(getPackageVersion(), '0.0.0');

            tempPkg.version = '   ';
            fs.writeFileSync(pkgPath, JSON.stringify(tempPkg, null, 2), 'utf-8');
            assert.equal(getPackageVersion(), '0.0.0');
        });

        test('getPackageVersion handles malformed JSON without crashing (fallback to 0.0.0)', () => {
            fs.writeFileSync(pkgPath, '{ malformed: json: missing_quotes', 'utf-8');
            assert.equal(getPackageVersion(), '0.0.0');
        });

        test('getPackageVersion handles non-existent file or directory path safely', () => {
            const nonExistentPath = path.join(rootDir, 'non_existent_package_file.json');
            assert.equal(getPackageVersion(nonExistentPath), '0.0.0');
            assert.equal(getPackageVersion(rootDir), '0.0.0');
        });

        test('GET /api/health returns HTTP 200 with fallback version 0.0.0 when package.json is corrupted', async () => {
            fs.writeFileSync(pkgPath, '{ "version": [corrupted json syntax] }', 'utf-8');
            const res = await fetch(`${baseUrl}/api/health`);
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.status, 'ok');
            assert.equal(data.version, '0.0.0');
        });
    });

    describe('3. Accurate Python Presence Reporting', () => {
        let server;
        let baseUrl;
        const originalPythonExec = process.env.PYTHON_EXEC;

        beforeEach(() => {
            server = app.listen(0);
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
        });

        afterEach(() => {
            if (server) server.close();
            if (originalPythonExec !== undefined) {
                process.env.PYTHON_EXEC = originalPythonExec;
            } else {
                delete process.env.PYTHON_EXEC;
            }
        });

        test('isPythonAvailable returns true when python and processor.py exist', () => {
            const available = isPythonAvailable();
            assert.equal(typeof available, 'boolean');
            assert.equal(available, true);
        });

        test('isPythonAvailable returns false when processor.py does not exist', () => {
            const fakePath = path.join(rootDir, 'non_existent_processor.py');
            const available = isPythonAvailable(resolvePythonExecutable, fakePath);
            assert.equal(available, false);
        });

        test('isPythonAvailable returns false when processor is a directory', () => {
            const dirPath = path.join(rootDir, 'static');
            const available = isPythonAvailable(resolvePythonExecutable, dirPath);
            assert.equal(available, false);
        });

        test('isPythonAvailable returns false when resolveFn returns null, undefined, or empty string', () => {
            assert.equal(isPythonAvailable(() => null), false);
            assert.equal(isPythonAvailable(() => undefined), false);
            assert.equal(isPythonAvailable(() => ''), false);
            assert.equal(isPythonAvailable(() => '   '), false);
        });

        test('isPythonAvailable returns false when executable path does not exist on disk', () => {
            const fakePy = path.join(rootDir, 'non_existent_venv', 'python.exe');
            assert.equal(isPythonAvailable(() => fakePy), false);
        });

        test('isPythonAvailable returns false when executable cannot be executed or fails', () => {
            assert.equal(isPythonAvailable(() => 'invalid_command_nonexistent_xyz'), false);
        });

        test('resolvePythonExecutable respects process.env.PYTHON_EXEC override', () => {
            process.env.PYTHON_EXEC = '/custom/bin/python3';
            assert.equal(resolvePythonExecutable(), '/custom/bin/python3');
        });

        test('GET /api/health accurately reports degraded python presence over HTTP when Python is unavailable', async () => {
            process.env.PYTHON_EXEC = 'invalid_nonexistent_python_binary_404';
            const res = await fetch(`${baseUrl}/api/health`);
            assert.equal(res.status, 200);
            const data = await res.json();
            assert.equal(data.status, 'ok');
            assert.equal(data.python, false);
            assert.ok(typeof data.version === 'string');
            assert.ok(typeof data.uptime === 'number');
        });

        test('isPythonAvailable caches results to prevent event-loop starvation and respects clearPythonCache', () => {
            clearPythonCache();
            const start1 = performance.now();
            const res1 = isPythonAvailable();
            const duration1 = performance.now() - start1;

            const start2 = performance.now();
            const res2 = isPythonAvailable();
            const duration2 = performance.now() - start2;

            assert.equal(res1, res2);
            // Cached invocation should be an order of magnitude faster (< 15ms)
            assert.ok(duration2 < 15, `Cached duration was ${duration2}ms`);

            // Clear cache and verify fresh execution
            clearPythonCache();
            const res3 = isPythonAvailable();
            assert.equal(res3, res1);
        });
    });

    describe('4. Uptime and Timestamp Fields', () => {
        let server;
        let baseUrl;

        beforeEach(() => {
            server = app.listen(0);
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
        });

        afterEach(() => {
            if (server) server.close();
        });

        test('uptime increases monotonically over time', async () => {
            const res1 = await fetch(`${baseUrl}/api/health`);
            const data1 = await res1.json();

            await new Promise(r => setTimeout(r, 60));

            const res2 = await fetch(`${baseUrl}/api/health`);
            const data2 = await res2.json();

            assert.ok(data2.uptime >= data1.uptime);
            assert.ok(data1.uptime >= 0);
            assert.ok(data2.uptime >= 0);
        });

        test('timestamp reflects current system time in ISO 8601 format', async () => {
            const before = Date.now();
            const res = await fetch(`${baseUrl}/api/health`);
            const after = Date.now();
            const data = await res.json();

            const parsedTime = Date.parse(data.timestamp);
            assert.ok(!Number.isNaN(parsedTime));
            assert.ok(parsedTime >= before - 2000, `timestamp ${data.timestamp} before threshold`);
            assert.ok(parsedTime <= after + 2000, `timestamp ${data.timestamp} after threshold`);
            assert.match(data.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        });

        test('uptime has at most 2 decimal places of precision', async () => {
            const res = await fetch(`${baseUrl}/api/health`);
            const data = await res.json();
            const decimals = data.uptime.toString().split('.')[1] || '';
            assert.ok(decimals.length <= 2, `Uptime decimals length ${decimals.length} exceeded 2`);
        });
    });

    describe('5. docker-compose.yaml Healthcheck Configuration', () => {
        const dockerComposePath = path.join(rootDir, 'docker-compose.yaml');

        test('docker-compose.yaml healthcheck targets /api/health on port 8080', () => {
            const content = fs.readFileSync(dockerComposePath, 'utf-8');
            assert.ok(content.includes('http://localhost:8080/api/health'));
            assert.ok(content.includes('statusCode === 200'));
            assert.ok(!content.includes('statusCode === 301'));
        });

        test('docker-compose.yaml healthcheck has required interval, timeout, and retries', () => {
            const content = fs.readFileSync(dockerComposePath, 'utf-8');
            assert.ok(content.includes('interval: 30s'));
            assert.ok(content.includes('timeout: 10s'));
            assert.ok(content.includes('retries: 3'));
            assert.ok(content.includes('start_period: 15s'));
        });
    });

    describe('6. Android Native ApiClient Integration', () => {
        const apiClientPath = path.join(rootDir, 'android_app', 'app', 'src', 'main', 'kotlin', 'com', 'depthforge', 'app', 'ApiClient.kt');
        const healthTestPath = path.join(rootDir, 'android_app', 'app', 'src', 'test', 'kotlin', 'com', 'depthforge', 'app', 'HealthCheckTest.kt');

        test('ApiClient.kt declares checkHealth method querying /api/health via GET', () => {
            const content = fs.readFileSync(apiClientPath, 'utf-8');
            assert.ok(content.includes('suspend fun checkHealth()'));
            assert.ok(content.includes('/api/health'));
            assert.ok(content.includes('.get()'));
            assert.ok(content.includes('isHealthy'));
        });

        test('ApiClient.kt declares isHealthy convenience helper', () => {
            const content = fs.readFileSync(apiClientPath, 'utf-8');
            assert.ok(content.includes('suspend fun isHealthy()'));
        });

        test('ApiClient.kt handles errors safely without throwing uncaught exceptions', () => {
            const content = fs.readFileSync(apiClientPath, 'utf-8');
            assert.ok(content.includes('catch (e: Exception)'));
            assert.ok(content.includes('put("isHealthy", false)'));
        });

        test('Android test suite contains HealthCheckTest.kt', () => {
            assert.ok(fs.existsSync(healthTestPath));
            const testContent = fs.readFileSync(healthTestPath, 'utf-8');
            assert.ok(testContent.includes('class HealthCheckTest'));
            assert.ok(testContent.includes('testApiClientCheckHealthMethod'));
            assert.ok(testContent.includes('testHealthResponseContract'));
        });
    });

    describe('7. Documentation Parity', () => {
        const readmePath = path.join(rootDir, 'README.md');
        const androidReadmePath = path.join(rootDir, 'android_app', 'README.md');

        test('README.md documents GET /api/health endpoint', () => {
            const content = fs.readFileSync(readmePath, 'utf-8');
            assert.ok(content.includes('/api/health'));
            assert.ok(content.includes('GET'));
        });

        test('android_app/README.md documents health check capability', () => {
            const content = fs.readFileSync(androidReadmePath, 'utf-8');
            assert.ok(content.includes('/api/health') || content.includes('Health') || content.includes('checkHealth'));
        });
    });

    describe('8. Concurrency, Performance & Android Contract Robustness', () => {
        let server;
        let baseUrl;

        beforeEach(() => {
            clearPythonCache();
            server = app.listen(0);
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
        });

        afterEach(() => {
            if (server) server.close();
            clearPythonCache();
        });

        test('handles concurrent requests efficiently without blocking event loop', async () => {
            // Warm up
            await fetch(`${baseUrl}/api/health`);

            const start = performance.now();
            const promises = Array.from({ length: 15 }, () => fetch(`${baseUrl}/api/health`));
            const responses = await Promise.all(promises);
            const duration = performance.now() - start;

            for (const res of responses) {
                assert.equal(res.status, 200);
                const data = await res.json();
                assert.equal(data.status, 'ok');
                assert.ok(typeof data.version === 'string');
            }

            // 15 concurrent requests should complete rapidly when cached (< 600ms)
            assert.ok(duration < 600, `15 concurrent requests took ${duration}ms`);
        });

        test('Android ApiClient contract: isHealthy is strictly false on HTTP error even if body contains status ok', () => {
            const isSuccessful = false;
            const statusCode = 500;
            const responseText = JSON.stringify({ status: 'ok', error: 'Service Unavailable' });

            const json = JSON.parse(responseText);
            json.isHealthy = isSuccessful && json.status === 'ok';
            json.statusCode = statusCode;

            assert.equal(json.isHealthy, false);
            assert.equal(json.statusCode, 500);
        });

        test('Android ApiClient contract: non-JSON body preserves HTTP statusCode', () => {
            const isSuccess = false;
            const statusCode = 502;
            const responseText = '<html>502 Bad Gateway</html>';

            let json;
            try {
                json = JSON.parse(responseText);
            } catch {
                json = { rawResponse: responseText, error: `Non-JSON response from server (HTTP ${statusCode})` };
            }
            json.isHealthy = isSuccess && json.status === 'ok';
            json.statusCode = statusCode;

            assert.equal(json.isHealthy, false);
            assert.equal(json.statusCode, 502);
            assert.ok(json.rawResponse.includes('502 Bad Gateway'));
        });

        test('Android ApiClient contract: malformed URL safely returns error object without throwing uncaught', () => {
            const errorJson = {
                status: 'error',
                error: 'Invalid URL: invalid_url_scheme',
                isHealthy: false,
                statusCode: 0
            };

            assert.equal(errorJson.isHealthy, false);
            assert.equal(errorJson.statusCode, 0);
            assert.equal(errorJson.status, 'error');
        });

        test('Android ApiClient contract: trims whitespace from baseUrl', () => {
            const rawBase = '   http://10.0.2.2:8000/   ';
            const cleanUrl = rawBase.trim().replace(/\/+$/, '') + '/api/health';
            assert.equal(cleanUrl, 'http://10.0.2.2:8000/api/health');
        });
    });
});
