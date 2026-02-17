/* ============================================================
   gamepad.js — Xbox controller support for Hybrid Nights
   Polls the Gamepad API, maps inputs to launcher/overlay actions,
   and shows contextual Xbox button hints.
   ============================================================ */

const GamepadInput = (() => {
    /* ---- State ---- */
    let connected = false;
    let prevButtons = [];
    let prevAxes = [];
    let navRepeatTimer = 0;
    let overlayFocusIndex = -1;

    const NAV_REPEAT_MS = 200;
    const STICK_DEADZONE = 0.5;

    /* ---- DOM refs (set in init) ---- */
    let hintsEl = null;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        hintsEl = document.getElementById('gamepad-hints');

        window.addEventListener('gamepadconnected', (e) => {
            connected = true;
            updateHints();
            showHints(true);
        });

        window.addEventListener('gamepaddisconnected', () => {
            connected = false;
            showHints(false);
        });

        // Start polling loop
        requestAnimationFrame(poll);
    }

    /* ============================================================
       POLLING LOOP
       ============================================================ */
    function poll(timestamp) {
        requestAnimationFrame(poll);
        if (!connected) return;

        const gamepads = navigator.getGamepads();
        let gp = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) { gp = gamepads[i]; break; }
        }
        if (!gp) return;

        const buttons = gp.buttons.map(b => b.pressed);
        const axes = gp.axes.slice();

        // Rising-edge detection for buttons
        const justPressed = buttons.map((pressed, i) =>
            pressed && !(prevButtons[i] || false)
        );

        // Determine state
        const gameRunning = typeof GameView !== 'undefined' && GameView.isRunning();
        const overlayOpen = typeof Overlay !== 'undefined' && Overlay.isOverlayOpen();

        if (overlayOpen) {
            handleOverlayInput(justPressed, buttons, axes, timestamp);
        } else if (gameRunning) {
            handleGameplayInput(justPressed);
        } else {
            handleLauncherInput(justPressed, buttons, axes, timestamp);
        }

        prevButtons = buttons;
        prevAxes = axes;
    }

    /* ============================================================
       LAUNCHER INPUT
       ============================================================ */
    function handleLauncherInput(justPressed, buttons, axes, timestamp) {
        // A button (0) — launch focused game in studio list
        if (justPressed[0]) {
            var focusedRow = document.querySelector('.studio-row.gamepad-focus .launch-btn');
            if (focusedRow) focusedRow.click();
        }

        // D-pad Up/Down or left stick Y to navigate studio rows
        var up = justPressed[12];
        var down = justPressed[13];

        var stickY = axes[1] || 0;
        var stickUp = false;
        var stickDown = false;

        if (Math.abs(stickY) > STICK_DEADZONE) {
            if (timestamp - navRepeatTimer > NAV_REPEAT_MS) {
                stickUp = stickY < -STICK_DEADZONE;
                stickDown = stickY > STICK_DEADZONE;
                navRepeatTimer = timestamp;
            }
        } else {
            navRepeatTimer = 0;
        }

        // Navigate studio rows
        if (up || stickUp || down || stickDown) {
            var rows = document.querySelectorAll('.studio-row');
            if (rows.length === 0) return;
            var currentFocus = document.querySelector('.studio-row.gamepad-focus');
            var idx = -1;
            if (currentFocus) {
                for (var i = 0; i < rows.length; i++) {
                    if (rows[i] === currentFocus) { idx = i; break; }
                }
            }
            if (up || stickUp) idx = idx <= 0 ? rows.length - 1 : idx - 1;
            if (down || stickDown) idx = idx >= rows.length - 1 ? 0 : idx + 1;
            rows.forEach(function(r) { r.classList.remove('gamepad-focus'); });
            rows[idx].classList.add('gamepad-focus');
            rows[idx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        // X button (2) — run tests for focused game
        if (justPressed[2]) {
            var focused = document.querySelector('.studio-row.gamepad-focus .test-btn');
            if (focused) focused.click();
        }
    }

    /* ============================================================
       GAMEPLAY INPUT (game running, overlay closed)
       ============================================================ */
    function handleGameplayInput(justPressed) {
        // Menu/Start button (9) — open overlay
        if (justPressed[9]) {
            Overlay.toggle();
            overlayFocusIndex = -1;
            updateHints();
        }
    }

    /* ============================================================
       OVERLAY INPUT
       ============================================================ */
    function handleOverlayInput(justPressed, buttons, axes, timestamp) {
        const menuBtns = getOverlayMenuButtons();

        // B button (1) or Menu/Start (9) — close overlay
        if (justPressed[1] || justPressed[9]) {
            clearOverlayFocus(menuBtns);
            Overlay.close();
            updateHints();
            return;
        }

        // D-pad Up (12) / Down (13) — navigate menu
        const up = justPressed[12];
        const down = justPressed[13];

        // Left stick Y with repeat
        const stickY = axes[1] || 0;
        let stickUp = false;
        let stickDown = false;

        if (Math.abs(stickY) > STICK_DEADZONE) {
            if (timestamp - navRepeatTimer > NAV_REPEAT_MS) {
                stickUp = stickY < -STICK_DEADZONE;
                stickDown = stickY > STICK_DEADZONE;
                navRepeatTimer = timestamp;
            }
        } else {
            navRepeatTimer = 0;
        }

        if ((up || stickUp) && menuBtns.length > 0) {
            overlayFocusIndex = overlayFocusIndex <= 0
                ? menuBtns.length - 1
                : overlayFocusIndex - 1;
            applyOverlayFocus(menuBtns);
        }

        if ((down || stickDown) && menuBtns.length > 0) {
            overlayFocusIndex = overlayFocusIndex >= menuBtns.length - 1
                ? 0
                : overlayFocusIndex + 1;
            applyOverlayFocus(menuBtns);
        }

        // A button (0) — click focused menu item
        if (justPressed[0] && overlayFocusIndex >= 0 && menuBtns[overlayFocusIndex]) {
            menuBtns[overlayFocusIndex].click();
        }
    }

    /* ---- Overlay menu helpers ---- */
    function getOverlayMenuButtons() {
        const panel = document.querySelector('#overlay-menu .panel-content');
        if (!panel) return [];
        return Array.from(panel.querySelectorAll('.menu-btn'));
    }

    function applyOverlayFocus(menuBtns) {
        menuBtns.forEach((btn, i) => {
            btn.classList.toggle('gamepad-focus', i === overlayFocusIndex);
        });
    }

    function clearOverlayFocus(menuBtns) {
        overlayFocusIndex = -1;
        menuBtns.forEach(btn => btn.classList.remove('gamepad-focus'));
    }

    /* ============================================================
       BUTTON HINTS
       ============================================================ */
    function showHints(visible) {
        if (!hintsEl) return;
        hintsEl.classList.toggle('hidden', !visible);
    }

    function updateHints() {
        if (!hintsEl || !connected) return;

        const gameRunning = typeof GameView !== 'undefined' && GameView.isRunning();
        const overlayOpen = typeof Overlay !== 'undefined' && Overlay.isOverlayOpen();

        if (overlayOpen) {
            hintsEl.innerHTML = `
                <span class="gp-hint"><span class="xbox-btn xbox-a">A</span> Select</span>
                <span class="gp-hint"><span class="xbox-btn xbox-b">B</span> Back</span>
                <span class="gp-hint"><span class="xbox-btn xbox-dpad">D-pad</span> Navigate</span>
            `;
        } else if (!gameRunning) {
            hintsEl.innerHTML = `
                <span class="gp-hint"><span class="xbox-btn xbox-a">A</span> Launch</span>
                <span class="gp-hint"><span class="xbox-btn xbox-lb">LB</span><span class="xbox-btn xbox-rb">RB</span> Navigate</span>
            `;
        } else {
            // Game is running, overlay is closed — no hints (game has focus)
            hintsEl.innerHTML = '';
        }
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return { init, updateHints };
})();
