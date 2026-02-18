/* ============================================================
   overlay.js — In-game overlay system for Amatris
   Toggle with Shift+Tab. Single-screen layout with shortcut
   tile strip, instructions banner, game info, and expandable
   modules (volume, screen, screenshots, settings).
   ============================================================ */

const Overlay = (() => {
    /* ---- State ---- */
    let isOpen = false;
    let activeModule = null;
    let perfInterval = null;
    let fpsFrames = 0;
    let fpsLastTime = performance.now();
    let currentFps = 0;
    let tileFocusIndex = 0;

    /* ---- Settings (persisted to sessionStorage) ---- */
    let settings = loadSettings();

    function loadSettings() {
        try {
            const saved = sessionStorage.getItem('overlay-settings');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return { showPerf: true };
    }

    function saveSettings() {
        try { sessionStorage.setItem('overlay-settings', JSON.stringify(settings)); }
        catch (e) { /* ignore */ }
    }

    /* ---- Mock Data ---- */
    const SCREENSHOTS = [
        { id: 1, name: 'akma_boss_fight.png',     date: '2026-02-10' },
        { id: 2, name: 'hwarang_battlefield.png',  date: '2026-02-08' },
        { id: 3, name: 'mechwar_arena.png',        date: '2026-02-05' },
        { id: 4, name: 'strider_forest.png',       date: '2026-01-28' },
        { id: 5, name: 'akma_village.png',         date: '2026-01-20' },
        { id: 6, name: 'mechwar_hangar.png',       date: '2026-01-15' }
    ];

    /* ---- Volume State ---- */
    let volume = 80;
    let isMuted = false;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        // Hotkey: Shift+Tab
        window.addEventListener('keydown', (e) => {
            if (e.shiftKey && e.key === 'Tab') {
                e.preventDefault();
                if (GameView.isRunning()) toggle();
            }
            if (isOpen) {
                handleOverlayKeyboard(e);
            }
        });

        // Overlay toggle button
        const toggleBtn = document.getElementById('overlay-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                if (GameView.isRunning()) toggle();
            });
        }

        // Shortcut tile clicks
        document.querySelectorAll('.shortcut-tile').forEach(tile => {
            tile.addEventListener('click', () => {
                const mod = tile.dataset.module;
                if (mod === 'game') {
                    close();
                    return;
                }
                if (activeModule === mod) {
                    closeModule();
                } else {
                    openModule(mod);
                }
            });
        });

        // Apply saved settings
        applySettings();

        // Start FPS counter (runs always, used when overlay is open)
        requestAnimationFrame(fpsLoop);
    }

    /* ============================================================
       KEYBOARD HANDLER (WASD + Arrow + Escape + Enter/Space)
       ============================================================ */
    function handleOverlayKeyboard(e) {
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                close();
                break;
            case 'a':
            case 'A':
            case 'ArrowLeft':
                e.preventDefault();
                moveTileFocus(-1);
                break;
            case 'd':
            case 'D':
            case 'ArrowRight':
                e.preventDefault();
                moveTileFocus(1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                activateFocusedTile();
                break;
        }
    }

    /* ============================================================
       TILE FOCUS — Keyboard / gamepad navigation
       ============================================================ */
    function getTiles() {
        return document.querySelectorAll('#shortcut-strip .shortcut-tile');
    }

    function moveTileFocus(dir) {
        var tiles = getTiles();
        if (tiles.length === 0) return;
        tileFocusIndex += dir;
        if (tileFocusIndex < 0) tileFocusIndex = tiles.length - 1;
        if (tileFocusIndex >= tiles.length) tileFocusIndex = 0;
        applyTileFocus();
    }

    function applyTileFocus() {
        var tiles = getTiles();
        for (var i = 0; i < tiles.length; i++) {
            tiles[i].classList.toggle('focused', i === tileFocusIndex);
        }
    }

    function activateFocusedTile() {
        var tiles = getTiles();
        if (tileFocusIndex >= 0 && tileFocusIndex < tiles.length) {
            tiles[tileFocusIndex].click();
        }
    }

    /* ============================================================
       TOGGLE / OPEN / CLOSE
       ============================================================ */
    function toggle() {
        if (isOpen) close(); else open();
    }

    function open() {
        if (isOpen) return;
        isOpen = true;

        const overlay = document.getElementById('overlay');
        overlay.classList.remove('hidden');

        // Populate game info area
        populateGameInfo();

        // Set initial tile focus
        tileFocusIndex = 0;
        applyTileFocus();

        // Instant appear
        overlay.offsetHeight;
        overlay.classList.add('visible');

        // Start performance polling
        updatePerformance();
        perfInterval = setInterval(updatePerformance, 2000);

        // Apply panel visibility from settings
        applySettings();
    }

    function close() {
        if (!isOpen) return;
        isOpen = false;

        const overlay = document.getElementById('overlay');
        overlay.classList.remove('visible');

        // Short fade-out then hide
        setTimeout(() => {
            if (!isOpen) {
                overlay.classList.add('hidden');
                closeModule();
            }
        }, 150);

        // Stop performance polling
        if (perfInterval) {
            clearInterval(perfInterval);
            perfInterval = null;
        }
    }

    function isOverlayOpen() { return isOpen; }

    /* ============================================================
       GAME INFO — Populate center game display on open
       ============================================================ */
    function populateGameInfo() {
        var infoEl = document.getElementById('overlay-game-info');
        if (!infoEl) return;

        var game = GameView.getCurrentGame();
        if (!game) {
            infoEl.style.display = 'none';
            return;
        }
        infoEl.style.display = '';

        var data = (typeof Studio !== 'undefined' && Studio.findGame(game.id)) || game;
        var gameName = data.name || data.title || 'Unknown';
        var icon = data.icon || '\uD83C\uDFAE';
        var embedded = GameView.isGameEmbedded();
        var mode = embedded ? 'Running in embedded frame' : 'Running in separate window';

        var iconEl = infoEl.querySelector('.game-info-icon');
        var nameEl = infoEl.querySelector('.game-info-name');
        var modeEl = infoEl.querySelector('.game-info-mode');

        if (iconEl) iconEl.textContent = icon;
        if (nameEl) nameEl.textContent = gameName;
        if (modeEl) modeEl.textContent = mode;
    }

    /* ============================================================
       MODULES — Open / close center module panel
       ============================================================ */
    function openModule(name) {
        // "game" tile returns to game
        if (name === 'game') {
            close();
            return;
        }

        activeModule = name;

        // Update active tile highlight
        document.querySelectorAll('.shortcut-tile').forEach(t => {
            t.classList.toggle('active', t.dataset.module === name);
        });

        const panel = document.getElementById('module-content');
        panel.innerHTML = '';

        // Render module content
        switch (name) {
            case 'volume':      renderVolume(panel); break;
            case 'screen':      renderScreen(panel); break;
            case 'screenshots': renderScreenshots(panel); break;
            case 'settings':    renderSettings(panel); break;
        }

        panel.classList.remove('hidden');
        panel.offsetHeight;
        panel.classList.add('module-visible');
    }

    function closeModule() {
        activeModule = null;

        document.querySelectorAll('.shortcut-tile').forEach(t => t.classList.remove('active'));

        const panel = document.getElementById('module-content');
        panel.classList.remove('module-visible');
        setTimeout(() => {
            if (!activeModule) {
                panel.classList.add('hidden');
                panel.innerHTML = '';
            }
        }, 200);
    }

    /* ============================================================
       VOLUME MODULE
       ============================================================ */
    function renderVolume(container) {
        container.innerHTML = `
            <div class="module-header"><h2>Volume</h2></div>
            <div class="module-body">
                <div class="volume-control">
                    <div class="volume-main">
                        <button class="mute-btn ${isMuted ? 'muted' : ''}" id="mute-toggle">
                            ${isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A'}
                        </button>
                        <div class="volume-slider-wrap">
                            <div class="volume-slider-label">
                                <span>Master Volume</span>
                                <span id="volume-pct">${isMuted ? 'Muted' : volume + '%'}</span>
                            </div>
                            <input type="range" class="volume-slider" id="volume-range"
                                   min="0" max="100" value="${isMuted ? 0 : volume}">
                        </div>
                    </div>
                </div>
            </div>
        `;

        const slider = document.getElementById('volume-range');
        const pct = document.getElementById('volume-pct');
        const muteBtn = document.getElementById('mute-toggle');

        slider.addEventListener('input', () => {
            volume = parseInt(slider.value);
            isMuted = volume === 0;
            pct.textContent = isMuted ? 'Muted' : volume + '%';
            muteBtn.textContent = isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
            muteBtn.classList.toggle('muted', isMuted);
            applyVolume();
        });

        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            muteBtn.textContent = isMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
            muteBtn.classList.toggle('muted', isMuted);
            slider.value = isMuted ? 0 : volume;
            pct.textContent = isMuted ? 'Muted' : volume + '%';
            applyVolume();
        });
    }

    function applyVolume() {
        const iframe = document.getElementById('game-iframe');
        if (iframe && GameView.isGameEmbedded()) {
            try {
                const effectiveVol = isMuted ? 0 : volume / 100;
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.querySelectorAll('audio, video').forEach(el => {
                    el.volume = effectiveVol;
                    el.muted = isMuted;
                });
            } catch (e) { /* cross-origin */ }
        }
    }

    /* ============================================================
       SCREEN MODULE — Fullscreen toggle
       ============================================================ */
    function renderScreen(container) {
        var isFs = !!document.fullscreenElement;
        container.innerHTML =
            '<div class="module-header"><h2>Screen</h2></div>' +
            '<div class="module-body">' +
                '<div class="screen-control">' +
                    '<button class="screen-fs-btn" id="fs-toggle">' +
                        (isFs ? '\u2716 Exit Fullscreen' : '\u26F6 Enter Fullscreen') +
                    '</button>' +
                    '<p class="screen-hint">Toggle fullscreen mode for the launcher window</p>' +
                '</div>' +
            '</div>';

        document.getElementById('fs-toggle').addEventListener('click', function () {
            if (document.fullscreenElement) {
                document.exitFullscreen().then(function () {
                    renderScreen(container);
                }).catch(function () {});
            } else {
                document.documentElement.requestFullscreen().then(function () {
                    renderScreen(container);
                }).catch(function () {});
            }
        });
    }

    /* ============================================================
       SCREENSHOTS MODULE
       ============================================================ */
    function renderScreenshots(container) {
        const items = SCREENSHOTS.map(ss => `
            <div class="screenshot-item" data-id="${ss.id}">
                <div class="screenshot-thumb">\uD83D\uDDBC</div>
                <div class="screenshot-name" title="${ss.name}">${ss.name}</div>
                <div class="screenshot-actions">
                    <button class="ss-action-btn view" title="View">\uD83D\uDC41</button>
                    <button class="ss-action-btn rename" title="Rename">\u270F</button>
                    <button class="ss-action-btn delete" title="Delete">\uD83D\uDDD1</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="module-header"><h2>Screenshots</h2></div>
            <div class="module-body">
                <div class="screenshots-toolbar">
                    <span>${SCREENSHOTS.length} screenshots</span>
                    <button class="open-folder-btn" id="open-ss-folder">
                        \uD83D\uDCC1 Open Folder
                    </button>
                </div>
                <div class="screenshots-grid">${items}</div>
            </div>
        `;

        document.getElementById('open-ss-folder').addEventListener('click', () => {
            fetch('/open-folder/screenshots', { method: 'POST' }).catch(() => {});
        });

        container.querySelectorAll('.ss-action-btn.view').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.screenshot-item');
                const name = item.querySelector('.screenshot-name').textContent;
                alert(`Viewing: ${name}\n(Full viewer coming in Phase 2)`);
            });
        });

        container.querySelectorAll('.ss-action-btn.rename').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nameEl = btn.closest('.screenshot-item').querySelector('.screenshot-name');
                const newName = prompt('Rename screenshot:', nameEl.textContent);
                if (newName && newName.trim()) nameEl.textContent = newName.trim();
            });
        });

        container.querySelectorAll('.ss-action-btn.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = btn.closest('.screenshot-item');
                if (confirm('Delete this screenshot?')) {
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.8)';
                    item.style.transition = 'all 0.3s';
                    setTimeout(() => item.remove(), 300);
                }
            });
        });
    }

    /* ============================================================
       SETTINGS MODULE
       ============================================================ */
    function renderSettings(container) {
        container.innerHTML = `
            <div class="module-header"><h2>Settings</h2></div>
            <div class="module-body">
                <div class="settings-list">
                    <div class="setting-row">
                        <div>
                            <div class="setting-label">Show Performance</div>
                            <div class="setting-desc">Bottom-left performance panel</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="setting-perf" ${settings.showPerf ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('setting-perf').addEventListener('change', (e) => {
            settings.showPerf = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    function applySettings() {
        const perf = document.getElementById('overlay-perf');
        if (perf) perf.style.display = settings.showPerf ? '' : 'none';
    }

    /* ============================================================
       PERFORMANCE PANEL — FPS + system stats
       ============================================================ */
    function fpsLoop(timestamp) {
        fpsFrames++;
        if (timestamp - fpsLastTime >= 1000) {
            currentFps = fpsFrames;
            fpsFrames = 0;
            fpsLastTime = timestamp;
        }
        requestAnimationFrame(fpsLoop);
    }

    function updatePerformance() {
        const fpsEl = document.getElementById('perf-fps');
        if (fpsEl) {
            fpsEl.textContent = currentFps;
            fpsEl.className = 'perf-value ' + (currentFps >= 50 ? 'good' : currentFps >= 30 ? 'warn' : 'bad');
        }

        fetch('/system-stats')
            .then(r => r.json())
            .then(data => {
                const cpuEl = document.getElementById('perf-cpu');
                const ramEl = document.getElementById('perf-ram');

                if (cpuEl) {
                    cpuEl.textContent = data.cpu + '%';
                    cpuEl.className = 'perf-value ' + (data.cpu < 60 ? 'good' : data.cpu < 85 ? 'warn' : 'bad');
                }
                if (ramEl) {
                    const usedGB = (data.ramUsed / 1024).toFixed(1);
                    const totalGB = (data.ramTotal / 1024).toFixed(1);
                    ramEl.textContent = `${usedGB} / ${totalGB} GB`;
                }
            })
            .catch(() => {
                const cpuEl = document.getElementById('perf-cpu');
                const ramEl = document.getElementById('perf-ram');
                if (cpuEl) cpuEl.textContent = '--';
                if (ramEl) ramEl.textContent = '--';
            });
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return {
        init,
        toggle,
        open,
        close,
        isOverlayOpen,
        moveTileFocus,
        activateFocusedTile
    };
})();
