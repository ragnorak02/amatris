/* ============================================================
   server.js — Amatris Studio OS server
   Serves the portal UI and provides endpoints for launching
   games, system stats, game management, and Studio OS APIs.

   Usage:  node server.js
   Then open:  http://localhost:3000
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile } = require('child_process');

const PORT = 3000;
const IS_PKG = typeof process.pkg !== 'undefined';
const BASE_DIR = IS_PKG ? path.dirname(process.execPath) : __dirname;
const LAUNCHER_DIR = BASE_DIR;
const GAMES_DIR = BASE_DIR;
const GODOT_EXE = String.raw`C:\Users\nick\Downloads\Godot_v4.6-stable_win64.exe\Godot_v4.6-stable_win64.exe`;
const GODOT_CONSOLE_EXE = String.raw`Z:\Godot\Godot_v4.6-stable_win64_console.exe`;
const SCREENSHOTS_DIR = path.join(GAMES_DIR, 'screenshots');

/* ---- Known game folders (id -> folder name) ---- */
/* Auto-discovered from disk + static fallback. Any subfolder containing
   game.config.json OR claude.md/CLAUDE.md is treated as a game project.
   Non-game folders (.claude, css, js, refImages, scripts, node_modules,
   .git, screenshots) are excluded. */
const NON_GAME_DIRS = new Set([
    '.claude', '.git', 'css', 'js', 'refImages', 'scripts',
    'node_modules', 'screenshots'
]);

function discoverGameFolders() {
    const folders = {};
    try {
        const entries = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            if (NON_GAME_DIRS.has(entry.name)) continue;
            if (entry.name.startsWith('.')) continue;

            const dirPath = path.join(GAMES_DIR, entry.name);
            // Check if it looks like a game folder
            const hasConfig = fs.existsSync(path.join(dirPath, 'game.config.json'));
            const hasClaudeMd = fs.existsSync(path.join(dirPath, 'claude.md'))
                || fs.existsSync(path.join(dirPath, 'CLAUDE.md'));
            const hasProjectGodot = fs.existsSync(path.join(dirPath, 'project.godot'));

            if (hasConfig || hasClaudeMd || hasProjectGodot) {
                // Generate id from folder name: lowercase, spaces to hyphens
                const id = entry.name.toLowerCase().replace(/['\s]+/g, '-').replace(/[^a-z0-9-]/g, '');
                folders[id] = entry.name;
            }
        }
    } catch (e) {
        console.error('[WARN] Could not scan for game folders:', e.message);
    }
    return folders;
}

const GAME_FOLDERS = discoverGameFolders();
console.log(`  Discovered ${Object.keys(GAME_FOLDERS).length} game(s):`, Object.values(GAME_FOLDERS).join(', '));

/* ---- Icon/color fallbacks for games without them in config ---- */
const GAME_ICONS = {
    akma: '\u2694\uFE0F', crystal3d: '\uD83D\uDC8E', finalfantasy3d: '\u2728',
    fishing: '\uD83C\uDFA3', 'hwarangs-path': '\uD83C\uDFF9', kingdomdefense: '\uD83C\uDFF0',
    mechwar: '\uD83E\uDD16', monsterbattle: '\uD83D\uDC7E', pocketdragon: '\uD83D\uDC09',
    smashland: '\uD83D\uDCA5', zelda: '\uD83D\uDDE1\uFE0F',
    lastfantasy: '\u2694\uFE0F', drift: '\uD83C\uDFCE\uFE0F', rythemwar: '\uD83E\uDD41'
};

const GAME_COLORS = {
    akma: '#8b0000', crystal3d: '#4a1a6b', finalfantasy3d: '#1a3a6b',
    fishing: '#1a5a5a', 'hwarangs-path': '#6b3a1a', kingdomdefense: '#2a5a1a',
    mechwar: '#4a4a4a', monsterbattle: '#2c1a4a', pocketdragon: '#8b3a00',
    smashland: '#6b1a3a', zelda: '#2e5930',
    lastfantasy: '#1a1a6b', drift: '#3a3a3a', rythemwar: '#6b1a4a'
};

/* ---- Running game processes (gameId -> child) ---- */
const runningGames = {};

/* ---- MIME types for static file serving ---- */
const MIME = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.wasm': 'application/wasm',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.md': 'text/plain',
    '.gd': 'text/plain',
    '.txt': 'text/plain',
    '.cfg': 'text/plain',
    '.log': 'text/plain',
    '.bat': 'text/plain',
    '.sh': 'text/plain',
    '.mjs': 'application/javascript',
    '.tres': 'text/plain',
    '.tscn': 'text/plain',
    '.gdshader': 'text/plain'
};

