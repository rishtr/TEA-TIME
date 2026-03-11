// ============================================================
// game.js — Core game logic: pick flow, history, reset,
//           confetti, pixel particles, score bar, and startup.
// Depends on: config.js, storage.js, physics.js
// ============================================================

// ── Game State ───────────────────────────────────────────────

let balls       = [];   // Ball objects currently inside the dome
let isSpinning  = false;
let spinTimer   = null;
let history     = [];   // Current round's picked balls: [{number, color}]
let usedNumbers = [];   // All numbers picked (persists across bracket clears)
let roundNum    = 1;

// ── Score Bar ────────────────────────────────────────────────

function updateScoreBar() {
    document.getElementById('ballCount').textContent   = balls.length;
    document.getElementById('pickedCount').textContent = history.length;
    document.getElementById('roundNum').textContent    = roundNum;
    // Bracket needs at least 2 picks to make sense
    document.getElementById('bracketBtn').disabled = history.length < 2;
}

// ── Ball Initialisation ──────────────────────────────────────

/**
 * Fill the dome with Ball objects for every number from MIN to MAX
 * (up to 150 balls), skipping numbers already in `usedNumbers`.
 */
function initBalls() {
    const min = parseInt(document.getElementById('minNum').value) || 1;
    const max = parseInt(document.getElementById('maxNum').value) || 150;
    balls = [];
    const excluded = new Set(usedNumbers);
    let added = 0;
    for (let i = min; i <= max && added < 150; i++) {
        if (!excluded.has(i)) {
            balls.push(new Ball(i));
            added++;
        }
    }
    updateScoreBar();
}

// ── Pixel Particles (dome decoration) ───────────────────────

/**
 * Create 15 tiny colored squares that float upward around the dome.
 * Pure CSS animation — no JS work per frame.
 */
function generatePixelParticles() {
    const container = document.getElementById('pixelParticles');
    const colors = [
        'var(--neon-cyan)', 'var(--neon-pink)',
        'var(--neon-yellow)', 'var(--neon-green)', 'var(--neon-purple)',
    ];
    for (let i = 0; i < 15; i++) {
        const p = document.createElement('div');
        p.className = 'pixel-particle';
        p.style.left             = Math.random() * 100 + '%';
        p.style.top              = (50 + Math.random() * 50) + '%';
        p.style.background       = colors[i % colors.length];
        p.style.animationDelay    = (Math.random() * 4) + 's';
        p.style.animationDuration = (3 + Math.random() * 3) + 's';
        container.appendChild(p);
    }
}

// ── Shake ────────────────────────────────────────────────────

/** Give every ball a random kick (used during spin animation). */
function shakeBalls() {
    balls.forEach(b => {
        b.vx += (Math.random() - 0.5) * 18;
        b.vy += (Math.random() - 0.5) * 18 - 8;
    });
}

// ── Pick Flow ────────────────────────────────────────────────

/**
 * Full pick sequence:
 * 1. Shake balls for 2.5 seconds
 * 2. Randomly select one ball and highlight it
 * 3. Display the result and record it in history
 */
function startPick() {
    if (isSpinning) return;

    // Re-fill if somehow empty
    if (balls.length === 0) {
        initBalls();
        if (balls.length === 0) return;
    }

    isSpinning = true;
    document.getElementById('pickBtn').disabled = true;
    document.getElementById('spin-status').innerHTML =
        '<span class="spin-label">⚡ SPINNING ⚡</span>';

    // Reset any previous highlight
    balls.forEach(b => b.highlight = false);
    document.getElementById('picked-ball').classList.remove('show');

    // Continuous shaking during the spin
    shakeBalls();
    const shakeInterval = setInterval(shakeBalls, 400);

    spinTimer = setTimeout(() => {
        clearInterval(shakeInterval);

        // Pick a random ball
        const idx    = Math.floor(Math.random() * balls.length);
        const picked = balls[idx];
        picked.highlight = true;

        // Half-second delay so the highlight is visible before the UI updates
        setTimeout(() => {
            const pickedEl = document.getElementById('picked-ball');
            pickedEl.style.background = `linear-gradient(135deg, ${lightenColor(picked.color, 30)}, ${picked.color})`;
            pickedEl.style.boxShadow  = `0 4px 15px rgba(0,0,0,0.4), inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.2), 0 0 25px ${picked.color}60`;
            pickedEl.textContent = picked.number;
            pickedEl.classList.add('show');

            document.getElementById('spin-status').innerHTML = '';

            // Record the pick
            history.push({ number: picked.number, color: picked.color });
            usedNumbers.push(picked.number);
            renderHistory();
            balls.splice(idx, 1); // remove from dome
            updateScoreBar();
            saveState();

            fireConfetti();

            isSpinning = false;
            document.getElementById('pickBtn').disabled = false;

            if (balls.length === 0) {
                document.getElementById('spin-status').innerHTML =
                    '<span style="color: var(--neon-cyan); font-size: 0.5rem; font-family: \'Press Start 2P\', monospace;">GAME OVER — HIT RESET</span>';
            }
        }, 500);
    }, 2500);
}

