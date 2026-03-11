// ============================================================
// physics.js — Ball class, color helpers, collision detection,
//              and the main animation loop.
// Depends on: config.js
// ============================================================

// ── Color Helpers ────────────────────────────────────────────

/** Add `amount` to each RGB channel (capped at 255). */
function lightenColor(hex, amount) {
    const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount);
    const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount);
    const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount);
    return `rgb(${r},${g},${b})`;
}

/** Subtract `amount` from each RGB channel (floored at 0). */
function darkenColor(hex, amount) {
    const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
    const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
    const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
    return `rgb(${r},${g},${b})`;
}

// ── Ball Class ───────────────────────────────────────────────

class Ball {
    constructor(number) {
        this.number = number;
        this.r      = BALL_RADIUS;
        // Same number always maps to the same color
        this.color  = BALL_COLORS[number % BALL_COLORS.length];

        // Random starting position inside the dome
        const angle = Math.random() * Math.PI * 2;
        const dist  = Math.random() * (DOME_RADIUS - this.r - 20);
        this.x  = DOME_CX + Math.cos(angle) * dist;
        this.y  = DOME_CY + Math.sin(angle) * dist;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;

        this.highlight = false; // turns true during a pick selection

        // Offscreen canvas cache (built lazily in _buildCache)
        this._cache          = null;
        this._cacheHighlight = null;
        this._cacheHalf      = 0;
    }

    /** Physics update — called every frame. */
    update() {
        // Apply gravity & friction
        this.vy += GRAVITY;
        this.vx *= FRICTION;
        this.vy *= FRICTION;

        // Move
        this.x += this.vx;
        this.y += this.vy;

        // Dome wall collision (circular boundary)
        const dx   = this.x - DOME_CX;
        const dy   = this.y - DOME_CY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = DOME_RADIUS - this.r;

        if (dist > maxDist) {
            // Push back inside
            const angle = Math.atan2(dy, dx);
            this.x = DOME_CX + Math.cos(angle) * maxDist;
            this.y = DOME_CY + Math.sin(angle) * maxDist;

            // Reflect velocity off the dome wall
            const nx  = dx / dist;
            const ny  = dy / dist;
            const dot = this.vx * nx + this.vy * ny;
            this.vx -= 2 * dot * nx;
            this.vy -= 2 * dot * ny;
            this.vx *= BOUNCE;
            this.vy *= BOUNCE;
        }
    }

    /**
     * Draw this ball to the main canvas.
     * Uses an offscreen cache so gradient/glow are only computed once
     * (or when highlight state changes), then just drawImage() each frame.
     */
    draw(ctx) {
        if (!this._cache || this._cacheHighlight !== this.highlight) {
            this._buildCache();
        }
        ctx.drawImage(this._cache, this.x - this._cacheHalf, this.y - this._cacheHalf);
    }