/* ---- CPU usage tracking (two-sample delta) ---- */
let prevCpuInfo = null;

function getCpuUsage() {
    const cpus = os.cpus();
    let idle = 0, total = 0;
    cpus.forEach(cpu => {
        for (const type in cpu.times) total += cpu.times[type];
        idle += cpu.times.idle;
    });

    if (!prevCpuInfo) {
        prevCpuInfo = { idle, total };
        return 0;
    }

    const idleDiff = idle - prevCpuInfo.idle;
    const totalDiff = total - prevCpuInfo.total;
    prevCpuInfo = { idle, total };

    return totalDiff > 0 ? Math.round((1 - idleDiff / totalDiff) * 100) : 0;
}

/* ============================================================
   API: GET /api/games — All game metadata, normalized
   ============================================================ */
function getGames(res) {
    const results = [];

    for (const [gameId, folderName] of Object.entries(GAME_FOLDERS)) {
        const folderPath = path.join(GAMES_DIR, folderName);

        // Read game.config.json
        let config = {};
        try {
            const raw = fs.readFileSync(path.join(folderPath, 'game.config.json'), 'utf8');
            config = JSON.parse(raw);
        } catch (e) {
            // No config file — use fallback data
        }

        // Normalize engine info
        let engine = 'Unknown';
        let engineType = 'unknown';
        if (typeof config.engine === 'object' && config.engine.name) {
            engine = config.engine.name + ' ' + (config.engine.version || '');
            engineType = config.engine.name.toLowerCase();
        } else if (typeof config.engine === 'string') {
            engine = config.engine;
            const el = engine.toLowerCase();
            if (el.indexOf('godot') !== -1 || el === 'godot') {
                engineType = 'godot';
                if (config.engineVersion) engine = 'Godot ' + config.engineVersion;
            } else if (el.indexOf('unity') !== -1 || el === 'unity') {
                engineType = 'unity';
                if (config.engineVersion) engine = 'Unity ' + config.engineVersion;
            } else if (el.indexOf('html') !== -1 || el === 'html5') {
                engineType = 'html';
                engine = 'HTML5/JS';
            }
        }

        // Normalize version and progress
        const meta = config.meta || config.metadata || config.extended || {};
        const version = meta.buildVersion || config.version || '0.0.0';
        const completion = meta.progressPercent != null ? meta.progressPercent : 0;
        const phase = meta.currentPhase || (completion > 50 ? 'Development' : completion > 10 ? 'Prototype' : 'Concept');

        // Determine launch type from config or fallback
        let launchType = engineType;
        if (config.launch && config.launch.type) launchType = config.launch.type;
        if (gameId === 'zelda') launchType = 'html';
        if (gameId === 'hwarangs-path') launchType = 'placeholder';

        // Check for claude.md (case-insensitive)
        let claudeMdPath = null;
        if (fs.existsSync(path.join(folderPath, 'claude.md'))) {
            claudeMdPath = folderName + '/claude.md';
        } else if (fs.existsSync(path.join(folderPath, 'CLAUDE.md'))) {
            claudeMdPath = folderName + '/CLAUDE.md';
        }

        // Check other standard files
        const gameDirectionPath = fs.existsSync(path.join(folderPath, 'game_direction.md'))
            ? folderName + '/game_direction.md' : null;
        const achievementsPath = fs.existsSync(path.join(folderPath, 'achievements.json'))
            ? folderName + '/achievements.json' : null;
        const testsDir = fs.existsSync(path.join(folderPath, 'tests'))
            ? folderName + '/tests/' : null;

        // Discover test runner script
        let hasTestRunner = false;
        const testFiles = ['tests/run-tests.bat', 'tests/run-tests.sh', 'tests/run-tests.mjs', 'tests/run-tests.gd'];
        for (const tf of testFiles) {
            if (fs.existsSync(path.join(folderPath, tf))) {
                hasTestRunner = true;
                break;
            }
        }

        // Tags from config features or meta
        let tags = [];
        if (config.features && Array.isArray(config.features)) {
            tags = config.features.slice(0, 3);
        } else if (meta.features && Array.isArray(meta.features)) {
            tags = meta.features.slice(0, 3).map(f => f.length > 30 ? f.substring(0, 30) : f);
        }
        if (tags.length === 0) {
            // Generate tags from genre
            if (config.genre) tags = config.genre.split(/[,\/]/).map(t => t.trim()).slice(0, 3);
        }

        // Read completion from claude.md checkboxes if we have no progressPercent
        let liveCompletion = completion;
        if (claudeMdPath) {
            try {
                const mdContent = fs.readFileSync(path.join(GAMES_DIR, claudeMdPath), 'utf8');
                const checked = (mdContent.match(/- \[x\]/gi) || []).length;
                const total = (mdContent.match(/- \[[ x]\]/gi) || []).length;
                if (total > 0) {
                    const mdPct = Math.round((checked / total) * 100);
                    // Use claude.md completion if config doesn't have explicit progressPercent
                    if (meta.progressPercent == null) liveCompletion = mdPct;
                }
            } catch (e) { /* ignore */ }
        }

        results.push({
            id: gameId,
            name: config.title || config.name || folderName,
            folder: folderName,
            engine: engine,
            engineType: engineType,
            genre: config.genre || 'Unknown',
            phase: phase,
            version: version,
            completion: liveCompletion,
            status: gameId === 'hwarangs-path' ? 'placeholder' : 'active',
            icon: GAME_ICONS[gameId] || '\uD83C\uDFAE',
            color: GAME_COLORS[gameId] || '#333333',
            tags: tags,
            hasTestRunner: hasTestRunner,
            health: {
                tests: { status: hasTestRunner ? 'gray' : 'gray', total: 0, passed: 0, lastRun: null },
                build: 'unknown',
                lastCommit: meta.lastGameplayUpdate || null
            },
            files: {
                claudeMd: claudeMdPath,
                gameDirection: gameDirectionPath,
                tests: testsDir,
                achievements: achievementsPath
            },
            launch: {
                type: launchType,
                projectDir: folderName
            }
        });
    }

    jsonResponse(res, 200, results);
}

