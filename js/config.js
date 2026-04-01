// ============================================================
// config.js — Physics constants & color palette
// All other JS files read from these globals.
// ============================================================

const CANVAS_SIZE = 840;
const DOME_RADIUS = 400;
const DOME_CX     = CANVAS_SIZE / 2;
const DOME_CY     = CANVAS_SIZE / 2;
const BALL_RADIUS = 16;
const GRAVITY     = 0.1;
const FRICTION    = 0.985;
const BOUNCE      = 0.65;

// 25 neon colors — a ball's color is BALL_COLORS[number % 25]
// so the same number always gets the same color.
const BALL_COLORS = [
    '#ff2d75', '#00fff7', '#ffe600', '#39ff14', '#bf5af2',
    '#ff9f1c', '#ff5252', '#448AFF', '#69F0AE', '#FFAB40',
    '#40C4FF', '#FF4081', '#B2FF59', '#7C4DFF', '#FF6E40',
    '#18FFFF', '#EEFF41', '#F50057', '#00E676', '#D500F9',
    '#FF9100', '#00B0FF', '#C6FF00', '#651FFF', '#FF3D00',
];
