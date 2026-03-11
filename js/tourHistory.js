// ============================================================
// tourHistory.js — Tournament history overlay & badge
// Saves up to 3 past tournaments in localStorage.
// Depends on: physics.js (for lightenColor)
// ============================================================

const TOUR_HISTORY_KEY = 'tea_timezone_tour_history';

// ── Data Access ──────────────────────────────────────────────

/** Load saved tournament array from localStorage. Returns [] if none. */
function getTournamentHistory() {
    try {
        const raw = localStorage.getItem(TOUR_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Save a completed tournament result.
 * Only the 3 most recent entries are kept — the oldest is dropped.
 */
function saveTournamentResult(first, second) {
    const tours = getTournamentHistory();
    tours.push({
        round:  tours.length + 1,
        date:   new Date().toLocaleString(),
        first:  { number: first.number,  color: first.color  },
        second: { number: second.number, color: second.color },
    });
    while (tours.length > 3) tours.shift(); // keep max 3
    localStorage.setItem(TOUR_HISTORY_KEY, JSON.stringify(tours));
    updateHistoryBadge();
}

/** Delete all saved tournament data. */
function clearTournamentHistory() {
    localStorage.removeItem(TOUR_HISTORY_KEY);
    updateHistoryBadge();
    renderTournamentHistory();
}

// ── Badge ────────────────────────────────────────────────────

/** Update the pink number badge on the HISTORY button. */
function updateHistoryBadge() {
    document.getElementById('historyBadge').textContent = getTournamentHistory().length;
}

// ── Overlay ──────────────────────────────────────────────────

function openHistory() {
    renderTournamentHistory();
    document.getElementById('historyOverlay').classList.add('active');
}

function closeHistory() {
    document.getElementById('historyOverlay').classList.remove('active');
}

// ── Render ───────────────────────────────────────────────────

/** Build the list of past tournament cards in the history overlay. */
function renderTournamentHistory() {
    const list = document.getElementById('tourHistoryList');
    const data = getTournamentHistory();

    if (data.length === 0) {
        list.innerHTML = '<div class="no-history-msg">NO TOURNAMENTS YET<br>PICK NUMBERS AND COMPLETE A BRACKET!</div>';
        return;
    }

    // Most recent first
    list.innerHTML = data.slice().reverse().map(t => `
        <div class="tour-history-item">
            <div class="tour-round-badge">R${t.round}</div>
            <div class="tour-results">
                <div class="tour-place">
                    🥇 <span class="tour-ball" style="background:linear-gradient(135deg,${lightenColor(t.first.color,20)},${t.first.color})">${t.first.number}</span>
                </div>
                <div class="tour-place">
                    🥈 <span class="tour-ball" style="background:linear-gradient(135deg,${lightenColor(t.second.color,20)},${t.second.color})">${t.second.number}</span>
                </div>
            </div>
            <div style="margin-left:auto;font-family:'Press Start 2P',monospace;font-size:0.25rem;color:rgba(255,255,255,0.25)">${t.date}</div>
        </div>
    `).join('');
}

// Initialise badge count when page loads
updateHistoryBadge();
