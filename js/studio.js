/* ============================================================
   studio.js — Studio Dashboard for Amatris
   Sidebar + dense portrait card grid with InputManager wiring.
   ============================================================ */

var Studio = (function () {
    'use strict';

    /* ---- State ---- */
    var games = [];
    var selectedId = null;
    var activeTab = {};
    var searchQuery = '';
    var genreFilter = 'all';
    var engineFilter = 'all';
    var sortBy = 'name';
    var gridFocusIndex = -1;
    var lastSelectedPerTab = {};
    var currentNavTab = 'library';
    var CACHE_TTL = 30000;
    var runningPollTimer = null;
    var POLL_INTERVAL = 3000;

    /* ---- Genre categories ---- */
    var GENRE_MAP = [
        { key: 'all', label: 'All', icon: '\uD83C\uDFAE' },
        { key: 'rpg', label: 'RPG', icon: '\u2694\uFE0F' },
        { key: 'action', label: 'Action', icon: '\uD83D\uDCA5' },
        { key: 'adventure', label: 'Adventure', icon: '\uD83C\uDF0D' },
        { key: 'strategy', label: 'Strategy', icon: '\uD83C\uDFF0' }
    ];

    /* ---- Engine categories ---- */
    var ENGINE_MAP = [
        { key: 'all', label: 'All', icon: '\uD83D\uDCBB' },
        { key: 'godot', label: 'Godot', icon: '\uD83D\uDD35' },
        { key: 'unity', label: 'Unity', icon: '\u26AA' },
        { key: 'html', label: 'HTML5', icon: '\uD83C\uDF10' }
    ];

    /* ---- DOM refs ---- */
    var viewEl, listEl, detailEl, sidebarFiltersEl;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        viewEl = document.getElementById('studio-view');
        if (!viewEl) return;

        detailEl = document.getElementById('studio-detail-panel');
        sidebarFiltersEl = document.getElementById('sidebar-filters');

        renderToolbar();
        fetchGames();

        // Menu tab handler
        document.querySelectorAll('.menu-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                document.querySelectorAll('.menu-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
            });
        });

        // Keyboard navigation via InputManager
        document.addEventListener('keydown', function (e) {
            if (typeof GameView !== 'undefined' && GameView.isRunning()) return;
            if (typeof FilePreview !== 'undefined' && FilePreview.isOpen()) {
                if (e.key === 'Escape') { FilePreview.close(); e.preventDefault(); }
                return;
            }

            var ctx = InputManager.getContext();
            if (ctx !== 'launcher' && ctx !== 'detail_panel') return;

            // Search focus
            if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
                e.preventDefault();
                var searchEl = document.getElementById('studio-search');
                if (searchEl) searchEl.focus();
                return;
            }

            // Don't navigate if typing in search
            if (document.activeElement.tagName === 'INPUT') return;

            var A = InputManager.ACTIONS;

            switch (e.key) {
                case 'ArrowUp': case 'k':
                    e.preventDefault();
                    InputManager.emit(A.NAV_UP);
                    break;
                case 'ArrowDown': case 'j':
                    e.preventDefault();
                    InputManager.emit(A.NAV_DOWN);
                    break;
                case 'ArrowLeft': case 'h':
                    e.preventDefault();
                    InputManager.emit(A.NAV_LEFT);
                    break;
                case 'ArrowRight': case 'l':
                    e.preventDefault();
                    InputManager.emit(A.NAV_RIGHT);
                    break;
                case 'Enter':
                    e.preventDefault();
                    InputManager.emit(A.CONFIRM);
                    break;
                case 'Escape':
                    e.preventDefault();
                    InputManager.emit(A.BACK);
                    break;
                case 'i': case 'I':
                    if (!e.ctrlKey && !e.metaKey) {
                        e.preventDefault();
                        InputManager.emit(A.INFO);
                    }
                    break;
            }

            // Tab switching: Shift+Left/Right
            if (e.shiftKey && e.key === 'ArrowLeft') {
                e.preventDefault();
                InputManager.emit(A.TAB_PREV);
            } else if (e.shiftKey && e.key === 'ArrowRight') {
                e.preventDefault();
                InputManager.emit(A.TAB_NEXT);
            }
        });

        // Subscribe to InputManager actions
        var A = InputManager.ACTIONS;
        InputManager.on(A.NAV_UP, function () { navigateGrid('up'); });
        InputManager.on(A.NAV_DOWN, function () { navigateGrid('down'); });
        InputManager.on(A.NAV_LEFT, function () { navigateGrid('left'); });
        InputManager.on(A.NAV_RIGHT, function () { navigateGrid('right'); });
        InputManager.on(A.CONFIRM, function () {
            if (selectedId) {
                var game = findGame(selectedId);
                if (game) launchGame(game);
            }
        });
        InputManager.on(A.BACK, function () {
            closeDetailPanel();
        });
        InputManager.on(A.INFO, function () {
            if (selectedId) openDetailPanel();
        });
        InputManager.on(A.TAB_PREV, function () { cycleNavTab(-1); });
        InputManager.on(A.TAB_NEXT, function () { cycleNavTab(1); });

        // Start polling for running games
        startRunningPoll();

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
            .catch(function () {});
    }

    /* ============================================================
       FETCH GAMES
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
        } catch (e) {}

        fetch('/api/games')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                games = data;
                try {
                    sessionStorage.setItem('studio-games', JSON.stringify(games));
                    sessionStorage.setItem('studio-games-ts', String(Date.now()));
                } catch (e) {}
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
        renderSidebar();
        renderGameList();
    }

    /* ============================================================
       TOOLBAR
       ============================================================ */
    function renderToolbar() {
        var toolbarEl = document.getElementById('studio-toolbar');
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
            } catch (e) {}
            fetchGames();
        });

        document.getElementById('studio-run-all-tests').addEventListener('click', function () {
            if (typeof TestRunner !== 'undefined') {
                TestRunner.runAll();
            }
        });
    }

    /* ============================================================
       SIDEBAR — Engine + Genre filter sections
       ============================================================ */
    function renderSidebar() {
        if (!sidebarFiltersEl) return;

        var html = '';

        // Platform section
        html += '<div class="filter-section" id="filter-platforms">';
        html += '<div class="filter-section-header" data-section="platforms">';
        html += '<span class="filter-section-label">Platforms</span>';
        html += '<span class="filter-section-chevron">\u25BC</span>';
        html += '</div>';
        html += '<div class="filter-section-items">';
        for (var i = 0; i < ENGINE_MAP.length; i++) {
            var e = ENGINE_MAP[i];
            var eCount = e.key === 'all' ? games.length : countEngine(e.key);
            var eCls = 'filter-item' + (engineFilter === e.key ? ' active' : '');
            html += '<div class="' + eCls + '" data-filter-type="engine" data-filter-key="' + e.key + '">';
            html += '<span class="filter-item-icon">' + e.icon + '</span>';
            html += '<span class="filter-item-label">' + e.label + '</span>';
            html += '<span class="filter-item-count">' + eCount + '</span>';
            html += '</div>';
        }
        html += '</div></div>';

        // Genre section
        html += '<div class="filter-section" id="filter-genres">';
        html += '<div class="filter-section-header" data-section="genres">';
        html += '<span class="filter-section-label">Genres</span>';
        html += '<span class="filter-section-chevron">\u25BC</span>';
        html += '</div>';
        html += '<div class="filter-section-items">';
        for (var j = 0; j < GENRE_MAP.length; j++) {
            var g = GENRE_MAP[j];
            var gCount = g.key === 'all' ? games.length : countGenre(g.key);
            if (g.key !== 'all' && gCount === 0) continue;
            var gCls = 'filter-item' + (genreFilter === g.key ? ' active' : '');
            html += '<div class="' + gCls + '" data-filter-type="genre" data-filter-key="' + g.key + '">';
            html += '<span class="filter-item-icon">' + g.icon + '</span>';
            html += '<span class="filter-item-label">' + g.label + '</span>';
            html += '<span class="filter-item-count">' + gCount + '</span>';
            html += '</div>';
        }
        html += '</div></div>';

        sidebarFiltersEl.innerHTML = html;

        // Wire section collapse
        sidebarFiltersEl.querySelectorAll('.filter-section-header').forEach(function (header) {
            header.addEventListener('click', function () {
                header.parentElement.classList.toggle('collapsed');
            });
        });

        // Wire filter clicks
        sidebarFiltersEl.querySelectorAll('.filter-item').forEach(function (item) {
            item.addEventListener('click', function () {
                var type = item.dataset.filterType;
                var key = item.dataset.filterKey;
                if (type === 'engine') {
                    engineFilter = key;
                } else if (type === 'genre') {
                    genreFilter = key;
                }
                renderSidebar();
                renderGameList();

                // Keep selection if still visible
                var filtered = getFilteredGames();
                if (filtered.length > 0) {
                    var stillVisible = selectedId && filtered.some(function (g) { return g.id === selectedId; });
                    if (!stillVisible) {
                        selectGame(filtered[0].id);
                        gridFocusIndex = 0;
                    }
                } else {
                    selectedId = null;
                    gridFocusIndex = -1;
                    updateSelectionClasses();
                }
            });
        });
    }

    function countEngine(key) {
        var count = 0;
        for (var i = 0; i < games.length; i++) {
            if (games[i].engineType === key) count++;
        }
        return count;
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
       GAME LIST — Filter, sort, render cards
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
                default:
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
            listEl.classList.remove('has-selection');
            return;
        }

        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            html += renderCard(filtered[i]);
        }
        listEl.innerHTML = html;

        // Wire up card click events
        listEl.querySelectorAll('.game-card').forEach(function (card) {
            card.addEventListener('click', function () {
                selectGame(card.dataset.gameId);
                // Update gridFocusIndex to match
                var cards = document.querySelectorAll('.game-card');
                for (var ci = 0; ci < cards.length; ci++) {
                    if (cards[ci].dataset.gameId === card.dataset.gameId) {
                        gridFocusIndex = ci;
                        break;
                    }
                }
            });
            card.addEventListener('dblclick', function () {
                var game = findGame(card.dataset.gameId);
                if (game) launchGame(game);
            });
        });

        // Wire up Play/Info buttons
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

        updateSelectionClasses();
    }

    /* ============================================================
       CARD RENDERING
       ============================================================ */
    function renderCard(game) {
        var isSelected = selectedId === game.id;
        var cls = 'game-card' + (isSelected ? ' selected' : '');

        return '<div class="' + cls + '" data-game-id="' + game.id + '">' +
            '<div class="game-card-art" style="background: linear-gradient(160deg, ' + game.color + ' 0%, #0a0a1a 80%);">' +
                '<span>' + game.icon + '</span>' +
                '<div class="game-card-engine">' + escapeHtml(game.engineType) + '</div>' +
                '<div class="game-card-actions">' +
                    '<button class="card-action-btn play-btn" data-game-id="' + game.id + '">\u25B6</button>' +
                    '<button class="card-action-btn info-btn" data-game-id="' + game.id + '">\u2139</button>' +
                '</div>' +
            '</div>' +
            '<div class="game-card-info">' +
                '<div class="game-card-title">' + escapeHtml(game.name) + '</div>' +
                '<div class="game-card-subtitle">' + escapeHtml(game.genre) + '</div>' +
                '<div class="game-card-completion">' +
                    '<div class="game-card-bar"><div class="game-card-bar-fill" style="width:' + game.completion + '%"></div></div>' +
                    '<span class="game-card-pct">' + game.completion + '%</span>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    /* ============================================================
       GRID NAVIGATION — 2D with wrap-around
       ============================================================ */
    function navigateGrid(direction) {
        var cards = document.querySelectorAll('.game-card');
        if (cards.length === 0) return;

        var cols = getGridColumns();

        if (gridFocusIndex < 0) {
            gridFocusIndex = 0;
        } else {
            var col = gridFocusIndex % cols;
            var row = Math.floor(gridFocusIndex / cols);
            var totalRows = Math.ceil(cards.length / cols);

            switch (direction) {
                case 'right':
                    gridFocusIndex++;
                    if (gridFocusIndex >= cards.length) gridFocusIndex = 0;
                    break;
                case 'left':
                    gridFocusIndex--;
                    if (gridFocusIndex < 0) gridFocusIndex = cards.length - 1;
                    break;
                case 'down':
                    var downIdx = gridFocusIndex + cols;
                    if (downIdx >= cards.length) {
                        // Wrap to top of same column
                        gridFocusIndex = col < cards.length ? col : 0;
                    } else {
                        gridFocusIndex = downIdx;
                    }
                    break;
                case 'up':
                    var upIdx = gridFocusIndex - cols;
                    if (upIdx < 0) {
                        // Wrap to bottom of same column
                        var lastRowStart = (totalRows - 1) * cols;
                        var target = lastRowStart + col;
                        gridFocusIndex = target < cards.length ? target : cards.length - 1;
                    } else {
                        gridFocusIndex = upIdx;
                    }
                    break;
            }
        }

        setGridFocus(gridFocusIndex);
    }

    function setGridFocus(index) {
        var cards = document.querySelectorAll('.game-card');
        if (index < 0 || index >= cards.length) return;

        gridFocusIndex = index;
        var gameId = cards[index].dataset.gameId;
        selectGame(gameId);

        // Scroll into view
        cards[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function getGridColumns() {
        var list = document.getElementById('studio-game-list');
        if (!list) return 4;
        var style = window.getComputedStyle(list);
        var cols = style.getPropertyValue('grid-template-columns').split(' ').length;
        return cols || 4;
    }

    /* ============================================================
       TAB SWITCHING — LB/RB cycle through nav tabs
       ============================================================ */
    function cycleNavTab(dir) {
        var tabs = document.querySelectorAll('.menu-tab');
        if (tabs.length === 0) return;

        // Save current selection
        lastSelectedPerTab[currentNavTab] = selectedId;

        var currentIdx = -1;
        for (var i = 0; i < tabs.length; i++) {
            if (tabs[i].classList.contains('active')) {
                currentIdx = i;
                break;
            }
        }

        // Remove gamepad-focus from all
        tabs.forEach(function (t) { t.classList.remove('gamepad-focus'); });

        var newIdx = currentIdx + dir;
        if (newIdx < 0) newIdx = tabs.length - 1;
        if (newIdx >= tabs.length) newIdx = 0;

        switchNavTab(tabs[newIdx].dataset.tab);
    }

    function switchNavTab(tabName) {
        // Save current
        lastSelectedPerTab[currentNavTab] = selectedId;

        var tabs = document.querySelectorAll('.menu-tab');
        tabs.forEach(function (t) {
            t.classList.remove('active');
            t.classList.remove('gamepad-focus');
            if (t.dataset.tab === tabName) {
                t.classList.add('active');
                t.classList.add('gamepad-focus');
            }
        });

        currentNavTab = tabName;

        // Restore selection
        if (lastSelectedPerTab[tabName]) {
            var restored = lastSelectedPerTab[tabName];
            var filtered = getFilteredGames();
            var found = filtered.some(function (g) { return g.id === restored; });
            if (found) {
                selectGame(restored);
                // Find grid index
                var cards = document.querySelectorAll('.game-card');
                for (var i = 0; i < cards.length; i++) {
                    if (cards[i].dataset.gameId === restored) {
                        gridFocusIndex = i;
                        break;
                    }
                }
            }
        }
    }

    /* ============================================================
       SELECTION
       ============================================================ */
    function selectGame(gameId) {
        selectedId = gameId;
        if (!activeTab[gameId]) activeTab[gameId] = 'overview';
        updateSelectionClasses();
        renderDetailPanel();
    }

    function updateSelectionClasses() {
        var cards = document.querySelectorAll('.game-card');
        var hasSelection = !!selectedId;

        cards.forEach(function (card) {
            card.classList.toggle('selected', card.dataset.gameId === selectedId);
        });

        var list = document.getElementById('studio-game-list');
        if (list) {
            list.classList.toggle('has-selection', hasSelection);
        }
    }

    function openDetailPanel() {
        if (detailEl) {
            detailEl.classList.remove('hidden');
            detailEl.offsetHeight; // Trigger reflow
            detailEl.classList.add('open');
            InputManager.pushContext('detail_panel');
        }
    }

    function closeDetailPanel() {
        if (detailEl && detailEl.classList.contains('open')) {
            detailEl.classList.remove('open');
            setTimeout(function () {
                if (!detailEl.classList.contains('open')) {
                    detailEl.classList.add('hidden');
                }
            }, 300);
            if (InputManager.getContext() === 'detail_panel') {
                InputManager.popContext();
            }
        }
    }

    /* ============================================================
       DETAIL PANEL
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
            '<button class="detail-close-btn" id="detail-close-btn">&times;</button>' +
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
            renderTabBar(game, currentTab) +
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
        var closeBtn = document.getElementById('detail-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                closeDetailPanel();
            });
        }

        var launchBtn = detailEl.querySelector('.detail-action-btn.launch-btn');
        if (launchBtn) {
            launchBtn.addEventListener('click', function () {
                closeDetailPanel();
                launchGame(game);
            });
        }

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
       SHOW / HIDE
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
        closeDetailPanel: closeDetailPanel,
        navigateGrid: navigateGrid,
        setGridFocus: setGridFocus,
        getGridFocusIndex: function () { return gridFocusIndex; },
        getGridColumns: getGridColumns,
        switchNavTab: switchNavTab,
        getFilteredGames: getFilteredGames
    };
})();
