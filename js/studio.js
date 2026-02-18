/* ============================================================
   studio.js — Studio Dashboard for Amatris
   Steam-style two-column layout: game list sidebar + detail panel.
   ============================================================ */

var Studio = (function () {
    'use strict';

    /* ---- State ---- */
    var games = [];
    var selectedId = null;
    var activeTab = {};
    var searchQuery = '';
    var genreFilter = 'all';
    var sortBy = 'name';
    var CACHE_TTL = 30000; // 30s sessionStorage cache
    var runningPollTimer = null;
    var POLL_INTERVAL = 3000; // 3s polling for running games

    /* ---- Genre categories ---- */
    var GENRE_MAP = [
        { key: 'all', label: 'All' },
        { key: 'rpg', label: 'RPG' },
        { key: 'action', label: 'Action' },
        { key: 'adventure', label: 'Adventure' },
        { key: 'strategy', label: 'Strategy' }
    ];

    /* ---- DOM refs ---- */
    var viewEl, toolbarEl, listEl, detailEl, genreTabsEl;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        viewEl = document.getElementById('studio-view');
        if (!viewEl) return;

        detailEl = document.getElementById('studio-detail-panel');
        genreTabsEl = document.getElementById('genre-tabs');

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
            if (typeof GameView !== 'undefined' && GameView.isRunning()) return;
            if (typeof FilePreview !== 'undefined' && FilePreview.isOpen()) {
                if (e.key === 'Escape') { FilePreview.close(); e.preventDefault(); }
                return;
            }

            var cards = document.querySelectorAll('.game-card');
            if (cards.length === 0) return;

            var idx = -1;
            if (selectedId) {
                for (var i = 0; i < cards.length; i++) {
                    if (cards[i].dataset.gameId === selectedId) { idx = i; break; }
                }
            }

            if (e.key === 'ArrowDown' || e.key === 'j') {
                e.preventDefault();
                idx = idx >= cards.length - 1 ? 0 : idx + 1;
                selectGame(cards[idx].dataset.gameId);
                cards[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else if (e.key === 'ArrowUp' || e.key === 'k') {
                e.preventDefault();
                idx = idx <= 0 ? cards.length - 1 : idx - 1;
                selectGame(cards[idx].dataset.gameId);
                cards[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else if (e.key === 'Enter' && selectedId) {
                e.preventDefault();
                var game = findGame(selectedId);
                if (game) launchGame(game);
            } else if (e.key === 'Escape') {
                closeDetailPanel();
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
                var cards = document.querySelectorAll('.game-card');
                cards.forEach(function (card) {
                    var gameId = card.dataset.gameId;
                    var isRunning = running.hasOwnProperty(gameId);
                    card.classList.toggle('running', isRunning);
                });

                // Update detail panel launch button if selected game state changed
                if (selectedId && running.hasOwnProperty(selectedId)) {
                    var btn = detailEl ? detailEl.querySelector('.detail-action-btn.launch-btn') : null;
                    if (btn) {
                        btn.innerHTML = '\u25A0 Stop';
                        btn.title = 'Stop Game';
                    }
                } else if (selectedId) {
                    var btn2 = detailEl ? detailEl.querySelector('.detail-action-btn.launch-btn') : null;
                    if (btn2 && btn2.textContent.indexOf('Stop') !== -1) {
                        btn2.innerHTML = '\u25B6 Launch';
                        btn2.title = 'Launch';
                    }
                }
            })
            .catch(function () { /* ignore network errors */ });
    }

    /* ============================================================
       FETCH GAMES — From /api/games with sessionStorage cache
       ============================================================ */
    function fetchGames(callback) {
        try {
            var cached = sessionStorage.getItem('studio-games');
            var cacheTime = parseInt(sessionStorage.getItem('studio-games-ts') || '0');
            if (cached && (Date.now() - cacheTime) < CACHE_TTL) {
                games = JSON.parse(cached);
                onGamesLoaded();
                if (callback) callback();
                return;
            }
        } catch (e) { /* ignore */ }

        fetch('/api/games')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                games = data;
                try {
                    sessionStorage.setItem('studio-games', JSON.stringify(games));
                    sessionStorage.setItem('studio-games-ts', String(Date.now()));
                } catch (e) { /* ignore */ }
                onGamesLoaded();
                if (callback) callback();
            })
            .catch(function () {
                games = [];
                onGamesLoaded();
                if (callback) callback();
            });
    }

    function onGamesLoaded() {
        renderGenreTabs();
        renderGameList();
    }

    /* ============================================================
       TOOLBAR — Search, sort, refresh, run all tests
       ============================================================ */
    function renderToolbar() {
        toolbarEl = document.getElementById('studio-toolbar');
        if (!toolbarEl) return;

        toolbarEl.innerHTML =
            '<div class="toolbar-left">' +
                '<div class="search-wrap">' +
                    '<input type="text" class="studio-search" id="studio-search" placeholder="Search..." />' +
                '</div>' +
                '<select class="studio-select" id="studio-sort">' +
                    '<option value="name">Name</option>' +
                    '<option value="completion">Completion</option>' +
                    '<option value="engine">Engine</option>' +
                    '<option value="phase">Phase</option>' +
                '</select>' +
                '<span class="game-count" id="studio-game-count"></span>' +
            '</div>' +
            '<div class="toolbar-right">' +
                '<button class="toolbar-btn primary" id="studio-run-all-tests" title="Run All Tests">' +
                    '\u25B6 Tests' +
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

        document.getElementById('studio-sort').addEventListener('change', function (e) {
            sortBy = e.target.value;
            renderGameList();
        });

        document.getElementById('studio-refresh').addEventListener('click', function () {
            try {
                sessionStorage.removeItem('studio-games');
                sessionStorage.removeItem('studio-games-ts');
            } catch (e) { /* ignore */ }
            fetchGames();
        });

        document.getElementById('studio-run-all-tests').addEventListener('click', function () {
            if (typeof TestRunner !== 'undefined') {
                TestRunner.runAll();
            }
        });
    }

    /* ============================================================
       GENRE TABS — Dynamic pill-style filter tabs
       ============================================================ */
    function renderGenreTabs() {
        if (!genreTabsEl) return;

        var html = '';
        for (var i = 0; i < GENRE_MAP.length; i++) {
            var g = GENRE_MAP[i];
            // Count matching games for this genre
            var count = g.key === 'all' ? games.length : countGenre(g.key);
            if (g.key !== 'all' && count === 0) continue;
            var cls = 'genre-tab' + (genreFilter === g.key ? ' active' : '');
            html += '<button class="' + cls + '" data-genre="' + g.key + '">' +
                g.label + '</button>';
        }
        genreTabsEl.innerHTML = html;

        // Wire up genre tab clicks
        genreTabsEl.querySelectorAll('.genre-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                genreFilter = tab.dataset.genre;
                renderGenreTabs();
                renderGameList();
                // Re-select first visible game
                var filtered = getFilteredGames();
                if (filtered.length > 0) {
                    var stillVisible = selectedId && filtered.some(function (g) { return g.id === selectedId; });
                    if (!stillVisible) {
                        selectGame(filtered[0].id);
                    }
                } else {
                    selectedId = null;
                    renderDetailPanel();
                }
            });
        });
    }

    function countGenre(key) {
        var count = 0;
        for (var i = 0; i < games.length; i++) {
            if (matchesGenre(games[i], key)) count++;
        }
        return count;
    }

    function matchesGenre(game, key) {
        if (key === 'all') return true;
        var g = game.genre.toLowerCase();
        switch (key) {
            case 'rpg': return g.indexOf('rpg') !== -1;
            case 'action': return g.indexOf('action') !== -1 || g.indexOf('fighter') !== -1 || g.indexOf('platform') !== -1;
            case 'adventure': return g.indexOf('adventure') !== -1 || g.indexOf('fishing') !== -1;
            case 'strategy': return g.indexOf('tactics') !== -1 || g.indexOf('defense') !== -1 || g.indexOf('tower') !== -1;
            default: return true;
        }
    }

    /* ============================================================
       GAME LIST — Filter, sort, render cards in sidebar
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

            // Genre filter
            if (genreFilter !== 'all' && !matchesGenre(g, genreFilter)) return false;

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
            countEl.textContent = filtered.length + '/' + games.length;
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
            html += renderCard(filtered[i]);
        }
        listEl.innerHTML = html;

        // Wire up card click events
        listEl.querySelectorAll('.game-card').forEach(function (card) {
            card.addEventListener('dblclick', function () {
                var game = findGame(card.dataset.gameId);
                if (game) launchGame(game);
            });
        });

        // Wire up Play/Info buttons on hover
        listEl.querySelectorAll('.card-action-btn.play-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var game = findGame(btn.dataset.gameId);
                if (game) launchGame(game);
            });
        });
        listEl.querySelectorAll('.card-action-btn.info-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                selectGame(btn.dataset.gameId);
                openDetailPanel();
            });
        });
    }

    /* ============================================================
       CARD RENDERING — Game card in sidebar
       ============================================================ */
    function renderCard(game) {
        var isSelected = selectedId === game.id;
        var cls = 'game-card' + (isSelected ? ' selected' : '');

        return '<div class="' + cls + '" data-game-id="' + game.id + '">' +
            '<div class="game-card-art" style="background: linear-gradient(160deg, ' + game.color + ' 0%, #0a0a1a 80%);">' +
                '<span>' + game.icon + '</span>' +
                '<div class="game-card-engine">' + escapeHtml(game.engineType) + '</div>' +
            '</div>' +
            '<div class="game-card-info">' +
                '<div class="game-card-title">' + escapeHtml(game.name) + '</div>' +
                '<div class="game-card-subtitle">' + escapeHtml(game.genre) + '</div>' +
                '<div class="game-card-completion">' +
                    '<div class="game-card-bar"><div class="game-card-bar-fill" style="width:' + game.completion + '%"></div></div>' +
                    '<span class="game-card-pct">' + game.completion + '%</span>' +
                '</div>' +
            '</div>' +
            '<div class="game-card-actions">' +
                '<button class="card-action-btn play-btn" data-game-id="' + game.id + '">\u25B6 Play</button>' +
                '<button class="card-action-btn info-btn" data-game-id="' + game.id + '">\u2139 Info</button>' +
            '</div>' +
        '</div>';
    }

    /* ============================================================
       SELECTION — Click card to select + populate detail panel
       ============================================================ */
    function selectGame(gameId) {
        selectedId = gameId;
        if (!activeTab[gameId]) activeTab[gameId] = 'overview';
        highlightSelectedCard();
        renderDetailPanel();
    }

    function openDetailPanel() {
        if (detailEl) {
            detailEl.classList.remove('hidden');
            // Trigger reflow for animation
            detailEl.offsetHeight;
            detailEl.classList.add('open');
        }
    }

    function closeDetailPanel() {
        if (detailEl) {
            detailEl.classList.remove('open');
            setTimeout(function () {
                if (!detailEl.classList.contains('open')) {
                    detailEl.classList.add('hidden');
                }
            }, 300);
        }
        selectedId = null;
        highlightSelectedCard();
    }

    function highlightSelectedCard() {
        var cards = document.querySelectorAll('.game-card');
        cards.forEach(function (card) {
            card.classList.toggle('selected', card.dataset.gameId === selectedId);
        });
    }

    /* ============================================================
       DETAIL PANEL — Right column with game info + tabs
       ============================================================ */
    function renderDetailPanel() {
        if (!detailEl) return;

        if (!selectedId) {
            detailEl.innerHTML =
                '<div class="detail-empty-state">' +
                    '<div class="detail-empty-icon">\uD83C\uDFAE</div>' +
                    '<div class="detail-empty-text">Select a game to view details</div>' +
                '</div>';
            return;
        }

        var game = findGame(selectedId);
        if (!game) return;

        var healthDot = game.health.tests.status || 'gray';
        var healthText = healthDot === 'green' ? 'Pass' :
                         healthDot === 'orange' ? 'Warn' :
                         healthDot === 'red' ? 'Fail' : 'N/A';

        var currentTab = activeTab[game.id] || 'overview';

        detailEl.innerHTML =
            // Close button
            '<button class="detail-close-btn" id="detail-close-btn">&times;</button>' +
            // Header banner
            '<div class="detail-header">' +
                '<div class="detail-header-bg" style="background: linear-gradient(135deg, ' + game.color + ', #0a0a1a);"></div>' +
                '<div class="detail-header-icon">' + game.icon + '</div>' +
                '<div class="detail-header-content">' +
                    '<div class="detail-header-title">' + escapeHtml(game.name) + '</div>' +
                    '<div class="detail-header-meta">' +
                        '<span>' + escapeHtml(game.engine) + '</span>' +
                        '<span>\u2022</span>' +
                        '<span>' + escapeHtml(game.genre) + '</span>' +
                        '<span>\u2022</span>' +
                        '<span>' + escapeHtml(game.phase) + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            // Info bar: completion + actions
            '<div class="detail-info-bar">' +
                '<div class="detail-completion">' +
                    '<span class="detail-completion-label">Progress</span>' +
                    '<div class="detail-completion-bar"><div class="detail-completion-fill" style="width:' + game.completion + '%"></div></div>' +
                    '<span class="detail-completion-pct">' + game.completion + '%</span>' +
                '</div>' +
                '<div class="detail-actions">' +
                    '<button class="detail-action-btn launch-btn" data-game-id="' + game.id + '">\u25B6 Launch</button>' +
                    '<button class="detail-action-btn test-btn" data-game-id="' + game.id + '">\u2714 Test</button>' +
                '</div>' +
            '</div>' +
            // Stats row
            '<div class="detail-stats">' +
                '<div class="detail-stat">' +
                    '<div class="detail-stat-label">Version</div>' +
                    '<div class="detail-stat-value">' + escapeHtml(game.version) + '</div>' +
                '</div>' +
                '<div class="detail-stat">' +
                    '<div class="detail-stat-label">Health</div>' +
                    '<div class="detail-stat-value"><span class="health-dot ' + healthDot + '"></span>' + healthText + '</div>' +
                '</div>' +
                '<div class="detail-stat">' +
                    '<div class="detail-stat-label">Last Commit</div>' +
                    '<div class="detail-stat-value">' + escapeHtml(game.health.lastCommit || 'N/A') + '</div>' +
                '</div>' +
                '<div class="detail-stat">' +
                    '<div class="detail-stat-label">Tags</div>' +
                    '<div class="detail-stat-value">' + renderTags(game) + '</div>' +
                '</div>' +
            '</div>' +
            // Tabs
            renderTabBar(game, currentTab) +
            // Tab content
            '<div class="studio-tab-content" id="tab-content-' + game.id + '">' +
                renderTabContent(game, currentTab) +
            '</div>';

        wireDetailEvents(game);
    }

    function renderTags(game) {
        var html = '';
        for (var t = 0; t < game.tags.length && t < 3; t++) {
            html += '<span class="studio-tag">' + escapeHtml(game.tags[t]) + '</span>';
        }
        return html || '<span style="color:#605848">None</span>';
    }

    function renderTabBar(game, currentTab) {
        var tabs = ['overview', 'commits', 'tests', 'devnotes', 'changelog', 'files'];
        var tabLabels = { overview: 'Overview', commits: 'Commits', tests: 'Tests', devnotes: 'Dev Notes', changelog: 'Changelog', files: 'Files' };

        var html = '<div class="studio-tabs">';
        for (var i = 0; i < tabs.length; i++) {
            var cls = 'studio-tab' + (tabs[i] === currentTab ? ' active' : '');
            html += '<button class="' + cls + '" data-tab="' + tabs[i] + '" data-game-id="' + game.id + '">' +
                tabLabels[tabs[i]] + '</button>';
        }
        html += '</div>';
        return html;
    }

    function renderTabContent(game, tab) {
        switch (tab) {
            case 'overview':
                return renderOverviewTab(game);
            case 'commits':
                return '<div class="stub-message">Commit history will appear here</div>';
            case 'tests':
                return '<div class="stub-message">Test results will appear here</div>';
            case 'devnotes':
                return '<div class="detail-notes">' + escapeHtml(game.devNotes || 'No dev notes.') + '</div>';
            case 'changelog':
                return renderChangelogTab(game);
            case 'files':
                return renderFilesTab(game);
            default:
                return '';
        }
    }

    function wireDetailEvents(game) {
        // Close button
        var closeBtn = document.getElementById('detail-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                closeDetailPanel();
            });
        }

        // Launch button
        var launchBtn = detailEl.querySelector('.detail-action-btn.launch-btn');
        if (launchBtn) {
            launchBtn.addEventListener('click', function () {
                closeDetailPanel();
                launchGame(game);
            });
        }

        // Test button
        var testBtn = detailEl.querySelector('.detail-action-btn.test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', function () {
                if (typeof TestRunner !== 'undefined') {
                    TestRunner.runForGame(game.id);
                }
            });
        }
    }

    /* ============================================================
       TAB CONTENT RENDERERS
       ============================================================ */
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
            var filePath = game.files[f.key];
            var exists = !!filePath;
            html += '<div class="file-link' + (exists ? '' : ' disabled') + '" data-path="' + (filePath || '') + '">' +
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
       EVENT DELEGATION — Tab clicks + file link clicks
       ============================================================ */
    document.addEventListener('click', function (e) {
        var tabBtn = e.target.closest('.studio-tab');
        if (tabBtn && tabBtn.dataset.gameId) {
            var gameId = tabBtn.dataset.gameId;
            var tab = tabBtn.dataset.tab;
            activeTab[gameId] = tab;
            renderDetailPanel();
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

    function setGames(newGames) {
        games = newGames;
        renderGameList();
    }

    function updateGameHealth(gameId, health) {
        var game = findGame(gameId);
        if (game) {
            game.health = health;
            if (selectedId === gameId) renderDetailPanel();
        }
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
        renderGameList: renderGameList,
        closeDetailPanel: closeDetailPanel
    };
})();
