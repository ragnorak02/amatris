/* ============================================================
   game-view.js — Manages the active game view
   Handles embedding HTML games in an iframe and showing an
   external-game screen for native (Godot) games.
   ============================================================ */

var GameView = (function () {
    var currentGame = null;
    var isEmbedded = false;

    var view = document.getElementById('game-view');
    var iframe = document.getElementById('game-iframe');
    var external = document.getElementById('game-external');

    /* Launch a game: fetch config from server, then embed or show external */
    function launch(game) {
        currentGame = game;

        // Hide launcher UI
        document.getElementById('portal-header').classList.add('hidden');
        document.getElementById('studio-view').classList.add('hidden');
        document.getElementById('top-menu').classList.add('hidden');

        // Show game view
        view.classList.remove('hidden');

        // Show overlay toggle hint
        var toggle = document.getElementById('overlay-toggle');
        if (toggle) toggle.classList.remove('hidden');

        // Request launch from server
        fetch('/launch/' + game.id)
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.type === 'html' && data.embedUrl) {
                    showEmbedded(game, data.embedUrl);
                } else if (data.status === 'launched') {
                    showExternal(game);
                } else if (data.status === 'placeholder') {
                    showExternal(game, data.message);
                } else if (data.error) {
                    showExternal(game, data.error);
                }
            })
            .catch(function () {
                showExternal(game, 'Failed to connect to server.');
            });
    }

    function showEmbedded(game, url) {
        isEmbedded = true;
        iframe.src = url;
        iframe.classList.remove('hidden');
        external.classList.add('hidden');
    }

    function showExternal(game, message) {
        isEmbedded = false;
        iframe.classList.add('hidden');
        external.classList.remove('hidden');

        external.querySelector('.external-icon').textContent = game.icon;
        external.querySelector('.external-title').textContent = game.title;

        var subtitle = external.querySelector('.external-subtitle');
        subtitle.textContent = message || 'Running in separate window';
    }

    /* Close the game and return to the Studio dashboard */
    function close() {
        var wasGame = currentGame;
        currentGame = null;
        isEmbedded = false;

        // Clear iframe
        iframe.src = '';
        iframe.classList.add('hidden');
        external.classList.add('hidden');
        view.classList.add('hidden');

        // Hide overlay toggle
        var toggle = document.getElementById('overlay-toggle');
        if (toggle) toggle.classList.add('hidden');

        // Close the overlay if open
        if (typeof Overlay !== 'undefined') Overlay.close();

        // Tell server to close the game process if external
        if (wasGame) {
            fetch('/close-game/' + wasGame.id, { method: 'POST' }).catch(function () {});
        }

        // Show launcher UI
        document.getElementById('portal-header').classList.remove('hidden');
        document.getElementById('studio-view').classList.remove('hidden');
        document.getElementById('top-menu').classList.remove('hidden');
    }

    /* Restart the current game */
    function restart() {
        if (!currentGame) return;
        var game = currentGame;

        // Close current, then relaunch
        fetch('/close-game/' + game.id, { method: 'POST' })
            .catch(function () {})
            .finally(function () {
                iframe.src = '';
                launch(game);
            });
    }

    /* Getters */
    function getCurrentGame() { return currentGame; }
    function isRunning() { return currentGame !== null; }
    function isGameEmbedded() { return isEmbedded; }

    return { launch: launch, close: close, restart: restart, getCurrentGame: getCurrentGame, isRunning: isRunning, isGameEmbedded: isGameEmbedded };
})();
