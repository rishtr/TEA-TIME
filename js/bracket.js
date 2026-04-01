// ============================================================
// bracket.js — Tournament bracket: generation, rendering,
//              winner selection, and podium display.
// Depends on: config.js, physics.js (lightenColor),
//             tourHistory.js (saveTournamentResult),
//             game.js (history, fireConfetti, renderHistory,
//                      updateScoreBar, saveState)
// ============================================================

let bracketData = null; // { rounds: [[{p1, p2, winner}, ...], ...] }
let undoStack   = [];   // Each entry: { roundIdx, matchIdx, prevWinner, nextRoundIdx, nextMatchIdx, nextSlot }

// ── Open / Close ─────────────────────────────────────────────

function openBracket() {
    if (history.length < 2) return;
    generateBracket();
    document.getElementById('bracketOverlay').classList.add('active');
}

/**
 * Close the bracket overlay.
 * If the final was decided, clear the current round's history
 * so the user can start fresh (usedNumbers is preserved to prevent
 * already-used numbers from re-entering the dome).
 */
function closeBracket() {
    document.getElementById('bracketOverlay').classList.remove('active');
    if (!bracketData) return;

    const finalRound = bracketData.rounds[bracketData.rounds.length - 1];
    if (finalRound[0].winner) {
        history = [];
        renderHistory();
        document.getElementById('picked-ball').classList.remove('show');
        document.getElementById('spin-status').innerHTML = '';
        updateScoreBar();
        saveState();
        bracketData = null;
    }
}

// ── Bracket Generation ───────────────────────────────────────

/**
 * Build a single-elimination bracket from the current history.
 * - Bracket size is rounded up to the next power of 2
 * - Spare slots become BYEs (auto-advance)
 */
function generateBracket() {
    const players = history.map(h => ({ number: h.number, color: h.color }));

    // Shuffle so matchups are random each time
    for (let i = players.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [players[i], players[j]] = [players[j], players[i]];
    }

    // Next power of 2 (e.g. 6 players → bracket size 8)
    let size = 1;
    while (size < players.length) size *= 2;

    const totalRounds        = Math.log2(size);
    const numFirstRoundMatches = size / 2;
    const numByes            = size - players.length;
    const numRealMatches     = numFirstRoundMatches - numByes;

    const rounds  = [];
    const round1  = [];
    let playerIdx = 0;

    // Real matches (two players each)
    for (let i = 0; i < numRealMatches; i++) {
        round1.push({ p1: players[playerIdx++], p2: players[playerIdx++], winner: null });
    }

    // BYE matches (one player auto-advances)
    for (let i = 0; i < numByes; i++) {
        const p = players[playerIdx++];
        round1.push({ p1: p, p2: null, winner: p });
    }

    rounds.push(round1);

    // Subsequent rounds — empty until winners are picked
    for (let r = 1; r < totalRounds; r++) {
        const prevLen   = rounds[r - 1].length;
        const thisRound = [];
        for (let i = 0; i < prevLen; i += 2) {
            thisRound.push({ p1: null, p2: null, winner: null });
        }
        rounds.push(thisRound);
    }

    bracketData = { rounds };
    undoStack   = [];           // fresh bracket → clear undo history
    propagateByes();
    renderBracket();
}

// ── BYE Propagation ──────────────────────────────────────────

/**
 * Auto-advance BYE winners into the next round.
 * Multi-pass loop runs until nothing changes (handles chained BYEs).
 */
function propagateByes() {
    const { rounds } = bracketData;
    let changed = true;
    while (changed) {
        changed = false;
        for (let r = 0; r < rounds.length - 1; r++) {
            for (let m = 0; m < rounds[r].length; m++) {
                if (!rounds[r][m].winner) continue;
                const nextM    = Math.floor(m / 2);
                const slot     = m % 2 === 0 ? 'p1' : 'p2';
                const nextMatch = rounds[r + 1][nextM];
                if (!nextMatch[slot]) {
                    nextMatch[slot] = rounds[r][m].winner;
                    changed = true;
                }
            }
        }
    }
}

// ── Winner Selection ─────────────────────────────────────────

/**
 * Called when the user clicks a player slot to advance them.
 * Does nothing if the match already has a winner or either side is missing.
 */
function selectWinner(roundIdx, matchIdx, playerSlot) {
    const match  = bracketData.rounds[roundIdx][matchIdx];
    const player = match[playerSlot];
    if (!player || match.winner)       return; // match already decided
    if (!match.p1 || !match.p2)        return; // need both players

    // Save state for undo BEFORE modifying anything
    const undoEntry = { roundIdx, matchIdx, prevWinner: null };
    if (roundIdx < bracketData.rounds.length - 1) {
        undoEntry.nextRoundIdx = roundIdx + 1;
        undoEntry.nextMatchIdx = Math.floor(matchIdx / 2);
        undoEntry.nextSlot     = matchIdx % 2 === 0 ? 'p1' : 'p2';
    }
    undoStack.push(undoEntry);

    match.winner = player;

    // Feed winner into the next round
    if (undoEntry.nextSlot) {
        bracketData.rounds[undoEntry.nextRoundIdx][undoEntry.nextMatchIdx][undoEntry.nextSlot] = player;
    }

    renderBracket();
}

/**
 * Undo the last winner selection.
 * Reverts the match winner and removes the propagated player from the next round.
 */
