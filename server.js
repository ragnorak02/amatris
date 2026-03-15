/* ============================================================
   server.js — LUMINA Studio OS server
   Serves the portal UI and provides endpoints for launching
   games, system stats, game management, and Studio OS APIs.

   Usage:  node server.js
   Then open:  http://localhost:3001
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, execFile, execSync } = require('child_process');
const assetSync = require('./scripts/asset_sync.js');
const assetScanner = require('./scanners/asset_scanner.js');

const PORT = 3001;
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
    'node_modules', 'screenshots', 'docs', 'shared_assets', 'game assets',
    'indexes', 'scanners', 'assets'
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

/* ---- Discover art assets for a game folder ---- */
const ART_EXTS = new Set(['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp']);

function discoverGameArt(folderPath, folderName, config) {
    try {
        var thumbnail = null;
        var gallery = [];

        // Thumbnail priority
        // 1. game.config.json → thumbnail field
        if (config && config.thumbnail) {
            var cfgThumb = path.join(folderPath, config.thumbnail);
            if (fs.existsSync(cfgThumb)) thumbnail = folderName + '/' + config.thumbnail;
        }
        // 2. assets/sprites/ui/icon.png
        if (!thumbnail && fs.existsSync(path.join(folderPath, 'assets', 'sprites', 'ui', 'icon.png'))) {
            thumbnail = folderName + '/assets/sprites/ui/icon.png';
        }
        // 3. icon.png (game root)
        if (!thumbnail && fs.existsSync(path.join(folderPath, 'icon.png'))) {
            thumbnail = folderName + '/icon.png';
        }
        // 4. icon.svg (game root)
        if (!thumbnail && fs.existsSync(path.join(folderPath, 'icon.svg'))) {
            thumbnail = folderName + '/icon.svg';
        }
        // 5. {projectSubdir}/icon.svg (drift pattern)
        if (!thumbnail && config && config.launch && config.launch.projectSubdir) {
            var subIcon = path.join(folderPath, config.launch.projectSubdir, 'icon.svg');
            if (fs.existsSync(subIcon)) {
                thumbnail = folderName + '/' + config.launch.projectSubdir + '/icon.svg';
            }
        }

        // Collect gallery images (refImages/, root PNGs, aiReferenceMaterial/)
        var seen = new Set();
        function addImage(relPath) {
            if (gallery.length >= 8) return;
            if (seen.has(relPath)) return;
            seen.add(relPath);
            gallery.push(relPath);
        }

        // refImages/
        var refDir = path.join(folderPath, 'refImages');
        try {
            var refEntries = fs.readdirSync(refDir);
            refEntries.forEach(function(f) {
                var ext = path.extname(f).toLowerCase();
                if (ART_EXTS.has(ext) && !f.endsWith('.import')) {
                    addImage(folderName + '/refImages/' + f);
                }
            });
        } catch (e) { /* no refImages */ }

        // Root-level PNGs/images
        try {
            var rootEntries = fs.readdirSync(folderPath);
            rootEntries.forEach(function(f) {
                var ext = path.extname(f).toLowerCase();
                if (ART_EXTS.has(ext) && !f.endsWith('.import') && f !== 'icon.png' && f !== 'icon.svg') {
                    addImage(folderName + '/' + f);
                }
            });
        } catch (e) { /* skip */ }

        // aiReferenceMaterial/
        var aiDir = path.join(folderPath, 'aiReferenceMaterial');
        try {
            var aiEntries = fs.readdirSync(aiDir);
            aiEntries.forEach(function(f) {
                var ext = path.extname(f).toLowerCase();
                if (ART_EXTS.has(ext) && !f.endsWith('.import')) {
                    addImage(folderName + '/aiReferenceMaterial/' + f);
                }
            });
        } catch (e) { /* no aiReferenceMaterial */ }

        // 6. First refImage as thumbnail fallback
        if (!thumbnail && gallery.length > 0) {
            thumbnail = gallery[0];
        }
        // 7. First root-level PNG as thumbnail fallback
        if (!thumbnail) {
            try {
                var rootFiles = fs.readdirSync(folderPath);
                for (var i = 0; i < rootFiles.length; i++) {
                    if (rootFiles[i].toLowerCase().endsWith('.png')) {
                        thumbnail = folderName + '/' + rootFiles[i];
                        break;
                    }
                }
            } catch (e) { /* skip */ }
        }

        return { thumbnail: thumbnail, gallery: gallery };
    } catch (e) {
        return { thumbnail: null, gallery: [] };
    }
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
    '.gdshader': 'text/plain',
    '.webp': 'image/webp',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json'
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

        // Read project_status.json (structured portfolio metadata)
        let projectStatus = null;
        try {
            const statusRaw = fs.readFileSync(path.join(folderPath, 'project_status.json'), 'utf8');
            projectStatus = JSON.parse(statusRaw);
        } catch (e) { /* No project_status.json */ }

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
            if (config.genre) {
                if (Array.isArray(config.genre)) {
                    tags = config.genre.slice(0, 3);
                } else {
                    tags = config.genre.split(/[,\/]/).map(t => t.trim()).slice(0, 3);
                }
            }
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

        // ---- Dashboard: Compliance file checks (8 standard files) ----
        const complianceMap = {
            'CLAUDE.md': !!claudeMdPath,
            'game_direction.md': !!gameDirectionPath,
            'test_plan.md': fs.existsSync(path.join(folderPath, 'test_plan.md')),
            'status.html': fs.existsSync(path.join(folderPath, 'status.html')),
            'game.config.json': fs.existsSync(path.join(folderPath, 'game.config.json')),
            'project_status.json': !!projectStatus,
            'achievements.json': !!achievementsPath,
            'achievements_integration.md': fs.existsSync(path.join(folderPath, 'achievements_integration.md'))
        };
        const dashMissing = Object.keys(complianceMap).filter(k => !complianceMap[k]);
        const complianceScore = 8 - dashMissing.length;

        // ---- Dashboard: Date tracking via recursive mtime scan ----
        const codeExts = new Set(['.gd', '.js', '.cs', '.tscn', '.tres', '.gdshader']);
        const skipDirs = new Set(['.git', '.godot', '.claude', 'node_modules', '.import', 'addons']);
        const projSub = (config.launch && config.launch.projectSubdir) || '';
        const scanRoot = projSub ? path.join(folderPath, projSub) : folderPath;
        let lastCodeMtime = 0;
        let lastCodeFile = null;
        const walkForMtime = (dir, depth) => {
            if (depth > 4) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const de of entries) {
                    if (de.isDirectory()) {
                        if (!skipDirs.has(de.name)) walkForMtime(path.join(dir, de.name), depth + 1);
                    } else if (de.isFile() && codeExts.has(path.extname(de.name).toLowerCase())) {
                        try {
                            const fullFilePath = path.join(dir, de.name);
                            const mt = fs.statSync(fullFilePath).mtimeMs;
                            if (mt > lastCodeMtime) {
                                lastCodeMtime = mt;
                                lastCodeFile = path.relative(scanRoot, fullFilePath).replace(/\\/g, '/');
                            }
                        } catch (e2) { /* skip */ }
                    }
                }
            } catch (e) { /* dir doesn't exist */ }
        };
        walkForMtime(scanRoot, 0);
        const lastCodeUpdate = lastCodeMtime > 0 ? new Date(lastCodeMtime).toISOString() : null;
        const daysSinceUpdate = lastCodeMtime > 0
            ? Math.floor((Date.now() - lastCodeMtime) / (1000 * 60 * 60 * 24)) : null;

        // ---- Dashboard: Last git commit messages ----
        let lastCommitMsg = null;
        let recentCommits = [];
        try {
            const gitDir = path.join(folderPath, '.git');
            if (fs.existsSync(gitDir)) {
                const logOutput = execSync('git log -5 --format="%H||%aI||%s"', {
                    cwd: folderPath, timeout: 3000, encoding: 'utf8',
                    shell: true
                }).trim();
                if (logOutput) {
                    const lines = logOutput.split('\n');
                    lastCommitMsg = lines[0].split('||')[2] || null;
                    recentCommits = lines.map(function(line) {
                        const parts = line.split('||');
                        return { hash: (parts[0] || '').substring(0, 7), date: parts[1] || null, message: parts[2] || '' };
                    });
                }
            }
        } catch (e) { /* no git repo or git not available */ }

        // ---- Dashboard: Feature flags from project_status.json ----
        const ps = projectStatus || {};
        const psf = ps.features || {};
        const psm = ps.milestones || {};
        const featureFlags = {
            controllerSupport: psf.controllerSupport || 'unknown',
            firstVisualUpgrade: psm.firstGraphicsPass !== undefined
                ? (psm.firstGraphicsPass ? 'complete' : 'missing') : 'unknown',
            achievements: psf.achievementsSystem || 'unknown',
            testingScripts: psf.testScripts || 'unknown',
            documentationComplete: (complianceMap['CLAUDE.md'] && complianceMap['game_direction.md'] && complianceMap['test_plan.md'])
                ? 'complete' : (complianceMap['CLAUDE.md'] ? 'partial' : 'missing')
        };

        // ---- Validate project_status.json required keys ----
        const validation = { valid: true, errors: [] };
        if (!projectStatus) {
            validation.valid = false;
            validation.errors.push('project_status.json missing');
        } else {
            const requiredKeys = ['schemaVersion', 'gameId', 'title', 'lastUpdated',
                                  'health', 'tech', 'features', 'milestones', 'testing', 'links'];
            for (const k of requiredKeys) {
                if (!(k in projectStatus)) {
                    validation.valid = false;
                    validation.errors.push('Missing key: ' + k);
                }
            }
            if (projectStatus.features) {
                const FEATURE_KEYS = ['controllerSupport','achievementsSystem','testScripts',
                                      'saveSystem','settingsMenu','audio','vfx'];
                const FEATURE_VALUES = new Set(['unknown','missing','partial','complete']);
                for (const fk of FEATURE_KEYS) {
                    if (!(fk in projectStatus.features)) {
                        validation.errors.push('Missing feature: ' + fk);
                    } else if (!FEATURE_VALUES.has(projectStatus.features[fk])) {
                        validation.errors.push('Invalid feature value: ' + fk);
                    }
                }
            }
            if (validation.errors.length > 0) validation.valid = false;
        }

        // ---- Read test_results.json for counts ----
        let testResults = null;
        const testResultsPath = path.join(folderPath, 'tests', 'test_results.json');
        try {
            testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
        } catch (e) { /* no test results file */ }

        const psTesting = projectStatus ? projectStatus.testing : null;
        const testStatus = psTesting ? psTesting.status : 'unknown';
        const healthColor = testStatus === 'pass' ? 'green' :
                            testStatus === 'fail' ? 'red' :
                            testStatus === 'error' ? 'red' : 'gray';

        const dashboard = {
            compliance: {
                hasClaudeMd: complianceMap['CLAUDE.md'],
                hasGameDirection: complianceMap['game_direction.md'],
                hasTestPlan: complianceMap['test_plan.md'],
                hasStatusHtml: complianceMap['status.html'],
                hasGameConfig: complianceMap['game.config.json'],
                hasProjectStatus: complianceMap['project_status.json'],
                hasAchievements: complianceMap['achievements.json'],
                hasAchievementsIntegration: complianceMap['achievements_integration.md'],
                missingFiles: dashMissing,
                complianceScore: complianceScore,
                complianceTotal: 8
            },
            dates: {
                lastCodeUpdate: lastCodeUpdate,
                daysSinceUpdate: daysSinceUpdate,
                lastCodeFile: lastCodeFile,
                lastCommitMsg: lastCommitMsg,
                recentCommits: recentCommits,
                lastStatusUpdate: ps.lastUpdated || null
            },
            featureFlags: featureFlags,
            categoryCompletion: { graphics: null, gameplay: null, menus: null, controls: null, music: null },
            validation: validation
        };

        // ---- Discover art assets ----
        var art = discoverGameArt(folderPath, folderName, config);

        results.push({
            id: gameId,
            name: config.title || config.name || folderName,
            folder: folderName,
            art: art,
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
                tests: {
                    status: healthColor,
                    total: testResults ? testResults.testsTotal : 0,
                    passed: testResults ? testResults.testsPassed : 0,
                    failed: testResults ? (testResults.testsFailed || 0) : 0,
                    lastRun: (testResults && testResults.timestamp) || (psTesting && psTesting.lastRunAt) || null
                },
                build: 'unknown',
                lastCommit: meta.lastGameplayUpdate || null
            },
            files: {
                claudeMd: claudeMdPath,
                gameDirection: gameDirectionPath,
                gameConfig: complianceMap['game.config.json'] ? folderName + '/game.config.json' : null,
                projectStatus: projectStatus ? folderName + '/project_status.json' : null,
                testResults: fs.existsSync(path.join(folderPath, 'tests', 'test_results.json'))
                    ? folderName + '/tests/test_results.json' : null,
                achievements: achievementsPath
            },
            launch: {
                type: launchType,
                projectDir: folderName
            },
            // Shared asset packages subscription
            sharedAssetPackages: (config.sharedAssets && config.sharedAssets.packages) || [],
            // Fields from project_status.json
            features: projectStatus ? projectStatus.features : null,
            milestones: projectStatus ? projectStatus.milestones : null,
            tech: projectStatus ? projectStatus.tech : null,
            testingStatus: projectStatus ? projectStatus.testing : null,
            projectHealth: projectStatus ? projectStatus.health : null,
            lastStatusUpdate: projectStatus ? projectStatus.lastUpdated : null,
            dashboard: dashboard
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

/* ---- Bring a launched process window to the foreground ---- */
const FOCUS_SCRIPT = path.join(LAUNCHER_DIR, 'scripts', 'focus-window.ps1');

function focusProcessWindow(pid) {
    exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${FOCUS_SCRIPT}" ${pid}`,
        { timeout: 12000 }, (err) => {
            if (err) console.error('[FOCUS] Could not focus window:', err.message);
        });
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

        // Bring the Godot window to foreground once it appears
        focusProcessWindow(child.pid);

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

    // POST /api/claude/:target — Launch Claude Code in a new terminal
    const claudeMatch = pathname.match(/^\/api\/claude\/([a-z0-9_-]+)$/i);
    if (claudeMatch && method === 'POST') {
        const target = claudeMatch[1].toLowerCase();

        // Special launcher targets (not game folders)
        const SPECIAL_TARGETS = {
            lumina: BASE_DIR,
            hunyuan: String.raw`Z:\ComfyUI-Hunyuan`
        };

        let folderPath;
        if (SPECIAL_TARGETS[target]) {
            folderPath = SPECIAL_TARGETS[target];
        } else {
            const folderName = GAME_FOLDERS[target];
            if (!folderName) {
                jsonResponse(res, 404, { error: `Unknown target: ${target}` });
                return;
            }
            folderPath = path.join(GAMES_DIR, folderName);
        }

        const cmd = `start cmd /k "cd /d ${folderPath} && claude --dangerously-skip-permissions"`;
        console.log(`[CLAUDE] Launching Claude Code for ${target}: ${cmd}`);
        exec(cmd, { cwd: folderPath }, (err) => {
            if (err) console.error(`[CLAUDE] Error launching for ${target}:`, err.message);
        });
        jsonResponse(res, 200, { status: 'launched', target: target });
        return;
    }

    // POST /api/open-terminal/:gameId — Open terminal in game folder
    const termMatch = pathname.match(/^\/api\/open-terminal\/([^/]+)$/i);
    if (termMatch && method === 'POST') {
        const folderName = decodeURIComponent(termMatch[1]);
        const folderPath = path.join(GAMES_DIR, folderName);
        const cmd = `start cmd /k "cd /d ${folderPath}"`;
        exec(cmd, (err) => { if (err) console.error('[TERMINAL]', err.message); });
        jsonResponse(res, 200, { status: 'opened', folder: folderName });
        return;
    }

    // POST /api/open-vscode/:gameId — Open VS Code in game folder
    const codeMatch = pathname.match(/^\/api\/open-vscode\/([^/]+)$/i);
    if (codeMatch && method === 'POST') {
        const folderName = decodeURIComponent(codeMatch[1]);
        const folderPath = path.join(GAMES_DIR, folderName);
        exec(`code "${folderPath}"`, (err) => { if (err) console.error('[VSCODE]', err.message); });
        jsonResponse(res, 200, { status: 'opened', folder: folderName });
        return;
    }

    // POST /api/open-folder/:gameId — Open folder in Explorer
    const folderMatch = pathname.match(/^\/api\/open-folder\/([^/]+)$/i);
    if (folderMatch && method === 'POST') {
        const folderName = decodeURIComponent(folderMatch[1]);
        const folderPath = path.join(GAMES_DIR, folderName);
        exec(`explorer "${folderPath}"`, (err) => { if (err) console.error('[FOLDER]', err.message); });
        jsonResponse(res, 200, { status: 'opened', folder: folderName });
        return;
    }

    // ---- 3D Asset Index APIs ----

    // GET /api/assets/3d — return 3D asset index
    if (pathname === '/api/assets/3d' && method === 'GET') {
        try {
            const data = fs.readFileSync(assetScanner.INDEX_PATH, 'utf8');
            const index = JSON.parse(data);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(index));
        } catch (e) {
            jsonResponse(res, 200, { version: 1, assetCount: 0, assets: [] });
        }
        return;
    }

    // POST /api/assets/rebuild-3d-index — rescan and rebuild
    if (pathname === '/api/assets/rebuild-3d-index' && method === 'POST') {
        try {
            const index = assetScanner.scan();
            jsonResponse(res, 200, { status: 'rebuilt', assetCount: index.assetCount });
        } catch (e) {
            jsonResponse(res, 500, { error: e.message });
        }
        return;
    }

    // ---- Asset Pipeline APIs ----

    // GET /api/assets — return catalog
    if (pathname === '/api/assets' && method === 'GET') {
        const catalog = assetSync.readJson(assetSync.CATALOG_PATH);
        if (!catalog) {
            jsonResponse(res, 200, { generated: null, assetCount: 0, assets: [] });
        } else {
            jsonResponse(res, 200, catalog);
        }
        return;
    }

    // GET /api/assets/sync-status — per-game sync overview
    if (pathname === '/api/assets/sync-status' && method === 'GET') {
        const games = assetSync.discoverGames();
        const catalog = assetSync.readJson(assetSync.CATALOG_PATH) || { assets: [] };
        const statuses = games.filter(g => g.sharedAssets && g.sharedAssets.enabled).map(g => {
            const syncState = assetSync.loadSyncState(g.dirPath);
            const eligible = assetSync.matchAssets(catalog, g.sharedAssets.pools[0] || {}, g.sharedAssets.exclude || []);
            return {
                id: g.id,
                folder: g.folder,
                eligible: eligible.length,
                synced: Object.keys(syncState.syncedAssets).length,
                lastSync: syncState.lastSync
            };
        });
        jsonResponse(res, 200, { games: statuses });
        return;
    }

    // POST /api/assets/sync/:gameId — trigger sync for a game
    const syncMatch = pathname.match(/^\/api\/assets\/sync\/([a-z0-9_-]+)$/i);
    if (syncMatch && method === 'POST') {
        const gameId = syncMatch[1].toLowerCase();
        const execute = url.searchParams.get('execute') === 'true';
        const games = assetSync.discoverGames();
        const game = games.find(g => g.id === gameId);
        if (!game) {
            jsonResponse(res, 404, { error: `Game not found: ${gameId}` });
            return;
        }
        let catalog = assetSync.readJson(assetSync.CATALOG_PATH);
        if (!catalog) catalog = assetSync.rebuildCatalog();
        const result = assetSync.syncGame(game, catalog, { execute, force: false, filterAssetId: null });
        jsonResponse(res, 200, result);
        return;
    }

    // POST /api/assets/rebuild-catalog — rebuild catalog.json
    if (pathname === '/api/assets/rebuild-catalog' && method === 'POST') {
        const catalog = assetSync.rebuildCatalog();
        jsonResponse(res, 200, { status: 'rebuilt', assetCount: catalog.assetCount });
        return;
    }

    // GET /api/assets/packages — return all packages with enriched data
    if (pathname === '/api/assets/packages' && method === 'GET') {
        const pkgData = assetSync.loadPackages();
        const catalog = assetSync.readJson(assetSync.CATALOG_PATH) || { assets: [] };
        const catalogIds = new Set(catalog.assets.map(a => a.id));
        const enriched = pkgData.packages.map(pkg => {
            const missing = (pkg.assets || []).filter(aid => !catalogIds.has(aid));
            return {
                id: pkg.id,
                name: pkg.name,
                description: pkg.description || '',
                dimension: pkg.dimension || '',
                category: pkg.category || '',
                theme: pkg.theme || '',
                assetCount: (pkg.assets || []).length,
                missingAssets: missing,
                created: pkg.created || null,
                updated: pkg.updated || null
            };
        });
        jsonResponse(res, 200, { packages: enriched });
        return;
    }

    // POST /api/games/:gameId/packages — update a game's subscribed packages
    const pkgMatch = pathname.match(/^\/api\/games\/([a-z0-9_-]+)\/packages$/i);
    if (pkgMatch && method === 'POST') {
        const gameId = pkgMatch[1].toLowerCase();
        const folderName = GAME_FOLDERS[gameId];
        if (!folderName) {
            jsonResponse(res, 404, { error: `Unknown game: ${gameId}` });
            return;
        }
        readBody(req, (body) => {
            let payload;
            try {
                payload = JSON.parse(body);
            } catch (e) {
                jsonResponse(res, 400, { error: 'Invalid JSON' });
                return;
            }
            if (!Array.isArray(payload.packages)) {
                jsonResponse(res, 400, { error: 'packages must be an array' });
                return;
            }
            const configPath = path.join(GAMES_DIR, folderName, 'game.config.json');
            let config = {};
            try {
                config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) { /* no config yet */ }
            if (!config.sharedAssets) {
                config.sharedAssets = { enabled: true };
            }
            config.sharedAssets.packages = payload.packages;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
            jsonResponse(res, 200, { status: 'updated', game: gameId, packages: payload.packages });
        });
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

    // ---- File Browser APIs ----

    // GET /api/browse?dir=relative/path — list directory contents
    if (pathname === '/api/browse' && method === 'GET') {
        const dir = url.searchParams.get('dir') || '';
        const absDir = path.resolve(BASE_DIR, dir);

        // Security: must be within BASE_DIR
        if (!absDir.startsWith(path.resolve(BASE_DIR))) {
            jsonResponse(res, 403, { error: 'Access denied' });
            return;
        }

        const SKIP_DIRS = new Set(['.git', 'node_modules', '.godot', '.import']);
        try {
            const entries = fs.readdirSync(absDir, { withFileTypes: true });
            const result = entries
                .filter(e => {
                    if (e.name.startsWith('.') && e.isDirectory() && SKIP_DIRS.has(e.name)) return false;
                    return true;
                })
                .map(e => {
                    const entryPath = dir ? dir + '/' + e.name : e.name;
                    const full = path.join(absDir, e.name);
                    let size = null;
                    let mtime = null;
                    if (e.isFile()) {
                        try {
                            const st = fs.statSync(full);
                            size = st.size;
                            mtime = st.mtime.toISOString();
                        } catch (_) {}
                    }
                    return {
                        name: e.name,
                        type: e.isDirectory() ? 'dir' : 'file',
                        path: entryPath.replace(/\\/g, '/'),
                        size: size,
                        mtime: mtime,
                        ext: e.isFile() ? path.extname(e.name).toLowerCase() : null
                    };
                })
                .sort((a, b) => {
                    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
                    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
                });

            jsonResponse(res, 200, { dir: dir, entries: result });
        } catch (e) {
            jsonResponse(res, 404, { error: 'Directory not found: ' + dir });
        }
        return;
    }

    // POST /api/assets/approve — copy staging asset to shared_assets
    if (pathname === '/api/assets/approve' && method === 'POST') {
        readBody(req, (body) => {
            let payload;
            try { payload = JSON.parse(body); } catch (e) {
                jsonResponse(res, 400, { error: 'Invalid JSON' });
                return;
            }
            const { sourcePath, targetDir } = payload;
            if (!sourcePath) {
                jsonResponse(res, 400, { error: 'sourcePath required' });
                return;
            }
            const srcAbs = path.resolve(BASE_DIR, sourcePath);
            const dstDirAbs = path.resolve(BASE_DIR, targetDir || 'shared_assets/3d');

            if (!srcAbs.startsWith(path.resolve(BASE_DIR)) || !dstDirAbs.startsWith(path.resolve(BASE_DIR))) {
                jsonResponse(res, 403, { error: 'Access denied' });
                return;
            }
            if (!fs.existsSync(srcAbs)) {
                jsonResponse(res, 404, { error: 'Source file not found' });
                return;
            }

            fs.mkdirSync(dstDirAbs, { recursive: true });
            const dstPath = path.join(dstDirAbs, path.basename(sourcePath));
            fs.copyFileSync(srcAbs, dstPath);

            // Also copy preview image if exists (.glb.png pattern)
            const previewSrc = srcAbs + '.png';
            if (fs.existsSync(previewSrc)) {
                fs.copyFileSync(previewSrc, dstPath + '.png');
            }

            jsonResponse(res, 200, {
                status: 'approved',
                source: sourcePath,
                destination: path.relative(BASE_DIR, dstPath).replace(/\\/g, '/')
            });
        });
        return;
    }

    // POST /api/open-path — open any path in Explorer
    if (pathname === '/api/open-path' && method === 'POST') {
        readBody(req, (body) => {
            let payload;
            try { payload = JSON.parse(body); } catch (e) {
                jsonResponse(res, 400, { error: 'Invalid JSON' });
                return;
            }
            const targetPath = payload.path || '';
            const absPath = path.resolve(BASE_DIR, targetPath);
            if (!absPath.startsWith(path.resolve(BASE_DIR))) {
                jsonResponse(res, 403, { error: 'Access denied' });
                return;
            }
            // If it's a file, open its containing folder and select it
            if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
                exec(`explorer /select,"${absPath}"`, (err) => { if (err) console.error('[OPEN]', err.message); });
            } else {
                exec(`explorer "${absPath}"`, (err) => { if (err) console.error('[OPEN]', err.message); });
            }
            jsonResponse(res, 200, { status: 'opened', path: targetPath });
        });
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
    console.log(`\n  \uD83D\uDD25 LUMINA running at http://localhost:${PORT}\n`);
    if (IS_PKG) {
        exec(`start http://localhost:${PORT}`);
    }
});

module.exports = { server, PORT };
