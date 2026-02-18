/* ============================================================
   gamepad.js — Xbox controller support for Amatris
   Polls the Gamepad API, emits semantic actions via InputManager.
   Context-aware routing: launcher, detail_panel, gameplay, overlay.
   ============================================================ */

var GamepadInput = (function () {
    'use strict';

    /* ---- Named button constants ---- */
    var BTN_A     = 0;
    var BTN_B     = 1;
    var BTN_X     = 2;
    var BTN_Y     = 3;
    var BTN_LB    = 4;
    var BTN_RB    = 5;
    var BTN_START = 9;
    var BTN_DPAD_UP    = 12;
    var BTN_DPAD_DOWN  = 13;
    var BTN_DPAD_LEFT  = 14;
    var BTN_DPAD_RIGHT = 15;

    /* ---- State ---- */
    var connected = false;
    var prevButtons = [];
    var navRepeatTimer = 0;

    var NAV_REPEAT_MS = 180;
    var STICK_DEADZONE = 0.5;

    /* ---- Hold-Y state ---- */
    var yHoldStart = 0;
    var Y_HOLD_THRESHOLD = 1000;

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

        var ctx = InputManager.getContext();

        switch (ctx) {
            case 'overlay':
                handleOverlayInput(justPressed, buttons, axes, timestamp);
                break;
            case 'gameplay':
                handleGameplayInput(justPressed, buttons, timestamp);
                break;
            default: // launcher, detail_panel
                handleLauncherInput(justPressed, buttons, axes, timestamp);
                break;
        }

        prevButtons = buttons;
    }

    /* ============================================================
       DIRECTIONAL INPUT HELPER
       ============================================================ */
    function getDirections(justPressed, axes, timestamp) {
        var up    = justPressed[BTN_DPAD_UP] || false;
        var down  = justPressed[BTN_DPAD_DOWN] || false;
        var left  = justPressed[BTN_DPAD_LEFT] || false;
        var right = justPressed[BTN_DPAD_RIGHT] || false;

        var stickX = axes[0] || 0;
        var stickY = axes[1] || 0;

        if (Math.abs(stickX) > STICK_DEADZONE || Math.abs(stickY) > STICK_DEADZONE) {
            if (timestamp - navRepeatTimer > NAV_REPEAT_MS) {
                if (stickY < -STICK_DEADZONE) up = true;
                if (stickY > STICK_DEADZONE)  down = true;
                if (stickX < -STICK_DEADZONE) left = true;
                if (stickX > STICK_DEADZONE)  right = true;
                navRepeatTimer = timestamp;
            }
        } else if (!up && !down && !left && !right) {
            navRepeatTimer = 0;
        }

        return { up: up, down: down, left: left, right: right };
    }

    /* ============================================================
       LAUNCHER / DETAIL_PANEL INPUT
       D-pad/stick → NAV_*, A→CONFIRM, B→BACK, Y→INFO,
       LB→TAB_PREV, RB→TAB_NEXT, Start→MENU
       ============================================================ */
    function handleLauncherInput(justPressed, buttons, axes, timestamp) {
        var A = InputManager.ACTIONS;
        var dir = getDirections(justPressed, axes, timestamp);

        if (dir.up)    InputManager.emit(A.NAV_UP);
        if (dir.down)  InputManager.emit(A.NAV_DOWN);
        if (dir.left)  InputManager.emit(A.NAV_LEFT);
        if (dir.right) InputManager.emit(A.NAV_RIGHT);

        if (justPressed[BTN_A])     InputManager.emit(A.CONFIRM);
        if (justPressed[BTN_B])     InputManager.emit(A.BACK);
        if (justPressed[BTN_Y])     InputManager.emit(A.INFO);
        if (justPressed[BTN_LB])    InputManager.emit(A.TAB_PREV);
        if (justPressed[BTN_RB])    InputManager.emit(A.TAB_NEXT);
        if (justPressed[BTN_START]) InputManager.emit(A.MENU);
    }

    /* ============================================================
       GAMEPLAY INPUT — Start opens overlay, hold-Y exits game
       ============================================================ */
    function handleGameplayInput(justPressed, buttons, timestamp) {
        if (justPressed[BTN_START]) {
            if (typeof Overlay !== 'undefined') Overlay.toggle();
        }

        // Hold Y — exit game
        if (buttons[BTN_Y]) {
            if (yHoldStart === 0) yHoldStart = timestamp;
            if (timestamp - yHoldStart >= Y_HOLD_THRESHOLD) {
                yHoldStart = 0;
                if (typeof Overlay !== 'undefined') Overlay.close();
                if (typeof GameView !== 'undefined') GameView.close();
            }
        } else {
            yHoldStart = 0;
        }
    }

    /* ============================================================
       OVERLAY INPUT — B/Start close, D-pad nav, A activate, hold-Y exit
       ============================================================ */
    function handleOverlayInput(justPressed, buttons, axes, timestamp) {
        if (justPressed[BTN_B] || justPressed[BTN_START]) {
            if (typeof Overlay !== 'undefined') Overlay.close();
            return;
        }

        // Hold Y — exit game
        if (buttons[BTN_Y]) {
            if (yHoldStart === 0) yHoldStart = timestamp;
            if (timestamp - yHoldStart >= Y_HOLD_THRESHOLD) {
                yHoldStart = 0;
                if (typeof Overlay !== 'undefined') Overlay.close();
                if (typeof GameView !== 'undefined') GameView.close();
            }
        } else {
            yHoldStart = 0;
        }

        var dir = getDirections(justPressed, axes, timestamp);

        if (dir.left && typeof Overlay !== 'undefined')  Overlay.moveTileFocus(-1);
        if (dir.right && typeof Overlay !== 'undefined') Overlay.moveTileFocus(1);

        if (justPressed[BTN_A] && typeof Overlay !== 'undefined') {
            Overlay.activateFocusedTile();
        }
    }

    /* ============================================================
       PUBLIC API
       ============================================================ */
    return { init: init };
})();
