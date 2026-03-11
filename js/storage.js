// ============================================================
// storage.js — localStorage helpers for active game session
// Saves: history, roundNum, min/max values, usedNumbers
// ============================================================

const STORAGE_KEY = 'tea_timezone_lottery';

/**
 * Persist the current game state to localStorage so it
 * survives a page refresh.
 */
function saveState() {
    const state = {
        history:     history,
        roundNum:    roundNum,
        minVal:      document.getElementById('minNum').value,
        maxVal:      document.getElementById('maxNum').value,
        usedNumbers: usedNumbers,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Restore a previously saved game state.
 * Returns true if there was something to restore.
 */
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const state = JSON.parse(raw);
        history     = state.history     || [];
        roundNum    = state.roundNum    || 1;
        // Fall back to deriving usedNumbers from history if not saved
        usedNumbers = state.usedNumbers || history.map(h => h.number);
        if (state.minVal) document.getElementById('minNum').value = state.minVal;
        if (state.maxVal) document.getElementById('maxNum').value = state.maxVal;
        return (history.length > 0 || usedNumbers.length > 0);
    } catch (e) {
        console.warn('Failed to load state', e);
    }
    return false;
}

/**
 * Delete all saved game state (called on full reset).
 */
function clearState() {
    localStorage.removeItem(STORAGE_KEY);
}
