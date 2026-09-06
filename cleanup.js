import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_TTL_HOURS = 24;
export const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export const defaultGeneratedDir = path.join(__dirname, 'static', 'generated');

/**
 * Robustly checks if a module file URL is the directly executed entrypoint.
 * Resolves Windows NTFS junctions, symlinks, and normalizes casing.
 *
 * @param {string} metaUrl
 * @returns {boolean}
 */
export function isMainModule(metaUrl) {
    if (!process.argv || !process.argv[1]) return false;
    try {
        const scriptArg = path.resolve(process.argv[1]);
        const moduleFile = fileURLToPath(metaUrl);

        if (scriptArg.toLowerCase() === moduleFile.toLowerCase()) {
            return true;
        }

        const realScript = fs.realpathSync(scriptArg);
        const realModule = fs.realpathSync(moduleFile);
        return realScript.toLowerCase() === realModule.toLowerCase();
    } catch {
        try {
            return path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(metaUrl).toLowerCase();
        } catch {
            return false;
        }
    }
}

/**
 * Sanitizes and validates the TTL hours value.
 * Falls back to DEFAULT_TTL_HOURS (24) when undefined, null, non-numeric, zero, negative, or non-finite.
 *
 * @param {any} ttl
 * @returns {number}
 */
export function parseTtlHours(ttl) {
    if (ttl === undefined || ttl === null) {
        return DEFAULT_TTL_HOURS;
    }
    if (typeof ttl === 'string' && ttl.trim() === '') {
        return DEFAULT_TTL_HOURS;
    }
    if (typeof ttl === 'boolean' || typeof ttl === 'symbol') {
        return DEFAULT_TTL_HOURS;
    }
    if (typeof ttl !== 'number' && typeof ttl !== 'string') {
        return DEFAULT_TTL_HOURS;
    }
    const parsed = Number(ttl);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_TTL_HOURS;
    }
    return parsed;
}

/**
 * Formats a directory path cleanly for log output (e.g. 'static/generated').
 *
 * @param {string} dir
 * @returns {string}
 */
export function formatDirForLog(dir) {
    if (!dir) {
        return 'static/generated';
    }
    let dirStr = '';
    if (dir instanceof URL) {
        try {
            dirStr = fileURLToPath(dir);
        } catch {
            dirStr = String(dir);
        }
    } else if (typeof dir === 'string') {
        dirStr = dir;
    } else {
        return 'static/generated';
    }
    try {
        const normalized = dirStr.replace(/\\/g, '/');
        const cwd = process.cwd();
        const rel = path.relative(cwd, dirStr).replace(/\\/g, '/');
        if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) {
            return rel;
        }
        try {
            const realCwd = fs.realpathSync(cwd);
            const relReal = path.relative(realCwd, dirStr).replace(/\\/g, '/');
            if (relReal && !relReal.startsWith('..') && !path.isAbsolute(relReal)) {
                return relReal;
            }
        } catch {}
        const genIdx = normalized.lastIndexOf('static/generated');
        if (genIdx !== -1) {
            return normalized.substring(genIdx);
        }
        return normalized;
    } catch {
        return dirStr.replace(/\\/g, '/');
    }
}

/**
 * Asynchronously inspects the target directory and removes files older than ttlHours.
 *
 * @param {Object} [options]
 * @param {string} [options.dir] - Target directory to clean (defaults to static/generated)
 * @param {number|string} [options.ttlHours] - Time-to-live in hours (defaults to env or 24)
 * @param {number} [options.now] - Current timestamp in ms (defaults to Date.now())
 * @param {boolean} [options.log] - Whether to log execution to stdout (defaults to true)
 * @returns {Promise<{scanned: number, removed: number, preserved: number, errors: Array, ttlHours: number, cutoffTime: Date}>}
 */
