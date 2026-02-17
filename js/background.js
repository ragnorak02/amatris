/* ============================================================
   background.js — Starry night sky, moon, and drifting clouds
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

    /* Drift clouds slowly across the screen */
    function animateClouds() {
        const cloudLayer = document.getElementById('bg-clouds');
        for (let i = 0; i < 5; i++) {
            const cloud = document.createElement('div');
            cloud.className = 'cloud';
            cloud.style.top = (10 + Math.random() * 40) + '%';
            cloud.style.animationDuration = (40 + Math.random() * 40) + 's';
            cloud.style.animationDelay = (-Math.random() * 60) + 's';
            cloud.style.opacity = 0.08 + Math.random() * 0.1;
            cloudLayer.appendChild(cloud);
        }
    }

    return { init };
})();