// ── History Display ──────────────────────────────────────────

/** Re-render the row of small history balls in the side panel. */
function renderHistory() {
    const el = document.getElementById('history');
    el.innerHTML = history.map((h, i) =>
        `<div class="history-ball" style="background: linear-gradient(135deg, ${lightenColor(h.color, 25)}, ${h.color}); box-shadow: 0 2px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.2), inset 0 2px 4px rgba(255,255,255,0.15), 0 0 8px ${h.color}40">
            ${h.number}
            <div class="delete-btn" onclick="deleteHistoryBall(${i})" title="Remove">✕</div>
        </div>`
    ).join('');
}

/**
 * Remove a ball from the history panel AND put it back in the dome.
 * The number is also removed from usedNumbers so it can be picked again.
 */
function deleteHistoryBall(index) {
    const removed = history.splice(index, 1)[0];

    // Re-allow this number to be picked
    const usedIdx = usedNumbers.indexOf(removed.number);
    if (usedIdx !== -1) usedNumbers.splice(usedIdx, 1);

    // Return ball to dome
    balls.push(new Ball(removed.number));

    renderHistory();
    updateScoreBar();
    saveState();
}

// ── Reset ────────────────────────────────────────────────────

/** Full reset — wipes all state and regenerates the dome. */
function resetMachine() {
    if (spinTimer) clearTimeout(spinTimer);
    isSpinning = false;
    document.getElementById('pickBtn').disabled = false;
    document.getElementById('spin-status').innerHTML = '';
    document.getElementById('picked-ball').classList.remove('show');
    history     = [];
    usedNumbers = [];
    roundNum++;
    renderHistory();
    clearState();
    initBalls();
}

// ── Confetti ─────────────────────────────────────────────────

/**
 * Fire 100 pixel-square confetti pieces from the center of the screen.
 * Uses its own rAF loop on the confetti canvas.
 */
function fireConfetti() {
    const cCanvas = document.getElementById('confetti-canvas');
    const cCtx    = cCanvas.getContext('2d');
    cCanvas.width  = window.innerWidth;
    cCanvas.height = window.innerHeight;

    const colors = ['#ff2d75', '#00fff7', '#ffe600', '#39ff14', '#bf5af2', '#ff9f1c', '#ff5252', '#448AFF'];
    const pieces = [];

    for (let i = 0; i < 100; i++) {
        pieces.push({
            x:     cCanvas.width / 2 + (Math.random() - 0.5) * 200,
            y:     cCanvas.height / 2,
            vx:    (Math.random() - 0.5) * 16,
            vy:    Math.random() * -15 - 5,
            size:  Math.floor(Math.random() * 3 + 2) * 2, // even pixel sizes
            color: colors[Math.floor(Math.random() * colors.length)],
            life:  1,
        });
    }

    function animateConfetti() {
        cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
        let alive = false;

        pieces.forEach(p => {
            if (p.life <= 0) return;
            alive = true;
            p.vy   += 0.35;
            p.x    += p.vx;
            p.y    += p.vy;
            p.life -= 0.012;

            cCtx.save();
            cCtx.globalAlpha = Math.max(0, p.life);
            cCtx.fillStyle   = p.color;
            cCtx.shadowColor = p.color;
            cCtx.shadowBlur  = 4;
            cCtx.fillRect(
                Math.round(p.x - p.size / 2),
                Math.round(p.y - p.size / 2),
                p.size, p.size
            );
            cCtx.restore();
        });

        if (alive) {
            requestAnimationFrame(animateConfetti);
        } else {
            cCtx.clearRect(0, 0, cCanvas.width, cCanvas.height);
        }
    }
    animateConfetti();
}

// ── Startup ──────────────────────────────────────────────────
// Runs once when the page loads. Restores session, fills dome,
// and starts the physics loop.

generatePixelParticles();

const hadSavedState = loadState();
initBalls();

if (hadSavedState) {
    renderHistory();
    updateScoreBar();
    // Re-display the last picked ball
    if (history.length > 0) {
        const last     = history[history.length - 1];
        const pickedEl = document.getElementById('picked-ball');
        pickedEl.style.background = `linear-gradient(135deg, ${lightenColor(last.color, 30)}, ${last.color})`;
        pickedEl.style.boxShadow  = `0 4px 15px rgba(0,0,0,0.4), inset 0 -4px 8px rgba(0,0,0,0.2), inset 0 4px 8px rgba(255,255,255,0.2), 0 0 25px ${last.color}60`;
        pickedEl.textContent = last.number;
        pickedEl.classList.add('show');
    }
}

animate(); // start the physics & draw loop (defined in physics.js)

// Changing MIN or MAX triggers a full reset
document.getElementById('minNum').addEventListener('change', () => { if (!isSpinning) resetMachine(); });
document.getElementById('maxNum').addEventListener('change', () => { if (!isSpinning) resetMachine(); });

// Keep confetti canvas sized to the window
window.addEventListener('resize', () => {
    const cCanvas = document.getElementById('confetti-canvas');
    cCanvas.width  = window.innerWidth;
    cCanvas.height = window.innerHeight;
});
