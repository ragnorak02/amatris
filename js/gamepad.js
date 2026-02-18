/* ============================================================
   gamepad.js — Xbox controller support for Amatris
   Polls the Gamepad API, maps inputs to launcher/overlay actions.
   Navigates the 2D game grid with D-pad/stick, A=play, X=info.
   ============================================================ */

var GamepadInput = (function () {
    'use strict';

    /* ---- State ---- */
    var connected = false;
    var prevButtons = [];
    var navRepeatTimer = 0;
    var rightStickRepeatTimer = 0;
    var overlayFocusIndex = -1;
    var gridFocusIndex = -1;
    var cardMenuIndex = -1; // -1=none, 0=Play, 1=Info

    var NAV_REPEAT_MS = 180;
    var STICK_DEADZONE = 0.5;

    /* ============================================================
       INIT
       ============================================================ */
    function init() {
        window.addEventListener('gamepadconnected', function () {
            connected = true;
        });

        window.addEventListener('gamepaddisconnected', function () {
            connected = false;
        });

        requestAnimationFrame(poll);
    }

    /* ============================================================
       POLLING LOOP
       ============================================================ */
    function poll(timestamp) {
        requestAnimationFrame(poll);
        if (!connected) return;

        var gamepads = navigator.getGamepads();
        var gp = null;
        for (var i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) { gp = gamepads[i]; break; }
        }
        if (!gp) return;

        var buttons = [];
        for (var b = 0; b < gp.buttons.length; b++) {
            buttons[b] = gp.buttons[b].pressed;
        }
        var axes = gp.axes.slice();

        // Rising-edge detection
        var justPressed = [];
        for (var j = 0; j < buttons.length; j++) {
            justPressed[j] = buttons[j] && !(prevButtons[j] || false);
        }

        var gameRunning = typeof GameView !== 'undefined' && GameView.isRunning();
        var overlayOpen = typeof Overlay !== 'undefined' && Overlay.isOverlayOpen();

        if (overlayOpen) {
            handleOverlayInput(justPressed, buttons, axes, timestamp);
        } else if (gameRunning) {
            handleGameplayInput(justPressed);
        } else {
            handleLauncherInput(justPressed, buttons, axes, timestamp);
        }

        prevButtons = buttons;
    }

    /* ============================================================
       DIRECTIONAL INPUT HELPER
       Returns { up, down, left, right } with repeat logic
       ============================================================ */
    function getDirections(justPressed, axes, timestamp) {
        var up = justPressed[12] || false;
        var down = justPressed[13] || false;
        var left = justPressed[14] || false;
        var right = justPressed[15] || false;

        var stickX = axes[0] || 0;
        var stickY = axes[1] || 0;

        if (Math.abs(stickX) > STICK_DEADZONE || Math.abs(stickY) > STICK_DEADZONE) {
            if (timestamp - navRepeatTimer > NAV_REPEAT_MS) {
                if (stickY < -STICK_DEADZONE) up = true;
                if (stickY > STICK_DEADZONE) down = true;
                if (stickX < -STICK_DEADZONE) left = true;
                if (stickX > STICK_DEADZONE) right = true;
                navRepeatTimer = timestamp;
            }
        } else if (!up && !down && !left && !right) {
            navRepeatTimer = 0;
        }

        return { up: up, down: down, left: left, right: right };
    }

    /* ============================================================
       LAUNCHER INPUT — 2D grid navigation
       Left stick / D-pad = navigate grid
       Right stick = navigate card menu (Play / Info)
       A = confirm card menu selection (or Play if no menu selection)
       ============================================================ */
    function handleLauncherInput(justPressed, buttons, axes, timestamp) {
        var cards = document.querySelectorAll('.game-card');
        if (cards.length === 0) return;

        var dir = getDirections(justPressed, axes, timestamp);

        // Calculate grid dimensions
        var cols = getGridColumns();

        // Left stick / D-pad — navigate the grid
        if (dir.up || dir.down || dir.left || dir.right) {
            // Reset card menu when moving to a new card
            cardMenuIndex = -1;
            clearCardMenuFocus();

            if (gridFocusIndex < 0) {
                gridFocusIndex = 0;
            } else {
                var col = gridFocusIndex % cols;

                if (dir.right) {
                    gridFocusIndex = gridFocusIndex + 1;
                    if (gridFocusIndex >= cards.length) gridFocusIndex = 0;
                }
                if (dir.left) {
                    gridFocusIndex = gridFocusIndex - 1;
                    if (gridFocusIndex < 0) gridFocusIndex = cards.length - 1;
                }
                if (dir.down) {
                    var newIdx = gridFocusIndex + cols;
                    if (newIdx >= cards.length) {
                        gridFocusIndex = col < cards.length ? col : 0;
                    } else {
                        gridFocusIndex = newIdx;
                    }
                }
                if (dir.up) {
                    var newIdx2 = gridFocusIndex - cols;
                    if (newIdx2 < 0) {
                        var lastRowStart = Math.floor((cards.length - 1) / cols) * cols;
                        var target = lastRowStart + col;
                        gridFocusIndex = target < cards.length ? target : cards.length - 1;
                    } else {
                        gridFocusIndex = newIdx2;
                    }
                }
            }

            applyGridFocus(cards);
        }

        // Right stick — navigate card menu (Play / Info) on focused card
        if (gridFocusIndex >= 0 && gridFocusIndex < cards.length) {
            var rsX = axes[2] || 0;
            var rsY = axes[3] || 0;
            var rsMoved = false;

            if (Math.abs(rsX) > STICK_DEADZONE || Math.abs(rsY) > STICK_DEADZONE) {
                if (timestamp - rightStickRepeatTimer > NAV_REPEAT_MS) {
                    if (rsX > STICK_DEADZONE || rsY > STICK_DEADZONE) {
                        // Right or down -> next menu item
                        cardMenuIndex = cardMenuIndex >= 1 ? 0 : cardMenuIndex + 1;
                        rsMoved = true;
                    } else if (rsX < -STICK_DEADZONE || rsY < -STICK_DEADZONE) {
                        // Left or up -> prev menu item
                        cardMenuIndex = cardMenuIndex <= 0 ? 1 : cardMenuIndex - 1;
                        rsMoved = true;
                    }
                    rightStickRepeatTimer = timestamp;
                }
            } else {
                rightStickRepeatTimer = 0;
            }

            if (rsMoved) {
                applyCardMenuFocus(cards[gridFocusIndex]);
            }
        }

        // A button (0) — confirm: click focused menu button, or default to Play
        if (justPressed[0] && gridFocusIndex >= 0 && gridFocusIndex < cards.length) {
            var focusedCard = cards[gridFocusIndex];
            if (cardMenuIndex === 1) {
                var infoBtn = focusedCard.querySelector('.card-action-btn.info-btn');
                if (infoBtn) infoBtn.click();
            } else {
                // Default or cardMenuIndex === 0 -> Play
                var playBtn = focusedCard.querySelector('.card-action-btn.play-btn');
                if (playBtn) playBtn.click();
            }
        }

        // B button (1) — close detail panel if open
        if (justPressed[1]) {
            if (typeof Studio !== 'undefined' && typeof Studio.closeDetailPanel === 'function') {
                Studio.closeDetailPanel();
            }
        }
    }

    function applyCardMenuFocus(card) {
        if (!card) return;
        var btns = card.querySelectorAll('.card-action-btn');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('gamepad-focus', i === cardMenuIndex);
        }
    }

    function clearCardMenuFocus() {
        var focused = document.querySelectorAll('.card-action-btn.gamepad-focus');
        for (var i = 0; i < focused.length; i++) {
            focused[i].classList.remove('gamepad-focus');
        }
    }

    function getGridColumns() {
        var list = document.getElementById('studio-game-list');
        if (!list) return 4;
        var style = window.getComputedStyle(list);
        var cols = style.getPropertyValue('grid-template-columns').split(' ').length;
        return cols || 4;
    }

    function applyGridFocus(cards) {
        for (var i = 0; i < cards.length; i++) {
            cards[i].classList.toggle('gamepad-focus', i === gridFocusIndex);
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
        }
    }

    /* ============================================================
       OVERLAY INPUT
       ============================================================ */
    function handleOverlayInput(justPressed, buttons, axes, timestamp) {
        var menuBtns = getOverlayMenuButtons();

        // B button (1) or Start (9) — close overlay
        if (justPressed[1] || justPressed[9]) {
            clearOverlayFocus(menuBtns);
            Overlay.close();
            return;
        }

        var dir = getDirections(justPressed, axes, timestamp);

        if (dir.up && menuBtns.length > 0) {
            overlayFocusIndex = overlayFocusIndex <= 0
                ? menuBtns.length - 1
                : overlayFocusIndex - 1;
            applyOverlayFocus(menuBtns);
        }

        if (dir.down && menuBtns.length > 0) {
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

    function getOverlayMenuButtons() {
        var panel = document.querySelector('#overlay-menu .panel-content');
        if (!panel) return [];
        return Array.from(panel.querySelectorAll('.menu-btn'));
    }

    function applyOverlayFocus(menuBtns) {
        for (var i = 0; i < menuBtns.length; i++) {
            menuBtns[i].classList.toggle('gamepad-focus', i === overlayFocusIndex);
        }
    }

    function clearOverlayFocus(menuBtns) {
        overlayFocusIndex = -1;
        for (var i = 0; i < menuBtns.length; i++) {
            menuBtns[i].classList.remove('gamepad-focus');
        }
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return { init: init };
})();
