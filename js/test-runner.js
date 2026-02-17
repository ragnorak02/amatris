/* ============================================================
   test-runner.js — Test Runner for Hybrid Knights Studio OS
   Triggers tests via server API, shows live results, updates
   health indicators in the studio dashboard and overlay.
   ============================================================ */

var TestRunner = (function () {
    'use strict';

    var runningTests = {};

    /* ============================================================
       RUN TESTS FOR A SINGLE GAME
       ============================================================ */
    function runForGame(gameId, callback) {
        if (runningTests[gameId]) return; // Already running

        runningTests[gameId] = true;
        updateRowState(gameId, 'running');

        fetch('/api/tests/' + encodeURIComponent(gameId), { method: 'POST' })
            .then(function (r) { return r.json(); })
            .then(function (result) {
                delete runningTests[gameId];
                handleResult(gameId, result);
                if (callback) callback(result);
            })
            .catch(function (err) {
                delete runningTests[gameId];
                var errorResult = {
                    gameId: gameId,
                    status: 'error',
                    testsTotal: 0,
                    testsPassed: 0,
                    testsFailed: 0,
                    durationMs: 0,
                    timestamp: new Date().toISOString(),
                    details: [],
                    error: 'Failed to connect to server'
                };
                handleResult(gameId, errorResult);
                if (callback) callback(errorResult);
            });
    }

    /* ============================================================
       RUN ALL TESTS
       ============================================================ */
    function runAll(callback) {
        // Show all rows as running
        if (typeof Studio !== 'undefined') {
            var allGames = Studio.getGames();
            for (var i = 0; i < allGames.length; i++) {
                if (allGames[i].hasTestRunner) {
                    updateRowState(allGames[i].id, 'running');
                }
            }
        }

        fetch('/api/tests/run-all', { method: 'POST' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                var results = data.results || [];
                for (var i = 0; i < results.length; i++) {
                    var result = results[i];
                    if (result.gameId) {
                        handleResult(result.gameId, result);
                    }
                }
                if (callback) callback(results);
            })
            .catch(function () {
                if (callback) callback([]);
            });
    }

    /* ============================================================
       HANDLE RESULT — Update UI indicators
       ============================================================ */
    function handleResult(gameId, result) {
        // Map result status to health dot
        var healthStatus = 'gray';
        if (result.status === 'pass') healthStatus = 'green';
        else if (result.status === 'warning') healthStatus = 'orange';
        else if (result.status === 'fail') healthStatus = 'red';
        else if (result.status === 'error') healthStatus = 'red';

        // Update Studio game health
        if (typeof Studio !== 'undefined') {
            Studio.updateGameHealth(gameId, {
                tests: {
                    status: healthStatus,
                    total: result.testsTotal || 0,
                    passed: result.testsPassed || 0,
                    lastRun: result.timestamp || new Date().toISOString()
                },
                build: 'unknown',
                lastCommit: null
            });
        }

        // Update row state
        updateRowState(gameId, 'done');

        // Store result for overlay display
        storeResult(gameId, result);
    }

    /* ============================================================
       ROW STATE — Visual feedback on studio rows
       ============================================================ */
    function updateRowState(gameId, state) {
        var row = document.querySelector('.studio-row[data-game-id="' + gameId + '"]');
        if (!row) return;

        var testBtn = row.querySelector('.test-btn');
        if (!testBtn) return;

        if (state === 'running') {
            testBtn.textContent = '\u23F3'; // Hourglass
            testBtn.disabled = true;
            testBtn.title = 'Running tests...';
        } else {
            testBtn.textContent = '\u2714'; // Check mark
            testBtn.disabled = false;
            testBtn.title = 'Run Tests';
        }
    }

    /* ============================================================
       RESULT STORAGE — sessionStorage for overlay display
       ============================================================ */
    function storeResult(gameId, result) {
        try {
            var key = 'test-result-' + gameId;
            sessionStorage.setItem(key, JSON.stringify(result));
        } catch (e) { /* ignore */ }
    }

    function getResult(gameId) {
        try {
            var key = 'test-result-' + gameId;
            var stored = sessionStorage.getItem(key);
            if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
        return null;
    }

    /* ============================================================
       OVERLAY RESULTS RENDERING
       ============================================================ */
    function renderOverlayResults(gameId, container) {
        var result = getResult(gameId);
        if (!result) {
            container.innerHTML =
                '<div class="test-overlay-empty">No test results yet.<br>Click "Run Tests" to execute.</div>';
            return;
        }

        var statusClass = result.status === 'pass' ? 'test-pass' :
                          result.status === 'fail' ? 'test-fail' :
                          result.status === 'error' ? 'test-error' : 'test-warn';

        var html = '<div class="test-overlay-summary">' +
            '<div class="test-overlay-status ' + statusClass + '">' +
                escapeHtml(result.status ? result.status.toUpperCase() : 'UNKNOWN') +
            '</div>' +
            '<div class="test-overlay-counts">' +
                '<span class="test-count-pass">' + (result.testsPassed || 0) + ' passed</span>' +
                '<span class="test-count-fail">' + (result.testsFailed || 0) + ' failed</span>' +
                '<span class="test-count-total">' + (result.testsTotal || 0) + ' total</span>' +
            '</div>' +
            '<div class="test-overlay-duration">' +
                (result.durationMs ? (result.durationMs / 1000).toFixed(1) + 's' : '') +
            '</div>' +
        '</div>';

        // Individual test details
        if (result.details && result.details.length > 0) {
            html += '<div class="test-overlay-details">';
            for (var i = 0; i < result.details.length; i++) {
                var d = result.details[i];
                var dClass = d.status === 'pass' ? 'test-pass' : 'test-fail';
                html += '<div class="test-detail-row ' + dClass + '">' +
                    '<span class="test-detail-badge">' + (d.status === 'pass' ? '\u2713' : '\u2717') + '</span>' +
                    '<span class="test-detail-name">' + escapeHtml(d.name) + '</span>' +
                    (d.durationMs ? '<span class="test-detail-time">' + d.durationMs + 'ms</span>' : '') +
                '</div>';
                if (d.error) {
                    html += '<div class="test-detail-error">' + escapeHtml(d.error) + '</div>';
                }
            }
            html += '</div>';
        }

        // Raw output fallback
        if (result.rawOutput && (!result.details || result.details.length === 0)) {
            html += '<pre class="test-overlay-raw">' + escapeHtml(result.rawOutput) + '</pre>';
        }

        container.innerHTML = html;
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return {
        runForGame: runForGame,
        runAll: runAll,
        getResult: getResult,
        renderOverlayResults: renderOverlayResults
    };
})();
