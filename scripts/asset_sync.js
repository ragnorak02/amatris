#!/usr/bin/env node
/* ============================================================
   asset_sync.js — Shared Asset Pipeline for LUMINA Studio OS

   CLI Usage:
     node scripts/asset_sync.js                         # Dry-run all games
     node scripts/asset_sync.js --execute               # Sync all games
     node scripts/asset_sync.js --game projectRagnorak   # Single game
     node scripts/asset_sync.js --asset knight --execute # Single asset
     node scripts/asset_sync.js --rebuild-catalog        # Rebuild catalog.json
     node scripts/asset_sync.js --status                 # Sync overview
     node scripts/asset_sync.js --init-asset <path>      # Scaffold asset.meta.json
     node scripts/asset_sync.js --force                  # Override local modifications
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE_DIR = path.resolve(__dirname, '..');
const SHARED_ASSETS_DIR = path.join(BASE_DIR, 'shared_assets');
const CATALOG_PATH = path.join(SHARED_ASSETS_DIR, 'catalog.json');
const PACKAGES_PATH = path.join(SHARED_ASSETS_DIR, 'packages.json');

const NON_GAME_DIRS = new Set([
    '.claude', '.git', 'css', 'js', 'refImages', 'scripts',
    'node_modules', 'screenshots', 'docs', 'shared_assets', 'game assets'
]);

/* ============================================================
   Utility helpers
   ============================================================ */

function sha256(filePath) {
    const data = fs.readFileSync(filePath);
    return 'sha256:' + crypto.createHash('sha256').update(data).digest('hex');
}

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function writeJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isoNow() {
    return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/* ============================================================
   Catalog rebuild — scan all asset.meta.json files
   ============================================================ */

function findAssetMetas(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findAssetMetas(full));
        } else if (entry.name === 'asset.meta.json') {
            results.push(full);
        }
    }
    return results;
}

function rebuildCatalog() {
    const metaFiles = findAssetMetas(SHARED_ASSETS_DIR);
    const assets = [];

    for (const metaPath of metaFiles) {
        const meta = readJson(metaPath);
        if (!meta || !meta.id) {
            console.warn(`  [WARN] Skipping invalid meta: ${metaPath}`);
            continue;
        }

        const relPath = path.relative(SHARED_ASSETS_DIR, path.dirname(metaPath)).replace(/\\/g, '/');
        const formats = (meta.files || []).map(f => f.format).filter(f => f !== 'mtl');

        assets.push({
            id: meta.id,
            name: meta.name,
            path: relPath,
            dimension: meta.dimension,
            theme: meta.theme,
            category: meta.category,
            status: meta.status,
            version: meta.version,
            formats,
            tags: meta.tags || []
        });
    }

    assets.sort((a, b) => a.id.localeCompare(b.id));

    const catalog = {
        generated: isoNow(),
        assetCount: assets.length,
        assets
    };

    writeJson(CATALOG_PATH, catalog);
    return catalog;
}

/* ============================================================
   Package management — named asset bundles
   ============================================================ */

function loadPackages() {
    const data = readJson(PACKAGES_PATH);
    if (!data || !data.packages) return { schemaVersion: 1, packages: [] };
    return data;
}

function writePackages(data) {
    writeJson(PACKAGES_PATH, data);
}

function resolvePackageAssets(catalog, packageIds, excludeIds) {
    const pkgData = loadPackages();
    const assetIds = new Set();

    for (const pkgId of packageIds) {
        const pkg = pkgData.packages.find(p => p.id === pkgId);
        if (!pkg) continue;
        for (const aid of (pkg.assets || [])) {
            if (!excludeIds || !excludeIds.includes(aid)) {
                assetIds.add(aid);
            }
        }
    }

    return catalog.assets.filter(a => assetIds.has(a.id) && a.status === 'approved');
}

/* ============================================================
   Game discovery — find games with sharedAssets config
   ============================================================ */

