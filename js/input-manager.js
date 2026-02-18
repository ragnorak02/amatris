/* ============================================================
   input-manager.js — Input abstraction layer for Amatris
   Semantic action pub/sub + context stack.
   Keyboard and gamepad both emit to the same bus.
   ============================================================ */

var InputManager = (function () {
    'use strict';

    /* ---- Semantic Actions ---- */
    var ACTIONS = {
        NAV_UP:    'NAV_UP',
        NAV_DOWN:  'NAV_DOWN',
        NAV_LEFT:  'NAV_LEFT',
        NAV_RIGHT: 'NAV_RIGHT',
        CONFIRM:   'CONFIRM',
        BACK:      'BACK',
        INFO:      'INFO',
        TAB_PREV:  'TAB_PREV',
        TAB_NEXT:  'TAB_NEXT',
        MENU:      'MENU'
    };

    /* ---- Pub/sub event bus ---- */
    var listeners = {};

    function on(action, callback) {
        if (!listeners[action]) listeners[action] = [];
        listeners[action].push(callback);
    }

    function off(action, callback) {
        if (!listeners[action]) return;
        listeners[action] = listeners[action].filter(function (cb) {
            return cb !== callback;
        });
    }

    function emit(action, data) {
        var cbs = listeners[action];
        if (!cbs) return;
        for (var i = 0; i < cbs.length; i++) {
            cbs[i](data || {});
        }
    }

    /* ---- Context stack ---- */
    var contextStack = ['launcher'];

    function pushContext(ctx) {
        contextStack.push(ctx);
    }

    function popContext() {
        if (contextStack.length > 1) {
            return contextStack.pop();
        }
        return contextStack[0];
    }

    function getContext() {
        return contextStack[contextStack.length - 1];
    }

    /* ---- Public API ---- */
    return {
        ACTIONS: ACTIONS,
        on: on,
        off: off,
        emit: emit,
        pushContext: pushContext,
        popContext: popContext,
        getContext: getContext
    };
})();