    /** Build (or rebuild) the cached offscreen ball image. */
    _buildCache() {
        this._cacheHighlight = this.highlight;
        const pad  = this.highlight ? 36 : 12;
        const size = (this.r + pad) * 2;
        this._cacheHalf = this.r + pad;

        const oc = document.createElement('canvas');
        oc.width  = size;
        oc.height = size;
        const cx = size / 2;
        const cy = size / 2;
        const c  = oc.getContext('2d');

        // Drop shadow
        c.save();
        c.beginPath();
        c.arc(cx + 3, cy + 3, this.r, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.2)';
        c.fill();
        c.restore();

        // Yellow highlight ring (only when selected during a pick)
        if (this.highlight) {
            c.save();
            c.beginPath();
            c.arc(cx, cy, this.r + 8, 0, Math.PI * 2);
            c.strokeStyle = '#ffe600';
            c.lineWidth   = 4;
            c.shadowColor = '#ffe600';
            c.shadowBlur  = 25;
            c.stroke();
            c.restore();
        }

        // Neon outline glow
        c.save();
        c.beginPath();
        c.arc(cx, cy, this.r + 1, 0, Math.PI * 2);
        c.strokeStyle = this.color;
        c.lineWidth   = 1.5;
        c.shadowColor = this.color;
        c.shadowBlur  = 8;
        c.stroke();
        c.restore();

        // Radial gradient fill (bright top → base color → dark bottom)
        const grad = c.createRadialGradient(
            cx - this.r * 0.3, cy - this.r * 0.3, this.r * 0.1,
            cx, cy, this.r
        );
        grad.addColorStop(0,   lightenColor(this.color, 50));
        grad.addColorStop(0.6, this.color);
        grad.addColorStop(1,   darkenColor(this.color, 40));
        c.beginPath();
        c.arc(cx, cy, this.r, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();

        // Specular shine spot
        c.beginPath();
        c.arc(cx - this.r * 0.25, cy - this.r * 0.25, this.r * 0.3, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.fill();

        // Number label
        c.fillStyle    = '#fff';
        c.font         = `bold ${this.r * 0.85}px 'Outfit', sans-serif`;
        c.textAlign    = 'center';
        c.textBaseline = 'middle';
        c.shadowColor  = 'rgba(0,0,0,0.5)';
        c.shadowBlur   = 3;
        c.fillText(this.number, cx, cy + 1);
        c.shadowBlur   = 0;

        this._cache = oc;
    }
}

// ── Spatial-Grid Collision Detection ─────────────────────────
// Divides the canvas into grid cells; only checks balls in the
// same or adjacent cells — much faster than checking every pair.

const GRID_CELL = BALL_RADIUS * 4; // cell size = 4 × ball diameter

function resolveBallCollisions() {
    // 1. Assign each ball to a grid cell
    const grid = {};
    for (let i = 0; i < balls.length; i++) {
        const b  = balls[i];
        const gx = Math.floor(b.x / GRID_CELL);
        const gy = Math.floor(b.y / GRID_CELL);
        const key = `${gx},${gy}`;
        if (!grid[key]) grid[key] = [];
        grid[key].push(i);
    }

    // 2. For each cell, check against itself and 8 neighbours
    const checked = new Set();
    for (const key in grid) {
        const [gx, gy] = key.split(',').map(Number);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nKey = `${gx + dx},${gy + dy}`;
                if (!grid[nKey]) continue;

                for (const i of grid[key]) {
                    for (const j of grid[nKey]) {
                        if (i >= j) continue;              // avoid duplicates
                        const pairKey = i * 1000 + j;
                        if (checked.has(pairKey)) continue;
                        checked.add(pairKey);

                        const a    = balls[i];
                        const b    = balls[j];
                        const ddx  = b.x - a.x;
                        const ddy  = b.y - a.y;
                        const dist2 = ddx * ddx + ddy * ddy;
                        const minD  = a.r + b.r;

                        if (dist2 < minD * minD && dist2 > 0) {
                            const dist    = Math.sqrt(dist2);
                            const nx      = ddx / dist;
                            const ny      = ddy / dist;
                            const overlap = (minD - dist) / 2;

                            // Push apart
                            a.x -= nx * overlap;
                            a.y -= ny * overlap;
                            b.x += nx * overlap;
                            b.y += ny * overlap;

                            // Exchange velocity components along collision normal
                            const dvx    = a.vx - b.vx;
                            const dvy    = a.vy - b.vy;
                            const dvDotN = dvx * nx + dvy * ny;
                            if (dvDotN > 0) {
                                a.vx -= dvDotN * nx * 0.8;
                                a.vy -= dvDotN * ny * 0.8;
                                b.vx += dvDotN * nx * 0.8;
                                b.vy += dvDotN * ny * 0.8;
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Animation Loop ───────────────────────────────────────────
// Throttles to ~10 fps when balls have settled to save CPU.

const canvas = document.getElementById('ball-canvas');
const ctx    = canvas.getContext('2d');

let animId     = null;
let idleFrames = 0;

function animate() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Update physics & accumulate total velocity to detect idle
    let totalVel = 0;
    balls.forEach(b => {
        b.update();
        totalVel += Math.abs(b.vx) + Math.abs(b.vy);
    });

    resolveBallCollisions();
    balls.forEach(b => b.draw(ctx));

    // When balls are barely moving and we're not spinning, slow down
    if (totalVel < 2 && !isSpinning) {
        idleFrames++;
        if (idleFrames > 60) {
            // ~10 fps idle — saves significant CPU
            setTimeout(() => { animId = requestAnimationFrame(animate); }, 90);
            return;
        }
    } else {
        idleFrames = 0;
    }

    animId = requestAnimationFrame(animate);
}
