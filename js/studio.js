/* ============================================================
   studio.js — Studio Dashboard for Hybrid Knights
   Vertical game list with filtering, sorting, expandable details,
   and game launching. Replaces the carousel.
   ============================================================ */

var Studio = (function () {
    'use strict';

    /* ---- State ---- */
    var games = [];
    var expandedId = null;
    var activeTab = {};
    var searchQuery = '';
    var engineFilter = 'all';
    var sortBy = 'name';
    var CACHE_TTL = 30000; // 30s sessionStorage cache
    var runningPollTimer = null;
    var POLL_INTERVAL = 3000; // 3s polling for running games

    /* ---- DOM refs ---- */
    var viewEl, toolbarEl, listEl;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        viewEl = document.getElementById('studio-view');
        if (!viewEl) return;

        renderToolbar();
        fetchGames();

        // Menu tab handler
        document.querySelectorAll('.menu-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                document.querySelectorAll('.menu-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
            });
        });

        // Keyboard navigation
        document.addEventListener('keydown', function (e) {
            // Only handle when studio is visible and no game running
            if (typeof GameView !== 'undefined' && GameView.isRunning()) return;
            if (typeof FilePreview !== 'undefined' && FilePreview.isOpen()) {
                if (e.key === 'Escape') { FilePreview.close(); e.preventDefault(); }
                return;
            }

            var rows = document.querySelectorAll('.studio-row');
            if (rows.length === 0) return;

            var focused = document.querySelector('.studio-row.keyboard-focus');
            var idx = -1;
            if (focused) {
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i] === focused) { idx = i; break; }
                }
            }

            if (e.key === 'ArrowDown' || e.key === 'j') {
                e.preventDefault();
                idx = idx >= rows.length - 1 ? 0 : idx + 1;
                setKeyboardFocus(rows, idx);
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                e.preventDefault();
                idx = idx <= 0 ? rows.length - 1 : idx - 1;
                setKeyboardFocus(rows, idx);
            } else if (e.key === 'Enter' && focused) {
                e.preventDefault();
                var gameId = focused.dataset.gameId;
                if (expandedId === gameId) {
                    // Launch if already expanded
                    var game = findGame(gameId);
                    if (game) launchGame(game);
                } else {
                    toggleExpand(gameId);
                }
            } else if (e.key === 'Escape') {
                if (expandedId) {
                    expandedId = null;
                    renderGameList();
                } else {
                    clearKeyboardFocus();
                }
            }
        });

        // Start polling for running games
        startRunningPoll();

        // Pause polling when tab is hidden
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                stopRunningPoll();
            } else {
                startRunningPoll();
            }
        });
    }

    /* ============================================================
       RUNNING GAMES POLLING
       ============================================================ */
    function startRunningPoll() {
        if (runningPollTimer) return;
        pollRunning();
        runningPollTimer = setInterval(pollRunning, POLL_INTERVAL);
    }

    function stopRunningPoll() {
        if (runningPollTimer) {
            clearInterval(runningPollTimer);
            runningPollTimer = null;
        }
    }

    function pollRunning() {
        fetch('/api/running')
            .then(function (r) { return r.json(); })
            .then(function (running) {
                var rows = document.querySelectorAll('.studio-row');
                rows.forEach(function (row) {
                    var gameId = row.dataset.gameId;
                    var isRunning = running.hasOwnProperty(gameId);
                    row.classList.toggle('running', isRunning);

                    // Swap launch button icon
                    var launchBtn = row.querySelector('.launch-btn');
                    if (launchBtn) {
                        if (isRunning) {
                            launchBtn.textContent = '\u25A0'; // Stop square
                            launchBtn.title = 'Stop Game';
                        } else {
                            launchBtn.textContent = '\u25B6'; // Play triangle
                            launchBtn.title = 'Launch';
                        }
                    }
                });
            })
            .catch(function () { /* ignore network errors */ });
    }

    /* ============================================================
       FETCH GAMES — From /api/games with sessionStorage cache
       ============================================================ */
    function fetchGames(callback) {
        // Check cache
        try {
            var cached = sessionStorage.getItem('studio-games');
            var cacheTime = parseInt(sessionStorage.getItem('studio-games-ts') || '0');
            if (cached && (Date.now() - cacheTime) < CACHE_TTL) {
                games = JSON.parse(cached);
                renderGameList();
                if (callback) callback();
                return;
            }
        } catch (e) { /* ignore */ }

        fetch('/api/games')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                games = data;
                // Cache in sessionStorage
                try {
                    sessionStorage.setItem('studio-games', JSON.stringify(games));
                    sessionStorage.setItem('studio-games-ts', String(Date.now()));
                } catch (e) { /* ignore */ }
                renderGameList();
                if (callback) callback();
            })
            .catch(function () {
                // If API fails, show empty state
                games = [];
                renderGameList();
                if (callback) callback();
            });
    }

    /* ============================================================
       TOOLBAR
       ============================================================ */
    function renderToolbar() {
        toolbarEl = document.getElementById('studio-toolbar');
        if (!toolbarEl) return;

        toolbarEl.innerHTML =
            '<div class="toolbar-left">' +
                '<div class="search-wrap">' +
                    '<input type="text" class="studio-search" id="studio-search" placeholder="Search games..." />' +
                '</div>' +
                '<select class="studio-select" id="studio-filter-engine">' +
                    '<option value="all">All Engines</option>' +
                    '<option value="godot">Godot</option>' +
                    '<option value="unity">Unity</option>' +
                    '<option value="html">HTML5</option>' +
                '</select>' +
                '<select class="studio-select" id="studio-sort">' +
                    '<option value="name">Sort: Name</option>' +
                    '<option value="completion">Sort: Completion</option>' +
                    '<option value="engine">Sort: Engine</option>' +
                    '<option value="phase">Sort: Phase</option>' +
                '</select>' +
                '<span class="game-count" id="studio-game-count"></span>' +
            '</div>' +
            '<div class="toolbar-right">' +
                '<button class="toolbar-btn primary" id="studio-run-all-tests" title="Run All Tests">' +
                    '\u25B6 Run All Tests' +
                '</button>' +
                '<button class="toolbar-btn" id="studio-refresh" title="Refresh">' +
                    '\u21BB' +
                '</button>' +
            '</div>';

        // Wire up events — debounced search (250ms)
        var searchTimer = null;
        document.getElementById('studio-search').addEventListener('input', function (e) {
            searchQuery = e.target.value.toLowerCase();
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function () { renderGameList(); }, 250);
        });

        document.getElementById('studio-filter-engine').addEventListener('change', function (e) {
            engineFilter = e.target.value;
            renderGameList();
        });

        document.getElementById('studio-sort').addEventListener('change', function (e) {
            sortBy = e.target.value;
            renderGameList();
        });

        document.getElementById('studio-refresh').addEventListener('click', function () {
            // Clear cache and re-fetch
            try {
                sessionStorage.removeItem('studio-games');
                sessionStorage.removeItem('studio-games-ts');
            } catch (e) { /* ignore */ }
            fetchGames();
        });

        document.getElementById('studio-run-all-tests').addEventListener('click', function () {
            // Stub — wired in Phase 5
            if (typeof TestRunner !== 'undefined') {
                TestRunner.runAll();
            }
        });
    }

    /* ============================================================
       GAME LIST — Filter, sort, render
       ============================================================ */
    function getFilteredGames() {
        var filtered = games.filter(function (g) {
            // Search filter
            if (searchQuery) {
                var q = searchQuery;
                var match = g.name.toLowerCase().indexOf(q) !== -1 ||
                    g.genre.toLowerCase().indexOf(q) !== -1 ||
                    g.engine.toLowerCase().indexOf(q) !== -1 ||
                    g.folder.toLowerCase().indexOf(q) !== -1 ||
                    g.tags.some(function (t) { return t.toLowerCase().indexOf(q) !== -1; });
                if (!match) return false;
            }

            // Engine filter
            if (engineFilter !== 'all' && g.engineType !== engineFilter) return false;

            return true;
        });

        // Sort
        filtered.sort(function (a, b) {
            switch (sortBy) {
                case 'completion':
                    return b.completion - a.completion;
                case 'engine':
                    return a.engine.localeCompare(b.engine);
                case 'phase':
                    return a.phase.localeCompare(b.phase);
                default: // name
                    return a.name.localeCompare(b.name);
            }
        });

        return filtered;
    }

    function renderGameList() {
        listEl = document.getElementById('studio-game-list');
        if (!listEl) return;

        var filtered = getFilteredGames();

        // Update count
        var countEl = document.getElementById('studio-game-count');
        if (countEl) {
            countEl.textContent = filtered.length + ' of ' + games.length + ' games';
        }

        if (filtered.length === 0) {
            listEl.innerHTML =
                '<div class="studio-empty">' +
                    '<div class="studio-empty-icon">\uD83D\uDD0D</div>' +
                    '<div class="studio-empty-text">No games match your search</div>' +
                '</div>';
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            html += renderRow(filtered[i]);
        }
        listEl.innerHTML = html;

        // Wire up row events
        listEl.querySelectorAll('.studio-row').forEach(function (row) {
            var gameId = row.dataset.gameId;
            var game = findGame(gameId);
            if (!game) return;

            // Click main row to toggle expand
            row.querySelector('.studio-row-main').addEventListener('click', function (e) {
                // Don't expand if clicking action buttons
                if (e.target.closest('.studio-row-actions')) return;
                toggleExpand(gameId);
            });

            // Launch button
            var launchBtn = row.querySelector('.launch-btn');
            if (launchBtn) {
                launchBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    launchGame(game);
                });
            }

            // Run tests button
            var testBtn = row.querySelector('.test-btn');
            if (testBtn) {
                testBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    // Stub — wired in Phase 5
                    if (typeof TestRunner !== 'undefined') {
                        TestRunner.runForGame(gameId);
                    }
                });
            }

            // Expand button
            var expandBtn = row.querySelector('.expand-btn');
            if (expandBtn) {
                expandBtn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    toggleExpand(gameId);
                });
            }
        });
    }

    /* ============================================================
       ROW RENDERING
       ============================================================ */
    function renderRow(game) {
        var isExpanded = expandedId === game.id;
        var rowClass = 'studio-row' + (isExpanded ? ' expanded' : '');

        var healthDot = game.health.tests.status || 'gray';
        var healthText = healthDot === 'green' ? 'Pass' :
                         healthDot === 'orange' ? 'Warn' :
                         healthDot === 'red' ? 'Fail' : 'N/A';

        var tagsHtml = '';
        for (var t = 0; t < game.tags.length && t < 3; t++) {
            tagsHtml += '<span class="studio-tag">' + escapeHtml(game.tags[t]) + '</span>';
        }

        return '<div class="' + rowClass + '" data-game-id="' + game.id + '">' +
            '<div class="studio-row-main">' +
                // Box art
                '<div class="studio-row-art" style="background: linear-gradient(135deg, ' + game.color + ', #0a0a1a);">' +
                    '<span>' + game.icon + '</span>' +
                '</div>' +
                // Info
                '<div class="studio-row-info">' +
                    '<div class="studio-row-name">' + escapeHtml(game.name) + '</div>' +
                    '<div class="studio-row-subtitle">' +
                        '<span>' + escapeHtml(game.engine) + '</span>' +
                        '<span>\u2022</span>' +
                        '<span>' + escapeHtml(game.genre) + '</span>' +
                    '</div>' +
                    '<div class="studio-row-tags">' + tagsHtml + '</div>' +
                '</div>' +
                // Metrics
                '<div class="studio-row-metrics">' +
                    '<div class="studio-metric">' +
                        '<span class="studio-metric-label">Phase</span>' +
                        '<span class="studio-metric-value">' + escapeHtml(game.phase) + '</span>' +
                    '</div>' +
                    '<div class="studio-metric">' +
                        '<span class="studio-metric-label">Complete</span>' +
                        '<span class="studio-metric-value">' + game.completion + '%</span>' +
                        '<div class="completion-bar"><div class="completion-fill" style="width:' + game.completion + '%"></div></div>' +
                    '</div>' +
                    '<div class="studio-metric">' +
                        '<span class="studio-metric-label">Version</span>' +
                        '<span class="studio-metric-value">' + escapeHtml(game.version) + '</span>' +
                    '</div>' +
                '</div>' +
                // Health
                '<div class="studio-row-health">' +
                    '<span class="health-dot ' + healthDot + '"></span>' +
                    '<span class="health-label">' + healthText + '</span>' +
                '</div>' +
                // Actions
                '<div class="studio-row-actions">' +
                    '<button class="row-action-btn launch-btn" title="Launch">\u25B6</button>' +
                    '<button class="row-action-btn test-btn" title="Run Tests">\u2714</button>' +
                    '<button class="row-action-btn expand-btn" title="Details">' + (isExpanded ? '\u25B2' : '\u25BC') + '</button>' +
                '</div>' +
            '</div>' +
            // Expandable details
            '<div class="studio-expand">' +
                (isExpanded ? renderExpandContent(game) : '') +
            '</div>' +
        '</div>';
    }

    /* ============================================================
       EXPAND / COLLAPSE
       ============================================================ */
    function toggleExpand(gameId) {
        if (expandedId === gameId) {
            expandedId = null;
        } else {
            expandedId = gameId;
            if (!activeTab[gameId]) activeTab[gameId] = 'overview';
        }
        renderGameList();
    }

    /* ============================================================
       EXPANDED CONTENT — Tabbed detail panel
       ============================================================ */
    function renderExpandContent(game) {
        var currentTab = activeTab[game.id] || 'overview';
        var tabs = ['overview', 'commits', 'tests', 'devnotes', 'changelog', 'files'];
        var tabLabels = { overview: 'Overview', commits: 'Commits', tests: 'Tests', devnotes: 'Dev Notes', changelog: 'Changelog', files: 'Files' };

        var tabsHtml = '';
        for (var i = 0; i < tabs.length; i++) {
            var cls = 'studio-tab' + (tabs[i] === currentTab ? ' active' : '');
            tabsHtml += '<button class="' + cls + '" data-tab="' + tabs[i] + '" data-game-id="' + game.id + '">' +
                tabLabels[tabs[i]] + '</button>';
        }

        var contentHtml = '';
        switch (currentTab) {
            case 'overview':
                contentHtml = renderOverviewTab(game);
                break;
            case 'commits':
                contentHtml = '<div class="stub-message">Commit history will appear here (Phase 2)</div>';
                break;
            case 'tests':
                contentHtml = '<div class="stub-message">Test results will appear here (Phase 5)</div>';
                break;
            case 'devnotes':
                contentHtml = '<div class="detail-notes">' + escapeHtml(game.devNotes || 'No dev notes.') + '</div>';
                break;
            case 'changelog':
                contentHtml = renderChangelogTab(game);
                break;
            case 'files':
                contentHtml = renderFilesTab(game);
                break;
        }

        return '<div class="studio-expand-inner">' +
            '<div class="studio-tabs">' + tabsHtml + '</div>' +
            '<div class="studio-tab-content" id="tab-content-' + game.id + '">' + contentHtml + '</div>' +
        '</div>';
    }

    function renderOverviewTab(game) {
        return '<div class="detail-overview">' +
            '<div class="detail-card">' +
                '<div class="detail-card-label">Engine</div>' +
                '<div class="detail-card-value">' + escapeHtml(game.engine) + '</div>' +
            '</div>' +
            '<div class="detail-card">' +
                '<div class="detail-card-label">Genre</div>' +
                '<div class="detail-card-value">' + escapeHtml(game.genre) + '</div>' +
            '</div>' +
            '<div class="detail-card">' +
                '<div class="detail-card-label">Phase</div>' +
                '<div class="detail-card-value">' + escapeHtml(game.phase) + '</div>' +
            '</div>' +
            '<div class="detail-card">' +
                '<div class="detail-card-label">Version</div>' +
                '<div class="detail-card-value">' + escapeHtml(game.version) + '</div>' +
            '</div>' +
            '<div class="detail-card">' +
                '<div class="detail-card-label">Completion</div>' +
                '<div class="detail-card-value">' + game.completion + '%</div>' +
            '</div>' +
            '<div class="detail-card">' +
                '<div class="detail-card-label">Last Commit</div>' +
                '<div class="detail-card-value">' + escapeHtml(game.health.lastCommit || 'N/A') + '</div>' +
            '</div>' +
        '</div>';
    }

    function renderChangelogTab(game) {
        if (!game.changelog || game.changelog.length === 0) {
            return '<div class="stub-message">No changelog entries.</div>';
        }
        var html = '<div class="changelog-list">';
        for (var i = 0; i < game.changelog.length; i++) {
            var entry = game.changelog[i];
            html += '<div class="changelog-entry">' +
                '<span class="changelog-date">' + escapeHtml(entry.date) + '</span>' +
                '<span class="changelog-text">' + escapeHtml(entry.text) + '</span>' +
            '</div>';
        }
        html += '</div>';
        return html;
    }

    function renderFilesTab(game) {
        var files = [
            { key: 'claudeMd', label: 'claude.md', icon: '\uD83D\uDCCB' },
            { key: 'gameDirection', label: 'game_direction.md', icon: '\uD83C\uDFAF' },
            { key: 'testPlan', label: 'tests/', icon: '\uD83E\uDDEA' },
            { key: 'achievements', label: 'achievements.json', icon: '\uD83C\uDFC6' }
        ];

        var html = '<div class="files-list">';
        for (var i = 0; i < files.length; i++) {
            var f = files[i];
            var path = game.files[f.key];
            var exists = !!path;
            html += '<div class="file-link' + (exists ? '' : ' disabled') + '" data-path="' + (path || '') + '">' +
                '<span class="file-link-icon">' + f.icon + '</span>' +
                '<span class="file-link-name">' + f.label + '</span>' +
                '<span class="file-link-status ' + (exists ? 'exists' : 'missing') + '">' +
                    (exists ? 'Found' : 'Missing') +
                '</span>' +
            '</div>';
        }
        html += '</div>';
        return html;
    }

    /* ============================================================
       EVENT DELEGATION — Tab clicks inside expanded panels
       ============================================================ */
    document.addEventListener('click', function (e) {
        var tabBtn = e.target.closest('.studio-tab');
        if (tabBtn && tabBtn.dataset.gameId) {
            var gameId = tabBtn.dataset.gameId;
            var tab = tabBtn.dataset.tab;
            activeTab[gameId] = tab;
            // Re-render just the expanded row
            renderGameList();
        }

        // File link clicks -> open preview
        var fileLink = e.target.closest('.file-link');
        if (fileLink && fileLink.dataset.path && !fileLink.classList.contains('disabled')) {
            if (typeof FilePreview !== 'undefined') {
                FilePreview.open(fileLink.dataset.path);
            }
        }
    });

    /* ============================================================
       GAME LAUNCHING
       ============================================================ */
    function launchGame(game) {
        // Build a game object compatible with GameView
        var launchData = {
            id: game.id,
            title: game.name,
            icon: game.icon,
            color: game.color,
            subtitle: game.genre
        };

        // Show launch animation
        var launchEl = document.createElement('div');
        launchEl.className = 'launch-overlay';
        launchEl.innerHTML =
            '<div class="launch-msg">' +
                '<span class="launch-icon">' + game.icon + '</span>' +
                '<h2>Launching ' + escapeHtml(game.name) + '...</h2>' +
                '<div class="launch-spinner"></div>' +
            '</div>';
        document.body.appendChild(launchEl);
        setTimeout(function () { launchEl.classList.add('visible'); }, 10);

        setTimeout(function () {
            GameView.launch(launchData);
            launchEl.classList.remove('visible');
            setTimeout(function () { launchEl.remove(); }, 500);
        }, 1200);
    }

    /* ============================================================
       SHOW / HIDE — Called when game view opens/closes
       ============================================================ */
    function show() {
        if (viewEl) viewEl.classList.remove('hidden');
    }

    function hide() {
        if (viewEl) viewEl.classList.add('hidden');
    }

    /* ============================================================
       DATA ACCESS
       ============================================================ */
    function getGames() { return games; }
    function findGame(id) {
        for (var i = 0; i < games.length; i++) {
            if (games[i].id === id) return games[i];
        }
        return null;
    }

    /* Replace games data (used when API is available) */
    function setGames(newGames) {
        games = newGames;
        renderGameList();
    }

    /* Update a game's health indicator */
    function updateGameHealth(gameId, health) {
        var game = findGame(gameId);
        if (game) {
            game.health = health;
            renderGameList();
        }
    }

    /* ============================================================
       KEYBOARD FOCUS
       ============================================================ */
    function setKeyboardFocus(rows, idx) {
        rows.forEach(function (r) { r.classList.remove('keyboard-focus'); });
        if (idx >= 0 && idx < rows.length) {
            rows[idx].classList.add('keyboard-focus');
            rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function clearKeyboardFocus() {
        document.querySelectorAll('.studio-row.keyboard-focus').forEach(function (r) {
            r.classList.remove('keyboard-focus');
        });
    }

    /* ============================================================
       UTILITIES
       ============================================================ */
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return {
        init: init,
        show: show,
        hide: hide,
        getGames: getGames,
        findGame: findGame,
        setGames: setGames,
        updateGameHealth: updateGameHealth,
        launchGame: launchGame,
        renderGameList: renderGameList
    };
})();
