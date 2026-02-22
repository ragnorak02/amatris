/* ============================================================
   background.js — Starry night sky background
   Renders procedural stars on a canvas layer.
   ============================================================ */

const Background = (() => {

    function init() {
        createStars();
        animateClouds();
    }

    /* Procedurally generate star dots on the background */
    function createStars() {
        const starLayer = document.getElementById('bg-stars');
        const count = 200;
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 2.5 + 0.5;
            star.style.width = size + 'px';
            star.style.height = size + 'px';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 70 + '%'; // keep stars in upper sky
            star.style.animationDelay = Math.random() * 4 + 's';
            star.style.animationDuration = (2 + Math.random() * 3) + 's';
            starLayer.appendChild(star);
        }
    }

    /* Cloud animation removed — tactical theme */
    function animateClouds() {
    }

    return { init };
})();