export async function cleanupGeneratedFiles({
    dir = defaultGeneratedDir,
    ttlHours,
    now = Date.now(),
    log = true
} = {}) {
    let targetDir;
    if (typeof dir === 'string' && dir.trim() !== '') {
        targetDir = dir;
    } else if (dir instanceof URL) {
        try {
            targetDir = fileURLToPath(dir);
        } catch {
            targetDir = defaultGeneratedDir;
        }
    } else {
        targetDir = defaultGeneratedDir;
    }

    const rawTtl = (ttlHours !== undefined) ? ttlHours : process.env.GENERATED_TTL_HOURS;
    const effectiveTtl = parseTtlHours(rawTtl);
    let effectiveNow = Date.now();
    if (typeof now === 'number' && Number.isFinite(now) && now > 0) {
        effectiveNow = now;
    } else if (now instanceof Date && !Number.isNaN(now.getTime()) && now.getTime() > 0) {
        effectiveNow = now.getTime();
    }
    const displayDir = formatDirForLog(targetDir);
    const ttlMs = effectiveTtl * 60 * 60 * 1000;
    const cutoffMs = effectiveNow - ttlMs;
    const cutoffTime = new Date(cutoffMs);

    // Verify directory exists and is actually a directory
    let isDir = false;
    try {
        const dirStat = await fs.promises.stat(targetDir);
        isDir = dirStat.isDirectory();
    } catch {
        // Missing directory or inaccessible
    }

    if (!isDir) {
        if (log) {
            console.log(`[Cleanup] Scanned ${displayDir} - removed 0 expired files older than ${effectiveTtl}h`);
        }
        return {
            scanned: 0,
            removed: 0,
            preserved: 0,
            errors: [],
            ttlHours: effectiveTtl,
            cutoffTime
        };
    }

    let entries = [];
    try {
        entries = await fs.promises.readdir(targetDir, { withFileTypes: true });
    } catch (readErr) {
        if (log) {
            console.warn(`[Cleanup] Warning: Could not read directory ${displayDir}: ${readErr.message}`);
            console.log(`[Cleanup] Scanned ${displayDir} - removed 0 expired files older than ${effectiveTtl}h`);
        }
        return {
            scanned: 0,
            removed: 0,
            preserved: 0,
            errors: [{ file: targetDir, path: targetDir, error: readErr }],
            ttlHours: effectiveTtl,
            cutoffTime
        };
    }

    let scanned = 0;
    let removed = 0;
    let preserved = 0;
    const errors = [];

    for (const entry of entries) {
        // Ignore non-file system artifacts (directories, special sockets, FIFOs, etc.)
        if (entry.isDirectory() || !entry.isFile()) {
            continue;
        }

        const filePath = path.join(targetDir, entry.name);

        let stat;
        try {
            stat = await fs.promises.stat(filePath);
        } catch (statErr) {
            scanned++;
            errors.push({ file: entry.name, path: filePath, error: statErr });
            continue;
        }

        if (!stat.isFile()) {
            continue;
        }

        scanned++;
        const mtimeMs = typeof stat.mtimeMs === 'number' && !Number.isNaN(stat.mtimeMs)
            ? stat.mtimeMs
            : (stat.mtime instanceof Date ? stat.mtime.getTime() : 0);

        // Files strictly older than the TTL window are removed
        if (mtimeMs < cutoffMs) {
            try {
                await fs.promises.unlink(filePath);
                removed++;
            } catch (unlinkErr) {
                // Locked files, permission issues, or concurrency conflicts
                errors.push({ file: entry.name, path: filePath, error: unlinkErr });
                if (log) {
                    console.warn(`[Cleanup] Warning: Failed to remove ${entry.name}: ${unlinkErr.message}`);
                }
            }
        } else {
            // Files within the TTL window are strictly preserved
            preserved++;
        }
    }

    if (log) {
        console.log(`[Cleanup] Scanned ${displayDir} - removed ${removed} expired files older than ${effectiveTtl}h`);
    }

    return {
        scanned,
        removed,
        preserved,
        errors,
        ttlHours: effectiveTtl,
        cutoffTime
    };
}

/**
 * Synchronous equivalent of cleanupGeneratedFiles.
 *
 * @param {Object} [options]
 * @returns {{scanned: number, removed: number, preserved: number, errors: Array, ttlHours: number, cutoffTime: Date}}
 */
