/* ============================================================
   overlay.js — In-game overlay system for Hybrid Nights
   Toggle with Shift+Tab. Contains shortcut strip, game menu,
   performance panel, and expandable modules (friends, volume,
   screenshots, settings).
   ============================================================ */

const Overlay = (() => {
    /* ---- State ---- */
    let isOpen = false;
    let activeModule = null;
    let perfInterval = null;
    let fpsFrames = 0;
    let fpsLastTime = performance.now();
    let currentFps = 0;

    /* ---- Settings (persisted to sessionStorage) ---- */
    let settings = loadSettings();

    function loadSettings() {
        try {
            const saved = sessionStorage.getItem('overlay-settings');
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return { showMenu: true, showPerf: true };
    }

    function saveSettings() {
        try { sessionStorage.setItem('overlay-settings', JSON.stringify(settings)); }
        catch (e) { /* ignore */ }
    }

    /* ---- Mock Data ---- */
    const FRIENDS = [
        { name: 'ShadowBlade',   avatar: '⚔',  status: 'playing', detail: 'Playing Akma' },
        { name: 'NightRunnerX',  avatar: '🌙', status: 'online',  detail: 'Online' },
        { name: 'MechPilot99',   avatar: '🤖', status: 'away',    detail: 'Away — 15 min' },
        { name: 'GhostWalker',   avatar: '👻', status: 'offline', detail: 'Last seen 3 days ago' }
    ];

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
            // Escape closes overlay
            if (e.key === 'Escape' && isOpen) {
                e.preventDefault();
                close();
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
                if (activeModule === mod) {
                    closeModule();
                } else {
                    openModule(mod);
                }
            });
        });

        // Menu button clicks
        document.querySelectorAll('.menu-btn').forEach(btn => {
            btn.addEventListener('click', () => handleMenuAction(btn.dataset.action));
        });

        // Collapse panel buttons
        document.querySelectorAll('.collapse-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const panelId = btn.dataset.panel;
                const panel = document.getElementById(`overlay-${panelId}`);
                if (panel) panel.classList.toggle('collapsed');
            });
        });

        // Apply saved settings
        applySettings();

        // Start FPS counter (runs always, used when overlay is open)
        requestAnimationFrame(fpsLoop);
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
        // Trigger reflow for animation
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

        // Wait for fade-out, then hide
        setTimeout(() => {
            if (!isOpen) {
                overlay.classList.add('hidden');
                closeModule();
            }
        }, 300);

        // Stop performance polling
        if (perfInterval) {
            clearInterval(perfInterval);
            perfInterval = null;
        }
    }

    function isOverlayOpen() { return isOpen; }

    /* ============================================================
       MODULES — Open / close center module panel
       ============================================================ */
    function openModule(name) {
        activeModule = name;

        // Update active tile highlight
        document.querySelectorAll('.shortcut-tile').forEach(t => {
            t.classList.toggle('active', t.dataset.module === name);
        });

        const panel = document.getElementById('module-content');
        panel.innerHTML = '';

        // Render module content
        switch (name) {
            case 'game':        renderGamePreview(panel); break;
            case 'volume':      renderVolume(panel); break;
            case 'friends':     renderFriends(panel); break;
            case 'screenshots': renderScreenshots(panel); break;
            case 'settings':    renderSettings(panel); break;
        }

        panel.classList.remove('hidden');
        // Trigger reflow for animation
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
        }, 250);
    }

    /* ============================================================
       GAME PREVIEW MODULE
       ============================================================ */
    function renderGamePreview(container) {
        const game = GameView.getCurrentGame();
        if (!game) return;

        // Find the full game data from Studio API
        var data = (typeof Studio !== 'undefined' && Studio.findGame(game.id)) || game;

        var gameName = data.name || data.title || 'Unknown';
        var gameSubtitle = data.genre || data.subtitle || '';
        var gameEngine = data.engine || '';
        var gameVersion = data.version || '';
        var gameCompletion = data.completion != null ? data.completion + '%' : 'N/A';

        container.innerHTML =
            '<div class="module-header"><h2>Current Game</h2></div>' +
            '<div class="module-body">' +
                '<div class="game-preview">' +
                    '<div class="game-preview-art" style="background: linear-gradient(135deg, ' + (data.color || '#2c1a4a') + ', #0a0a1a);">' +
                        '<span class="preview-icon">' + (data.icon || '\uD83C\uDFAE') + '</span>' +
                    '</div>' +
                    '<div class="game-preview-info">' +
                        '<h3>' + gameName + '</h3>' +
                        '<div class="preview-subtitle">' + gameSubtitle + '</div>' +
                        '<div class="preview-stats">' +
                            '<div class="preview-stat">' +
                                '<span class="stat-key">Engine</span>' +
                                '<span class="stat-val">' + gameEngine + '</span>' +
                            '</div>' +
                            '<div class="preview-stat">' +
                                '<span class="stat-key">Version</span>' +
                                '<span class="stat-val">' + gameVersion + '</span>' +
                            '</div>' +
                            '<div class="preview-stat">' +
                                '<span class="stat-key">Completion</span>' +
                                '<span class="stat-val">' + gameCompletion + '</span>' +
                            '</div>' +
                            '<div class="preview-stat">' +
                                '<span class="stat-key">Mode</span>' +
                                '<span class="stat-val">' + (GameView.isGameEmbedded() ? 'Embedded' : 'External') + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="game-preview-tests" id="overlay-test-results"></div>' +
            '</div>';

        // Render test results if available
        if (typeof TestRunner !== 'undefined') {
            var testContainer = container.querySelector('#overlay-test-results');
            if (testContainer) {
                TestRunner.renderOverlayResults(data.id, testContainer);
            }
        }
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
                            ${isMuted ? '🔇' : '🔊'}
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

        // Wire up volume controls
        const slider = document.getElementById('volume-range');
        const pct = document.getElementById('volume-pct');
        const muteBtn = document.getElementById('mute-toggle');

        slider.addEventListener('input', () => {
            volume = parseInt(slider.value);
            isMuted = volume === 0;
            pct.textContent = isMuted ? 'Muted' : volume + '%';
            muteBtn.textContent = isMuted ? '🔇' : '🔊';
            muteBtn.classList.toggle('muted', isMuted);
            applyVolume();
        });

        muteBtn.addEventListener('click', () => {
            isMuted = !isMuted;
            muteBtn.textContent = isMuted ? '🔇' : '🔊';
            muteBtn.classList.toggle('muted', isMuted);
            slider.value = isMuted ? 0 : volume;
            pct.textContent = isMuted ? 'Muted' : volume + '%';
            applyVolume();
        });
    }

    function applyVolume() {
        // Apply volume to embedded game iframe if possible
        const iframe = document.getElementById('game-iframe');
        if (iframe && GameView.isGameEmbedded()) {
            try {
                const effectiveVol = isMuted ? 0 : volume / 100;
                // Try to control audio elements inside same-origin iframe
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                iframeDoc.querySelectorAll('audio, video').forEach(el => {
                    el.volume = effectiveVol;
                    el.muted = isMuted;
                });
            } catch (e) { /* cross-origin — can't control */ }
        }
    }

    /* ============================================================
       FRIENDS MODULE
       ============================================================ */
    function renderFriends(container) {
        const entries = FRIENDS.map(f => `
            <div class="friend-entry" data-status="${f.status}">
                <div class="friend-avatar">${f.avatar}</div>
                <div class="friend-info">
                    <div class="friend-name">${f.name}</div>
                    <div class="friend-status status-${f.status}">${f.detail}</div>
                </div>
                <button class="friend-action-btn">${f.status === 'playing' ? 'Join' : 'Message'}</button>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="module-header"><h2>Friends</h2></div>
            <div class="module-body">
                <div class="friends-list">${entries}</div>
            </div>
        `;
    }

    /* ============================================================
       SCREENSHOTS MODULE
       ============================================================ */
    function renderScreenshots(container) {
        const items = SCREENSHOTS.map(ss => `
            <div class="screenshot-item" data-id="${ss.id}">
                <div class="screenshot-thumb">🖼</div>
                <div class="screenshot-name" title="${ss.name}">${ss.name}</div>
                <div class="screenshot-actions">
                    <button class="ss-action-btn view" title="View">👁</button>
                    <button class="ss-action-btn rename" title="Rename">✏</button>
                    <button class="ss-action-btn delete" title="Delete">🗑</button>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="module-header"><h2>Screenshots</h2></div>
            <div class="module-body">
                <div class="screenshots-toolbar">
                    <span>${SCREENSHOTS.length} screenshots</span>
                    <button class="open-folder-btn" id="open-ss-folder">
                        📁 Open Folder
                    </button>
                </div>
                <div class="screenshots-grid">${items}</div>
            </div>
        `;

        // Wire up open folder
        document.getElementById('open-ss-folder').addEventListener('click', () => {
            fetch('/open-folder/screenshots', { method: 'POST' }).catch(() => {});
        });

        // Wire up screenshot actions
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
                            <div class="setting-label">Show Game Menu</div>
                            <div class="setting-desc">Top-left overlay menu panel</div>
                        </div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="setting-menu" ${settings.showMenu ? 'checked' : ''}>
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
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

        document.getElementById('setting-menu').addEventListener('change', (e) => {
            settings.showMenu = e.target.checked;
            saveSettings();
            applySettings();
        });

        document.getElementById('setting-perf').addEventListener('change', (e) => {
            settings.showPerf = e.target.checked;
            saveSettings();
            applySettings();
        });
    }

    function applySettings() {
        const menu = document.getElementById('overlay-menu');
        const perf = document.getElementById('overlay-perf');
        if (menu) menu.style.display = settings.showMenu ? '' : 'none';
        if (perf) perf.style.display = settings.showPerf ? '' : 'none';
    }

    /* ============================================================
       MENU ACTIONS
       ============================================================ */
    function handleMenuAction(action) {
        switch (action) {
            case 'resume':
                close();
                break;

            case 'restart':
                close();
                GameView.restart();
                break;

            case 'launcher':
                close();
                GameView.close();
                break;

            case 'run-tests':
                if (typeof TestRunner !== 'undefined') {
                    var game = GameView.getCurrentGame();
                    if (game) {
                        // Open the game module to show test results
                        openModule('game');
                        // Run tests and update the display when done
                        TestRunner.runForGame(game.id, function () {
                            // Re-render game preview to show results
                            if (activeModule === 'game') {
                                openModule('game');
                            }
                        });
                    }
                }
                break;

            case 'close-game':
                close();
                GameView.close();
                break;

            case 'exit':
                if (confirm('Exit the launcher?')) {
                    GameView.close();
                    // Attempt to close the window
                    window.close();
                    // Fallback message if window.close() doesn't work
                    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#807860;font-size:1.2rem;">You can close this tab now.</div>';
                }
                break;
        }
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
        // Update FPS display
        const fpsEl = document.getElementById('perf-fps');
        if (fpsEl) {
            fpsEl.textContent = currentFps;
            fpsEl.className = 'perf-value ' + (currentFps >= 50 ? 'good' : currentFps >= 30 ? 'warn' : 'bad');
        }

        // Fetch system stats from server
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
    return { init, toggle, open, close, isOverlayOpen };
})();
