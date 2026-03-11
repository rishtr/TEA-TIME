// ============================================================
// ui.js — UI helpers: fullscreen toggle
// Depends on: nothing
// ============================================================

/**
 * Toggle browser fullscreen mode.
 * Uses the standard Fullscreen API — works in all modern browsers.
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.warn('Fullscreen failed:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

// Update the button label/tooltip when entering or exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    const btn = document.getElementById('fullscreenBtn');
    btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
    btn.title       = document.fullscreenElement ? 'Exit Fullscreen' : 'Toggle Fullscreen';
});