export function cleanupGeneratedFilesSync({
    dir = defaultGeneratedDir,
    ttlHours,
    now = Date.now(),
    log = true
} = {}) {
    let targetDir;
    if (typeof dir === 'string' && dir.trim() !== '') {
        targetDir = dir;
    } else if (dir instanceof URL) {
        try {
            targetDir = fileURLToPath(dir);
        } catch {
            targetDir = defaultGeneratedDir;
        }
    } else {
        targetDir = defaultGeneratedDir;
    }

    const rawTtl = (ttlHours !== undefined) ? ttlHours : process.env.GENERATED_TTL_HOURS;
    const effectiveTtl = parseTtlHours(rawTtl);
    let effectiveNow = Date.now();
    if (typeof now === 'number' && Number.isFinite(now) && now > 0) {
        effectiveNow = now;
    } else if (now instanceof Date && !Number.isNaN(now.getTime()) && now.getTime() > 0) {
        effectiveNow = now.getTime();
    }
    const displayDir = formatDirForLog(targetDir);
    const ttlMs = effectiveTtl * 60 * 60 * 1000;
    const cutoffMs = effectiveNow - ttlMs;
    const cutoffTime = new Date(cutoffMs);

    let isDir = false;
    try {
        const dirStat = fs.statSync(targetDir);
        isDir = dirStat.isDirectory();
    } catch {
        // Missing directory or inaccessible
    }

    if (!isDir) {
        if (log) {
            console.log(`[Cleanup] Scanned ${displayDir} - removed 0 expired files older than ${effectiveTtl}h`);
        }
        return {
            scanned: 0,
            removed: 0,
            preserved: 0,
            errors: [],
            ttlHours: effectiveTtl,
            cutoffTime
        };
    }

    let entries = [];
    try {
        entries = fs.readdirSync(targetDir, { withFileTypes: true });
    } catch (readErr) {
        if (log) {
            console.warn(`[Cleanup] Warning: Could not read directory ${displayDir}: ${readErr.message}`);
            console.log(`[Cleanup] Scanned ${displayDir} - removed 0 expired files older than ${effectiveTtl}h`);
        }
        return {
            scanned: 0,
            removed: 0,
            preserved: 0,
            errors: [{ file: targetDir, path: targetDir, error: readErr }],
            ttlHours: effectiveTtl,
            cutoffTime
        };
    }

    let scanned = 0;
    let removed = 0;
    let preserved = 0;
    const errors = [];

    for (const entry of entries) {
        if (entry.isDirectory() || !entry.isFile()) {
            continue;
        }

        const filePath = path.join(targetDir, entry.name);

        let stat;
        try {
            stat = fs.statSync(filePath);
        } catch (statErr) {
            scanned++;
            errors.push({ file: entry.name, path: filePath, error: statErr });
            continue;
        }

        if (!stat.isFile()) {
            continue;
        }

        scanned++;
        const mtimeMs = typeof stat.mtimeMs === 'number' && !Number.isNaN(stat.mtimeMs)
            ? stat.mtimeMs
            : (stat.mtime instanceof Date ? stat.mtime.getTime() : 0);

        if (mtimeMs < cutoffMs) {
            try {
                fs.unlinkSync(filePath);
                removed++;
            } catch (unlinkErr) {
                errors.push({ file: entry.name, path: filePath, error: unlinkErr });
                if (log) {
                    console.warn(`[Cleanup] Warning: Failed to remove ${entry.name}: ${unlinkErr.message}`);
                }
            }
        } else {
            preserved++;
        }
    }

    if (log) {
        console.log(`[Cleanup] Scanned ${displayDir} - removed ${removed} expired files older than ${effectiveTtl}h`);
    }

    return {
        scanned,
        removed,
        preserved,
        errors,
        ttlHours: effectiveTtl,
        cutoffTime
    };
}