/* ============================================================
   API: GET /api/file?path=... — Safe file content for preview
   ============================================================ */
function getFile(res, filePath) {
    if (!filePath) {
        jsonResponse(res, 400, { error: 'Missing path parameter' });
        return;
    }

    // Security: reject path traversal
    const normalized = path.normalize(filePath).replace(/\\/g, '/');
    if (normalized.indexOf('..') !== -1) {
        jsonResponse(res, 403, { error: 'Path traversal not allowed' });
        return;
    }

    const fullPath = path.join(GAMES_DIR, normalized);

    // Ensure the file is within GAMES_DIR
    if (!fullPath.startsWith(GAMES_DIR)) {
        jsonResponse(res, 403, { error: 'Access denied' });
        return;
    }

    fs.stat(fullPath, (err, stats) => {
        if (err || !stats.isFile()) {
            jsonResponse(res, 404, { error: 'File not found' });
            return;
        }

        // Limit file size to 500KB for preview
        if (stats.size > 512000) {
            jsonResponse(res, 413, { error: 'File too large for preview (max 500KB)' });
            return;
        }

        fs.readFile(fullPath, 'utf8', (err2, content) => {
            if (err2) {
                jsonResponse(res, 500, { error: 'Failed to read file' });
                return;
            }

            const ext = path.extname(fullPath).toLowerCase();
            jsonResponse(res, 200, {
                path: normalized,
                name: path.basename(fullPath),
                ext: ext,
                size: stats.size,
                modified: stats.mtime.toISOString(),
                content: content
            });
        });
    });
}

