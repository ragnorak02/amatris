/* ============================================================
   validate_portfolio_status.js
   Validates all project_status.json files across game folders.

   Usage:  node scripts/validate_portfolio_status.js
   Exit 0 if all valid, exit 1 if any errors.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.resolve(__dirname, '..');
const NON_GAME_DIRS = new Set([
    '.claude', '.git', 'css', 'js', 'refImages', 'scripts',
    'node_modules', 'screenshots', 'docs'
]);

const FEATURE_KEYS = [
    'controllerSupport', 'achievementsSystem', 'testScripts',
    'saveSystem', 'settingsMenu', 'audio', 'vfx'
];
const FEATURE_VALUES = new Set(['unknown', 'missing', 'partial', 'complete']);

const MILESTONE_KEYS = [
    'firstGraphicsPass', 'controllerIntegration', 'coreGameplayLoop',
    'verticalSlice', 'contentComplete', 'productionReady'
];

const TESTING_STATUSES = new Set(['unknown', 'pass', 'fail', 'error']);

function discoverGameFolders() {
    var folders = [];
    var entries = fs.readdirSync(BASE_DIR, { withFileTypes: true });
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!entry.isDirectory()) continue;
        if (NON_GAME_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.')) continue;

        var dirPath = path.join(BASE_DIR, entry.name);
        var hasConfig = fs.existsSync(path.join(dirPath, 'game.config.json'));
        var hasClaudeMd = fs.existsSync(path.join(dirPath, 'claude.md'))
            || fs.existsSync(path.join(dirPath, 'CLAUDE.md'));
        var hasProjectGodot = fs.existsSync(path.join(dirPath, 'project.godot'));

        if (hasConfig || hasClaudeMd || hasProjectGodot) {
            folders.push(entry.name);
        }
    }
    return folders;
}

function validateStatus(folderName) {
    var errors = [];
    var statusPath = path.join(BASE_DIR, folderName, 'project_status.json');

    if (!fs.existsSync(statusPath)) {
        return { folder: folderName, valid: false, errors: ['project_status.json not found'] };
    }

    var raw;
    try {
        raw = fs.readFileSync(statusPath, 'utf8');
    } catch (e) {
        return { folder: folderName, valid: false, errors: ['Cannot read file: ' + e.message] };
    }

    var data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        return { folder: folderName, valid: false, errors: ['Invalid JSON: ' + e.message] };
    }

    // Required top-level keys
    var requiredKeys = ['schemaVersion', 'gameId', 'title', 'lastUpdated', 'health', 'tech', 'features', 'milestones', 'testing', 'links'];
    for (var i = 0; i < requiredKeys.length; i++) {
        if (!(requiredKeys[i] in data)) {
            errors.push('Missing key: ' + requiredKeys[i]);
        }
    }

    // schemaVersion
    if (data.schemaVersion !== 1) {
        errors.push('schemaVersion must be 1, got: ' + data.schemaVersion);
    }

    // lastUpdated ISO date
    if (data.lastUpdated) {
        var d = new Date(data.lastUpdated);
        if (isNaN(d.getTime())) {
            errors.push('lastUpdated is not a valid ISO date: ' + data.lastUpdated);
        }
    }

    // health
    if (data.health) {
        if (typeof data.health.progressPercent !== 'number' || data.health.progressPercent < 0 || data.health.progressPercent > 100) {
            errors.push('health.progressPercent must be 0-100, got: ' + data.health.progressPercent);
        }
    }

    // features
    if (data.features) {
        for (var f = 0; f < FEATURE_KEYS.length; f++) {
            var fk = FEATURE_KEYS[f];
            if (!(fk in data.features)) {
                errors.push('Missing feature key: ' + fk);
            } else if (!FEATURE_VALUES.has(data.features[fk])) {
                errors.push('Invalid feature value for ' + fk + ': ' + data.features[fk]);
            }
        }
    }

    // milestones
    if (data.milestones) {
        for (var m = 0; m < MILESTONE_KEYS.length; m++) {
            var mk = MILESTONE_KEYS[m];
            if (!(mk in data.milestones)) {
                errors.push('Missing milestone key: ' + mk);
            } else if (typeof data.milestones[mk] !== 'boolean') {
                errors.push('Milestone ' + mk + ' must be boolean, got: ' + typeof data.milestones[mk]);
            }
        }
    }

    // testing
    if (data.testing) {
        if (data.testing.status && !TESTING_STATUSES.has(data.testing.status)) {
            errors.push('Invalid testing.status: ' + data.testing.status);
        }
    }

    return {
        folder: folderName,
        valid: errors.length === 0,
        errors: errors,
        missingFeatures: data.features ? FEATURE_KEYS.filter(function (k) { return data.features[k] === 'missing'; }).length : 0,
        unknownFeatures: data.features ? FEATURE_KEYS.filter(function (k) { return data.features[k] === 'unknown'; }).length : 0
    };
}

// Main
var folders = discoverGameFolders();
console.log('Scanning ' + folders.length + ' game folder(s)...\n');

var results = [];
var passCount = 0;
var failCount = 0;

for (var i = 0; i < folders.length; i++) {
    var result = validateStatus(folders[i]);
    results.push(result);
    if (result.valid) {
        passCount++;
    } else {
        failCount++;
    }
}

// Print results
var PAD = 22;
for (var r = 0; r < results.length; r++) {
    var res = results[r];
    var status = res.valid ? 'PASS' : 'FAIL';
    var icon = res.valid ? '\u2705' : '\u274C';
    var name = res.folder;
    while (name.length < PAD) name += ' ';
    var line = '  ' + icon + ' ' + name + ' ' + status;
    if (res.valid) {
        line += '  (missing: ' + res.missingFeatures + ', unknown: ' + res.unknownFeatures + ')';
    }
    console.log(line);
    if (!res.valid) {
        for (var e = 0; e < res.errors.length; e++) {
            console.log('       ' + res.errors[e]);
        }
    }
}

console.log('\n' + passCount + '/' + results.length + ' passing, ' + failCount + ' failing');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
