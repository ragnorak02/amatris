/* ============================================================
   main.js — Entry point. Initialize all modules on DOM ready.
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
    Background.init();
    Studio.init();
    if (typeof ClaudeTab !== 'undefined') ClaudeTab.init();
    if (typeof HunyuanTab !== 'undefined') HunyuanTab.init();
    if (typeof AudioTab !== 'undefined') AudioTab.init();
    FilePreview.init();
    Overlay.init();
    GamepadInput.init();
});