/* ============================================================
   API: POST /api/tests/:gameId — Run tests for one game
   ============================================================ */
function runTests(gameId, res) {
    const folderName = GAME_FOLDERS[gameId];
    if (!folderName) {
        jsonResponse(res, 404, { error: `Unknown game: ${gameId}` });
        return;
    }

    const folderPath = path.join(GAMES_DIR, folderName);

    // Discover test runner
    const testCandidates = [
        { file: 'tests/run-tests.bat', type: 'bat' },
        { file: 'tests/run-tests.sh', type: 'sh' },
        { file: 'tests/run-tests.mjs', type: 'node' },
        { file: 'tests/run-tests.gd', type: 'godot' }
    ];

    let testRunner = null;
    for (const candidate of testCandidates) {
        if (fs.existsSync(path.join(folderPath, candidate.file))) {
            testRunner = candidate;
            break;
        }
    }

    if (!testRunner) {
        jsonResponse(res, 404, { error: `No test runner found for ${gameId}` });
        return;
    }

    // Build command
    let cmd;
    const testPath = path.join(folderPath, testRunner.file);

    switch (testRunner.type) {
        case 'bat':
            cmd = `"${testPath}"`;
            break;
        case 'sh':
            cmd = `bash "${testPath}"`;
            break;
        case 'node':
            cmd = `node "${testPath}"`;
            break;
        case 'godot':
            // Support projectSubdir for games with Godot project in a subdirectory
            let godotTestDir = folderPath;
            try {
                const tc = JSON.parse(fs.readFileSync(path.join(folderPath, 'game.config.json'), 'utf8'));
                if (tc.launch && tc.launch.projectSubdir) godotTestDir = path.join(folderPath, tc.launch.projectSubdir);
            } catch (e) { /* use default */ }
            cmd = `"${GODOT_CONSOLE_EXE}" --headless --path "${godotTestDir}" --script ${testRunner.file}`;
            break;
    }

    console.log(`[TEST] Running: ${cmd}`);

    exec(cmd, { cwd: folderPath, timeout: 60000 }, (err, stdout, stderr) => {
        // Try to parse JSON from stdout
        let result = null;
        try {
            // Find JSON in output (may have non-JSON lines before/after)
            const jsonMatch = stdout.match(/\{[\s\S]*"gameId"[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            }
        } catch (e) { /* not valid JSON */ }

        if (!result) {
            // Build a basic result from exit code
            result = {
                gameId: gameId,
                status: err ? 'error' : 'pass',
                testsTotal: 0,
                testsPassed: 0,
                testsFailed: 0,
                durationMs: 0,
                timestamp: new Date().toISOString(),
                details: [],
                rawOutput: (stdout + '\n' + stderr).trim().substring(0, 5000)
            };
        }

        jsonResponse(res, 200, result);
    });
}

/* ============================================================
   API: POST /api/tests/run-all — Run all game tests sequentially
   ============================================================ */
function runAllTests(res) {
    const gameIds = Object.keys(GAME_FOLDERS);
    const results = [];
    let idx = 0;

    function runNext() {
        if (idx >= gameIds.length) {
            jsonResponse(res, 200, { results: results });
            return;
        }

        const gameId = gameIds[idx++];
        const folderName = GAME_FOLDERS[gameId];
        const folderPath = path.join(GAMES_DIR, folderName);

        // Check for test runner
        const testCandidates = ['tests/run-tests.bat', 'tests/run-tests.sh', 'tests/run-tests.mjs', 'tests/run-tests.gd'];
        let hasRunner = false;
        for (const tf of testCandidates) {
            if (fs.existsSync(path.join(folderPath, tf))) {
                hasRunner = true;
                break;
            }
        }

        if (!hasRunner) {
            results.push({ gameId: gameId, status: 'skipped', message: 'No test runner' });
            runNext();
            return;
        }

        // Use a mini request to runTests (inline version)
        const fakeRes = {
            statusCode: 200,
            headers: {},
            body: '',
            writeHead(code, h) { this.statusCode = code; this.headers = h || {}; },
            end(data) {
                try {
                    results.push(JSON.parse(data));
                } catch (e) {
                    results.push({ gameId: gameId, status: 'error', message: 'Parse error' });
                }
                runNext();
            }
        };

        runTests(gameId, fakeRes);
    }

    runNext();
}

/* ============================================================
   API: GET /api/running — Which games are currently running
   ============================================================ */
function getRunning(res) {
    const running = {};
    for (const [gameId, child] of Object.entries(runningGames)) {
        let alive = false;
        try {
            process.kill(child.pid, 0);
            alive = true;
        } catch (e) {
            // Process is dead, clean up
            delete runningGames[gameId];
        }
        if (alive) {
            running[gameId] = { pid: child.pid };
        }
    }
    jsonResponse(res, 200, running);
}

/* ============================================================
   LAUNCH — Dynamic config lookup from game.config.json
   ============================================================ */
function launchGame(gameId, res) {
    const folderName = GAME_FOLDERS[gameId];
    if (!folderName) {
        jsonResponse(res, 404, { error: `Unknown game: ${gameId}` });
        return;
    }

    const folderPath = path.join(GAMES_DIR, folderName);

    // Read game.config.json for launch info
    let config = {};
    try {
        config = JSON.parse(fs.readFileSync(path.join(folderPath, 'game.config.json'), 'utf8'));
    } catch (e) { /* use fallback */ }

    // Determine engine type
    let engineType = 'unknown';
    if (typeof config.engine === 'object' && config.engine.name) {
        engineType = config.engine.name.toLowerCase();
    } else if (typeof config.engine === 'string') {
        const el = config.engine.toLowerCase();
        if (el.indexOf('godot') !== -1 || el === 'godot') engineType = 'godot';
        else if (el.indexOf('unity') !== -1 || el === 'unity') engineType = 'unity';
        else if (el.indexOf('html') !== -1 || el === 'html5') engineType = 'html';
    }

    // Override for specific games
    if (gameId === 'zelda') engineType = 'html';
    if (gameId === 'hwarangs-path') engineType = 'unity';

    // Placeholder (Unity)
    if (engineType === 'unity') {
        jsonResponse(res, 200, { status: 'placeholder', message: `${config.title || gameId} requires manual launch (Unity project).` });
        return;
    }

    // HTML embed
    if (engineType === 'html') {
        const embedUrl = '/' + folderName + '/index.html';
        console.log(`[EMBED] ${gameId} -> ${embedUrl}`);
        jsonResponse(res, 200, { status: 'embed', game: gameId, type: 'html', embedUrl: embedUrl });
        return;
    }

    // Godot launch
    if (engineType === 'godot') {
        // Support projectSubdir for games with Godot project in a subdirectory
        const projectDir = (config.launch && config.launch.projectSubdir)
            ? path.join(folderPath, config.launch.projectSubdir)
            : folderPath;
        const cmd = `"${GODOT_EXE}" --path "${projectDir}"`;
        console.log(`[LAUNCH] ${cmd}`);

        const child = exec(cmd, (err) => {
            if (err) console.error(`[ERROR] ${gameId}:`, err.message);
            delete runningGames[gameId];
        });
        runningGames[gameId] = child;
        child.unref();

        jsonResponse(res, 200, { status: 'launched', game: gameId, type: 'godot' });
        return;
    }

    jsonResponse(res, 400, { error: `Unknown engine type for ${gameId}` });
}

/* ---- Close a running game ---- */
function closeGame(gameId, res) {
    const child = runningGames[gameId];
    if (child) {
        try {
            exec(`taskkill /pid ${child.pid} /T /F`, () => {});
        } catch (e) { /* ignore */ }
        delete runningGames[gameId];
    }

    jsonResponse(res, 200, { status: 'closed', game: gameId });
}

/* ---- System stats ---- */
function getSystemStats(res) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    jsonResponse(res, 200, {
        cpu: getCpuUsage(),
        ramUsed: Math.round(usedMem / 1024 / 1024),
        ramTotal: Math.round(totalMem / 1024 / 1024)
    });
}

/* ---- Open screenshots folder ---- */
function openScreenshotsFolder(res) {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    exec(`start "" "${SCREENSHOTS_DIR}"`, (err) => {
        if (err) console.error('[ERROR] open folder:', err.message);
    });

    jsonResponse(res, 200, { status: 'opened', path: SCREENSHOTS_DIR });
}

/* ---- JSON response helper ---- */
function jsonResponse(res, code, data) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

/* ---- Read POST body helper ---- */
function readBody(req, callback) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => callback(body));
}

