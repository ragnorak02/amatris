/* ============================================================
   main.js — Entry point. Initialize all modules on DOM ready.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
    Background.init();
    Studio.init();
    FilePreview.init();
    Overlay.init();
    GamepadInput.init();
});