function undoBracket() {
    if (undoStack.length === 0) return;
    const entry = undoStack.pop();
    const match = bracketData.rounds[entry.roundIdx][entry.matchIdx];

    // Revert winner
    match.winner = null;

    // Remove propagated player from the next round slot
    if (entry.nextSlot) {
        const nextMatch = bracketData.rounds[entry.nextRoundIdx][entry.nextMatchIdx];
        // Only clear if the next match hasn't already been decided
        // (shouldn't happen since you'd have to undo that first, but be safe)
        nextMatch[entry.nextSlot] = null;
        nextMatch.winner = null;
    }

    renderBracket();
}

// ── Tournament Complete ───────────────────────────────────────

/**
 * Called by renderBracket() when the final match has a winner.
 * Separated into its own function to keep renderBracket() focused
 * on pure HTML generation.
 */
function onTournamentComplete(champ, runnerUp) {
    // Show podium
    const podium = document.getElementById('podiumDisplay');
    podium.classList.add('active');

    const p1El = document.getElementById('podium1st');
    p1El.textContent       = champ.number;
    p1El.style.background  = `linear-gradient(135deg, ${lightenColor(champ.color, 25)}, ${champ.color})`;
    p1El.style.boxShadow   = `0 0 18px ${champ.color}80`;

    const p2El = document.getElementById('podium2nd');
    p2El.textContent       = runnerUp.number;
    p2El.style.background  = `linear-gradient(135deg, ${lightenColor(runnerUp.color, 25)}, ${runnerUp.color})`;
    p2El.style.boxShadow   = `0 0 12px ${runnerUp.color}60`;

    // Persist result (defined in tourHistory.js)
    saveTournamentResult(champ, runnerUp);
    document.getElementById('podiumSaveMsg').style.display = 'block';

    fireConfetti();
}

// ── Render ───────────────────────────────────────────────────

/** Returns the display label for a round (FINAL, SEMIS, etc.). */
function getRoundName(roundIdx, totalRounds) {
    const left = totalRounds - roundIdx;
    if (left === 1) return 'FINAL';
    if (left === 2) return 'SEMIS';
    if (left === 3) return 'QUARTERS';
    return 'ROUND ' + (roundIdx + 1);
}

/** Rebuild the full bracket HTML and inject into #bracketContainer. */
function renderBracket() {
    const container  = document.getElementById('bracketContainer');
    const { rounds } = bracketData;
    const totalRounds = rounds.length;
    let html = '';

    for (let r = 0; r < totalRounds; r++) {
        const round  = rounds[r];
        const gapPx  = Math.pow(2, r) * 20;
        html += `<div class="bracket-round" style="gap:${gapPx}px">`;
        html += `<div class="round-label">${getRoundName(r, totalRounds)}</div>`;

        for (let m = 0; m < round.length; m++) {
            const match    = round[m];
            const p1Winner = match.winner && match.p1 && match.winner.number === match.p1.number;
            const p2Winner = match.winner && match.p2 && match.winner.number === match.p2.number;
            const p1Elim   = match.winner && match.p1 && !p1Winner; 
            const p2Elim   = match.winner && match.p2 && !p2Winner;

            html += '<div class="match-pair">';

            // ── P1 slot ──
            if (!match.p1) {
                html += '<div class="match-slot empty">TBD</div>';
            } else if (match.p1 && !match.p2 && !match.winner) {
                const bs = `background:linear-gradient(135deg, ${lightenColor(match.p1.color,25)}, ${match.p1.color})`;
                html += `<div class="match-slot"><span class="slot-ball" style="${bs}">${match.p1.number}</span> #${match.p1.number}</div>`;
            } else {
                const cls = p1Winner ? 'winner' : (p1Elim ? 'eliminated' : '');
                const bs  = `background:linear-gradient(135deg, ${lightenColor(match.p1.color,25)}, ${match.p1.color})`;
                html += `<div class="match-slot ${cls}" onclick="selectWinner(${r},${m},'p1')"><span class="slot-ball" style="${bs}">${match.p1.number}</span> #${match.p1.number}</div>`;
            }

            html += '<div class="match-vs">VS</div>';

            // ── P2 slot ──
            if (!match.p2) {
                html += match.winner && match.p1
                    ? '<div class="match-slot bye">BYE</div>'
                    : '<div class="match-slot empty">TBD</div>';
            } else {
                const cls = p2Winner ? 'winner' : (p2Elim ? 'eliminated' : '');
                const bs  = `background:linear-gradient(135deg, ${lightenColor(match.p2.color,25)}, ${match.p2.color})`;
                html += `<div class="match-slot ${cls}" onclick="selectWinner(${r},${m},'p2')"><span class="slot-ball" style="${bs}">${match.p2.number}</span> #${match.p2.number}</div>`;
            }

            html += '</div>'; // .match-pair
        }

        html += '</div>'; // .bracket-round

        // Connector column between rounds
        if (r < totalRounds - 1) {
            html += '<div class="connector-col"></div>';
        }
    }

    container.innerHTML = html;

    // Show / hide the undo button
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) undoBtn.style.display = undoStack.length > 0 ? '' : 'none';

    // Reset podium/save-message until we check for completion
    document.getElementById('podiumDisplay').classList.remove('active');
    document.getElementById('podiumSaveMsg').style.display = 'none';

    // Check if the final match has been decided
    const finalRound = bracketData.rounds[bracketData.rounds.length - 1];
    if (finalRound[0].winner) {
        const champ    = finalRound[0].winner;
        const runnerUp = finalRound[0].p1 === champ ? finalRound[0].p2 : finalRound[0].p1;
        onTournamentComplete(champ, runnerUp);
    }
}