/**
 * Starts periodic cleanup schedule (defaulting to every hour).
 * Invokes cleanup immediately if runImmediately is true.
 *
 * @param {Object} [options]
 * @param {string} [options.dir]
 * @param {number|string} [options.ttlHours]
 * @param {number} [options.intervalMs] - Periodic interval in ms (default 1 hour)
 * @param {boolean} [options.runImmediately] - Whether to run immediately on start (default true)
 * @param {boolean} [options.log] - Whether to log to stdout (default true)
 * @returns {{timer: NodeJS.Timeout, stop: Function}}
 */
export function startCleanupScheduler({
    dir = defaultGeneratedDir,
    ttlHours,
    intervalMs = CLEANUP_INTERVAL_MS,
    runImmediately = true,
    log = true
} = {}) {
    const effectiveInterval = (typeof intervalMs === 'number' && Number.isFinite(intervalMs) && intervalMs > 0)
        ? intervalMs
        : CLEANUP_INTERVAL_MS;

    let isRunning = false;
    let isStopped = false;
    let currentTaskPromise = null;

    const runTask = async () => {
        if (isStopped || isRunning) return;
        isRunning = true;
        try {
            const currentTtl = (ttlHours !== undefined) ? ttlHours : process.env.GENERATED_TTL_HOURS;
            currentTaskPromise = cleanupGeneratedFiles({ dir, ttlHours: currentTtl, log });
            await currentTaskPromise;
        } catch (err) {
            console.error('[Cleanup] Error during scheduled cleanup:', err);
        } finally {
            currentTaskPromise = null;
            isRunning = false;
        }
    };

    if (runImmediately) {
        runTask();
    }

    const timer = setInterval(runTask, effectiveInterval);
    if (timer && typeof timer.unref === 'function') {
        timer.unref();
    }

    return {
        timer,
        get isRunning() {
            return isRunning;
        },
        get isStopped() {
            return isStopped;
        },
        async stop() {
            isStopped = true;
            clearInterval(timer);
            if (currentTaskPromise) {
                await currentTaskPromise.catch(() => {});
            }
        }
    };
}

/**
 * Stops a cleanup scheduler timer or scheduler instance.
 *
 * @param {Object|NodeJS.Timeout} schedulerOrTimer
 */
export async function stopCleanupScheduler(schedulerOrTimer) {
    if (!schedulerOrTimer) return;
    if (typeof schedulerOrTimer.stop === 'function') {
        await schedulerOrTimer.stop();
    } else if (typeof schedulerOrTimer === 'object' && schedulerOrTimer.timer) {
        clearInterval(schedulerOrTimer.timer);
    } else {
        clearInterval(schedulerOrTimer);
    }
}

// Support direct execution via node cleanup.js
const isDirectRun = isMainModule(import.meta.url);
if (isDirectRun) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        console.log('Usage: node cleanup.js [directory] [ttlHours]');
        console.log('       node cleanup.js [--dir <directory>] [--ttl <ttlHours>]');
        console.log('  directory, -d, --dir: Target directory to scan (default: static/generated)');
        console.log('  ttlHours,  -t, --ttl: Expiration window in hours (default: $GENERATED_TTL_HOURS or 24)');
        process.exit(0);
    }
    let targetDir = defaultGeneratedDir;
    let targetTtl = process.env.GENERATED_TTL_HOURS;

    const args = process.argv.slice(2);
    const positional = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--dir' || arg === '-d') {
            targetDir = args[++i];
        } else if (arg.startsWith('--dir=')) {
            targetDir = arg.slice('--dir='.length);
        } else if (arg === '--ttl' || arg === '-t') {
            targetTtl = args[++i];
        } else if (arg.startsWith('--ttl=')) {
            targetTtl = arg.slice('--ttl='.length);
        } else if (!arg.startsWith('-')) {
            positional.push(arg);
        }
    }
    if (positional.length > 0) {
        targetDir = positional[0];
    }
    if (positional.length > 1) {
        targetTtl = positional[1];
    }

    cleanupGeneratedFiles({ dir: targetDir, ttlHours: targetTtl }).catch((err) => {
        console.error('[Cleanup] Fatal error:', err);
        process.exit(1);
    });
}