/* ============================================================
   HTTP Server
   ============================================================ */
const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const pathname = url.pathname;
    const method = req.method;

    // ---- Studio OS APIs ----

    // GET /api/games
    if (pathname === '/api/games' && method === 'GET') {
        getGames(res);
        return;
    }

    // GET /api/file?path=...
    if (pathname === '/api/file' && method === 'GET') {
        const filePath = url.searchParams.get('path');
        getFile(res, filePath);
        return;
    }

    // POST /api/tests/run-all
    if (pathname === '/api/tests/run-all' && method === 'POST') {
        runAllTests(res);
        return;
    }

    // POST /api/tests/:gameId
    const testMatch = pathname.match(/^\/api\/tests\/([a-z0-9_-]+)$/i);
    if (testMatch && method === 'POST') {
        const gameId = testMatch[1].toLowerCase();
        runTests(gameId, res);
        return;
    }

    // GET /api/running
    if (pathname === '/api/running' && method === 'GET') {
        getRunning(res);
        return;
    }

    // ---- Legacy APIs ----

    // API: launch game
    const launchMatch = pathname.match(/^\/launch\/([a-z0-9_-]+)$/i);
    if (launchMatch) {
        const gameId = launchMatch[1].toLowerCase();
        launchGame(gameId, res);
        return;
    }

    // API: close game
    const closeMatch = pathname.match(/^\/close-game\/([a-z0-9_-]+)$/i);
    if (closeMatch) {
        const gameId = closeMatch[1].toLowerCase();
        closeGame(gameId, res);
        return;
    }

    // API: system stats
    if (pathname === '/system-stats') {
        getSystemStats(res);
        return;
    }

    // API: open screenshots folder
    if (pathname === '/open-folder/screenshots') {
        openScreenshotsFolder(res);
        return;
    }

    // Static file serving — try launcher dir first, then games dir (for game assets)
    const decodedPath = decodeURIComponent(pathname);
    const requestedFile = decodedPath === '/' ? 'index.html' : decodedPath;
    let filePath = path.join(LAUNCHER_DIR, requestedFile);
    const ext = path.extname(filePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // Fall back to games directory (e.g. zelda/ iframe assets)
            const gamePath = path.join(GAMES_DIR, requestedFile);
            fs.readFile(gamePath, (err2, data2) => {
                if (err2) {
                    res.writeHead(404);
                    res.end('Not found');
                    return;
                }
                res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
                res.end(data2);
            });
            return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  \uD83C\uDF19 Amatris running at http://localhost:${PORT}\n`);
    if (IS_PKG) {
        exec(`start http://localhost:${PORT}`);
    }
});