function discoverGames() {
    const games = [];
    const entries = fs.readdirSync(BASE_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (NON_GAME_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        const dirPath = path.join(BASE_DIR, entry.name);
        const configPath = path.join(dirPath, 'game.config.json');
        const hasClaudeMd = fs.existsSync(path.join(dirPath, 'CLAUDE.md'))
            || fs.existsSync(path.join(dirPath, 'claude.md'));
        const hasProjectGodot = fs.existsSync(path.join(dirPath, 'project.godot'));
        const hasConfig = fs.existsSync(configPath);

        if (!hasConfig && !hasClaudeMd && !hasProjectGodot) continue;

        const config = hasConfig ? readJson(configPath) : {};
        const id = entry.name.toLowerCase().replace(/['\s]+/g, '-').replace(/[^a-z0-9-]/g, '');

        games.push({
            id,
            folder: entry.name,
            dirPath,
            config: config || {},
            sharedAssets: (config && config.sharedAssets) || null
        });
    }

    return games;
}

/* ============================================================
   Asset matching — determine eligible assets for a game pool
   ============================================================ */

function matchAssets(catalog, pool, excludeIds) {
    return catalog.assets.filter(asset => {
        if (asset.status !== 'approved') return false;
        if (excludeIds && excludeIds.includes(asset.id)) return false;
        if (asset.dimension !== pool.dimension) return false;
        if (!pool.categories.includes(asset.category)) return false;
        if (!pool.themes.includes(asset.theme)) return false;

        // Check at least one requested format is available
        const hasFormat = pool.formats.some(fmt => asset.formats.includes(fmt));
        if (!hasFormat) return false;

        return true;
    });
}

function pickFile(assetMeta, preferredFormats) {
    // Return the first file matching preferred format order
    for (const fmt of preferredFormats) {
        const file = assetMeta.files.find(f => f.format === fmt);
        if (file) return file;
    }
    // Fallback: first non-mtl file
    return assetMeta.files.find(f => f.format !== 'mtl') || assetMeta.files[0];
}

/* ============================================================
   Sync logic — per-game asset synchronization
   ============================================================ */

const SYNC_STATUS = {
    NEW_ASSET: 'NEW_ASSET',
    UP_TO_DATE: 'UP_TO_DATE',
    UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
    LOCAL_MODIFIED: 'LOCAL_MODIFIED',
    LOCAL_ONLY: 'LOCAL_ONLY',
    SKIPPED_NO_FORMAT: 'SKIPPED_NO_FORMAT'
};

function loadSyncState(gameDirPath) {
    const syncPath = path.join(gameDirPath, '.asset_sync.json');
    return readJson(syncPath) || { lastSync: null, syncedAssets: {} };
}

function saveSyncState(gameDirPath, state) {
    const syncPath = path.join(gameDirPath, '.asset_sync.json');
    writeJson(syncPath, state);
}

function determineSyncAction(asset, assetMeta, pool, gameDirPath, syncState) {
    const file = pickFile(assetMeta, pool.formats);
    if (!file) return { status: SYNC_STATUS.SKIPPED_NO_FORMAT, asset, file: null, targetPath: null };

    const targetDir = path.join(gameDirPath, pool.targetDir);
    const targetPath = path.join(targetDir, file.name);
    const sourceDir = path.join(SHARED_ASSETS_DIR, asset.path);
    const sourcePath = path.join(sourceDir, file.name);

    const prevSync = syncState.syncedAssets[asset.id];
    const targetExists = fs.existsSync(targetPath);

    if (!targetExists) {
        if (prevSync) {
            // Was synced before but file was deleted — treat as new
            return { status: SYNC_STATUS.NEW_ASSET, asset, file, sourcePath, targetPath, targetDir };
        }
        return { status: SYNC_STATUS.NEW_ASSET, asset, file, sourcePath, targetPath, targetDir };
    }

    // Target exists
    const targetHash = sha256(targetPath);

    if (!prevSync) {
        // File exists but was never synced by us
        return { status: SYNC_STATUS.LOCAL_ONLY, asset, file, targetPath, targetHash };
    }

    // Check if local file was modified since last sync
    if (targetHash !== prevSync.contentHash) {
        return { status: SYNC_STATUS.LOCAL_MODIFIED, asset, file, targetPath, targetHash, prevHash: prevSync.contentHash };
    }

    // Local file matches last sync — check if source has a newer version
    const sourceHash = sha256(sourcePath);
    if (sourceHash !== prevSync.contentHash) {
        return { status: SYNC_STATUS.UPDATE_AVAILABLE, asset, file, sourcePath, targetPath, targetDir, sourceHash };
    }

    return { status: SYNC_STATUS.UP_TO_DATE, asset, file, targetPath };
}

function executeSync(action, syncState, force) {
    switch (action.status) {
        case SYNC_STATUS.NEW_ASSET:
        case SYNC_STATUS.UPDATE_AVAILABLE: {
            fs.mkdirSync(action.targetDir, { recursive: true });
            fs.copyFileSync(action.sourcePath, action.targetPath);
            const hash = sha256(action.targetPath);
            syncState.syncedAssets[action.asset.id] = {
                version: action.asset.version,
                contentHash: hash,
                syncedFile: action.file.name,
                targetPath: path.relative(path.dirname(action.targetPath).replace(/[/\\][^/\\]+$/, ''), action.targetPath).replace(/\\/g, '/'),
                syncedAt: isoNow()
            };
            return true;
        }
        case SYNC_STATUS.LOCAL_MODIFIED: {
            if (!force) return false;
            // Create backup
            const backupPath = action.targetPath + '.backup';
            fs.copyFileSync(action.targetPath, backupPath);
            // Re-copy from source
            const sourceDir = path.join(SHARED_ASSETS_DIR, action.asset.path);
            const sourcePath = path.join(sourceDir, action.file.name);
            fs.copyFileSync(sourcePath, action.targetPath);
            const hash = sha256(action.targetPath);
            syncState.syncedAssets[action.asset.id] = {
                version: action.asset.version,
                contentHash: hash,
                syncedFile: action.file.name,
                targetPath: action.file.name,
                syncedAt: isoNow()
            };
            return true;
        }
        default:
            return false;
    }
}

/* ============================================================
   Sync orchestrator — processes one game
   ============================================================ */

function syncGame(game, catalog, options) {
    const { execute, force, filterAssetId } = options;
    const results = { game: game.id, folder: game.folder, actions: [], errors: [] };

    if (!game.sharedAssets || !game.sharedAssets.enabled) {
        results.skipped = true;
        results.reason = 'sharedAssets not enabled';
        return results;
    }

    const excludeIds = game.sharedAssets.exclude || [];
    const syncState = loadSyncState(game.dirPath);
    const packageIds = game.sharedAssets.packages || [];

    // Determine whether to use package-based or pool-based resolution
    const usePackages = packageIds.length > 0;
    const pools = game.sharedAssets.pools || [];

    if (!usePackages && pools.length === 0) {
        results.skipped = true;
        results.reason = 'no asset pools or packages configured';
        return results;
    }

    if (usePackages) {
        // Package-based resolution
        const eligible = resolvePackageAssets(catalog, packageIds, excludeIds);
        const formats = game.sharedAssets.formats || ['fbx', 'glb', 'gltf'];
        const targetDir = game.sharedAssets.targetDir || 'assets/models/shared';
        // Create a synthetic pool for determineSyncAction compatibility
        const syntheticPool = { formats, targetDir };

        for (const asset of eligible) {
            if (filterAssetId && asset.id !== filterAssetId) continue;

            const metaPath = path.join(SHARED_ASSETS_DIR, asset.path, 'asset.meta.json');
            const assetMeta = readJson(metaPath);
            if (!assetMeta) {
                results.errors.push({ asset: asset.id, error: 'Could not read asset.meta.json' });
                continue;
            }

            const action = determineSyncAction(asset, assetMeta, syntheticPool, game.dirPath, syncState);

            if (execute && (action.status === SYNC_STATUS.NEW_ASSET ||
                            action.status === SYNC_STATUS.UPDATE_AVAILABLE ||
                            (action.status === SYNC_STATUS.LOCAL_MODIFIED && force))) {
                try {
                    executeSync(action, syncState, force);
                    action.executed = true;
                } catch (err) {
                    action.error = err.message;
                    results.errors.push({ asset: asset.id, error: err.message });
                }
            }

            results.actions.push(action);
        }
    } else {
        // Pool-based resolution (legacy)
        for (const pool of pools) {
            const eligible = matchAssets(catalog, pool, excludeIds);

            for (const asset of eligible) {
                if (filterAssetId && asset.id !== filterAssetId) continue;

                const metaPath = path.join(SHARED_ASSETS_DIR, asset.path, 'asset.meta.json');
                const assetMeta = readJson(metaPath);
                if (!assetMeta) {
                    results.errors.push({ asset: asset.id, error: 'Could not read asset.meta.json' });
                    continue;
                }

                const action = determineSyncAction(asset, assetMeta, pool, game.dirPath, syncState);

                if (execute && (action.status === SYNC_STATUS.NEW_ASSET ||
                                action.status === SYNC_STATUS.UPDATE_AVAILABLE ||
                                (action.status === SYNC_STATUS.LOCAL_MODIFIED && force))) {
                    try {
                        executeSync(action, syncState, force);
                        action.executed = true;
                    } catch (err) {
                        action.error = err.message;
                        results.errors.push({ asset: asset.id, error: err.message });
                    }
                }

                results.actions.push(action);
            }
        }
    }

    if (execute) {
        syncState.lastSync = isoNow();
        saveSyncState(game.dirPath, syncState);
        updateProjectStatus(game, results);
    }

    return results;
}

/* ============================================================
   Update project_status.json with sync health
   ============================================================ */

function updateProjectStatus(game, results) {
    const statusPath = path.join(game.dirPath, 'project_status.json');
    const status = readJson(statusPath) || {};

    if (!status.health) status.health = {};

    const actions = results.actions || [];
    const eligible = actions.length;
    const synced = actions.filter(a =>
        a.status === SYNC_STATUS.UP_TO_DATE ||
        (a.executed && (a.status === SYNC_STATUS.NEW_ASSET || a.status === SYNC_STATUS.UPDATE_AVAILABLE))
    ).length;
    const outdated = actions.filter(a => a.status === SYNC_STATUS.UPDATE_AVAILABLE && !a.executed).length;
    const conflicts = actions.filter(a =>
        a.status === SYNC_STATUS.LOCAL_MODIFIED || a.status === SYNC_STATUS.LOCAL_ONLY
    ).length;

    status.health.sharedAssetSync = {
        eligible,
        synced,
        outdated,
        conflicts,
        lastSync: isoNow()
    };

    writeJson(statusPath, status);
}

/* ============================================================
   Status overview
   ============================================================ */

function showStatus(games, catalog) {
    console.log(`\n  LUMINA Asset Pipeline — Status Overview`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  Catalog: ${catalog.assetCount} assets (${catalog.generated})`);
    console.log();

    const enabledGames = games.filter(g => g.sharedAssets && g.sharedAssets.enabled);
    console.log(`  Games opted in: ${enabledGames.length} / ${games.length}`);
    console.log();

    if (enabledGames.length === 0) {
        console.log('  No games have opted into shared assets yet.');
        console.log('  Add "sharedAssets" config to game.config.json to enable.');
        return;
    }

    for (const game of enabledGames) {
        const syncState = loadSyncState(game.dirPath);
        const syncedCount = Object.keys(syncState.syncedAssets).length;
        const lastSync = syncState.lastSync || 'never';
        console.log(`  ${game.folder.padEnd(25)} synced: ${syncedCount}  last: ${lastSync}`);
    }
    console.log();
}

/* ============================================================
   Init asset — scaffold asset.meta.json for a new asset
   ============================================================ */

function initAsset(assetPath) {
    const absPath = path.resolve(assetPath);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
        console.error(`  [ERROR] Not a directory: ${absPath}`);
        process.exit(1);
    }

    const metaPath = path.join(absPath, 'asset.meta.json');
    if (fs.existsSync(metaPath)) {
        console.error(`  [ERROR] asset.meta.json already exists at: ${metaPath}`);
        process.exit(1);
    }

    const folderName = path.basename(absPath);
    const relToShared = path.relative(SHARED_ASSETS_DIR, absPath).replace(/\\/g, '/');
    const parts = relToShared.split('/');
    const dimension = parts[0] || '3d';
    const category = parts[1] || 'props';

    // Scan files in directory
    const dirFiles = fs.readdirSync(absPath).filter(f => {
        const stat = fs.statSync(path.join(absPath, f));
        return stat.isFile() && f !== 'asset.meta.json';
    });

    const files = dirFiles.map(f => {
        const stat = fs.statSync(path.join(absPath, f));
        const ext = path.extname(f).slice(1).toLowerCase();
        return { name: f, format: ext, sizeBytes: stat.size };
    });

    // Hash primary file (first fbx/glb/png, else first file)
    const primaryFormats = ['fbx', 'glb', 'gltf', 'png', 'obj'];
    const primaryFile = files.find(f => primaryFormats.includes(f.format)) || files[0];
    let contentHash = '';
    if (primaryFile) {
        contentHash = sha256(path.join(absPath, primaryFile.name));
    }

    const meta = {
        schemaVersion: 1,
        id: folderName,
        name: folderName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        type: 'model',
        dimension,
        theme: 'fantasy',
        category,
        tags: [folderName],
        files,
        source: {
            tool: 'ComfyUI + Hunyuan3D-2',
            origin: 'ai-generated',
            license: 'internal'
        },
        status: 'raw',
        version: 1,
        contentHash,
        created: isoNow(),
        updated: isoNow()
    };

    writeJson(metaPath, meta);
    console.log(`  Created: ${metaPath}`);
    console.log(`  ID: ${meta.id}, Files: ${files.length}, Status: raw`);
    console.log(`  Edit asset.meta.json to review, then set status to "approved".`);
}

/* ============================================================
   Formatted output
   ============================================================ */

const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    bold: '\x1b[1m'
};

function statusColor(status) {
    switch (status) {
        case SYNC_STATUS.NEW_ASSET: return COLORS.green;
        case SYNC_STATUS.UP_TO_DATE: return COLORS.dim;
        case SYNC_STATUS.UPDATE_AVAILABLE: return COLORS.cyan;
        case SYNC_STATUS.LOCAL_MODIFIED: return COLORS.yellow;
        case SYNC_STATUS.LOCAL_ONLY: return COLORS.yellow;
        default: return COLORS.reset;
    }
}

function printResults(allResults, execute) {
    console.log(`\n  LUMINA Asset Pipeline — ${execute ? 'EXECUTE' : 'DRY RUN'}`);
    console.log(`  ${'─'.repeat(50)}`);

    let totalNew = 0, totalUpToDate = 0, totalUpdates = 0, totalConflicts = 0, totalErrors = 0;

    for (const result of allResults) {
        if (result.skipped) {
            continue; // Don't show non-opted-in games
        }

        console.log(`\n  ${COLORS.bold}${result.folder}${COLORS.reset}`);

        if (result.actions.length === 0) {
            console.log(`    ${COLORS.dim}No eligible assets${COLORS.reset}`);
            continue;
        }

        for (const action of result.actions) {
            const color = statusColor(action.status);
            const label = action.status.padEnd(18);
            const name = action.asset.id;
            const file = action.file ? action.file.name : '(no format)';
            const exec = action.executed ? ' ✓' : '';
            console.log(`    ${color}${label}${COLORS.reset} ${name.padEnd(20)} ${file}${exec}`);

            switch (action.status) {
                case SYNC_STATUS.NEW_ASSET: totalNew++; break;
                case SYNC_STATUS.UP_TO_DATE: totalUpToDate++; break;
                case SYNC_STATUS.UPDATE_AVAILABLE: totalUpdates++; break;
                case SYNC_STATUS.LOCAL_MODIFIED:
                case SYNC_STATUS.LOCAL_ONLY: totalConflicts++; break;
            }
        }

        if (result.errors.length > 0) {
            for (const err of result.errors) {
                console.log(`    ${COLORS.red}ERROR${COLORS.reset} ${err.asset}: ${err.error}`);
                totalErrors++;
            }
        }
    }

    console.log(`\n  ${'─'.repeat(50)}`);
    console.log(`  New: ${totalNew}  Up-to-date: ${totalUpToDate}  Updates: ${totalUpdates}  Conflicts: ${totalConflicts}  Errors: ${totalErrors}`);
    if (!execute && totalNew + totalUpdates > 0) {
        console.log(`\n  Run with --execute to apply changes.`);
    }
    console.log();
}

/* ============================================================
   CLI entry point
   ============================================================ */

function main() {
    const args = process.argv.slice(2);
    const flags = {
        execute: args.includes('--execute'),
        force: args.includes('--force'),
        rebuildCatalog: args.includes('--rebuild-catalog'),
        status: args.includes('--status'),
        game: null,
        asset: null,
        initAsset: null
    };

    // Parse --game <name>
    const gameIdx = args.indexOf('--game');
    if (gameIdx !== -1 && args[gameIdx + 1]) {
        flags.game = args[gameIdx + 1].toLowerCase();
    }

    // Parse --asset <id>
    const assetIdx = args.indexOf('--asset');
    if (assetIdx !== -1 && args[assetIdx + 1]) {
        flags.asset = args[assetIdx + 1];
    }

    // Parse --init-asset <path>
    const initIdx = args.indexOf('--init-asset');
    if (initIdx !== -1 && args[initIdx + 1]) {
        flags.initAsset = args[initIdx + 1];
        initAsset(flags.initAsset);
        return;
    }

    // Rebuild catalog
    if (flags.rebuildCatalog) {
        console.log('  Rebuilding catalog...');
        const catalog = rebuildCatalog();
        console.log(`  Catalog rebuilt: ${catalog.assetCount} assets → ${CATALOG_PATH}`);
        if (!flags.execute && !flags.status) return;
    }

    // Load or rebuild catalog
    let catalog = readJson(CATALOG_PATH);
    if (!catalog) {
        console.log('  No catalog found, building...');
        catalog = rebuildCatalog();
        console.log(`  Catalog built: ${catalog.assetCount} assets`);
    }

    const games = discoverGames();

    // Status mode
    if (flags.status) {
        showStatus(games, catalog);
        return;
    }

    // Filter games
    let targetGames = games;
    if (flags.game) {
        targetGames = games.filter(g => g.id === flags.game || g.folder.toLowerCase() === flags.game);
        if (targetGames.length === 0) {
            console.error(`  [ERROR] Game not found: ${flags.game}`);
            console.error(`  Available: ${games.map(g => g.id).join(', ')}`);
            process.exit(1);
        }
    }

    // Sync
    const allResults = [];
    for (const game of targetGames) {
        const result = syncGame(game, catalog, {
            execute: flags.execute,
            force: flags.force,
            filterAssetId: flags.asset
        });
        allResults.push(result);
    }

    printResults(allResults, flags.execute);
}

// Export for server.js API usage
module.exports = { rebuildCatalog, discoverGames, syncGame, matchAssets, readJson, writeJson, loadSyncState, loadPackages, writePackages, resolvePackageAssets, SHARED_ASSETS_DIR, CATALOG_PATH, PACKAGES_PATH };

// Run CLI if called directly
if (require.main === module) {
    main();
}
