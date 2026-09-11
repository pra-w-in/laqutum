/**
 * confidence-tracker.js — Laqtum Confidence Score Manager
 *
 * Manages 12 independent pattern confidence scores (0.0–1.0),
 * with correctness+speed+comprehension update logic, related-pattern nudges,
 * lock-in/re-open detection, time-based decay, and localStorage persistence.
 *
 * Usage:
 *   <script src="engine/confidence-tracker.js"></script>
 *   ConfidenceTracker.init();
 *   ConfidenceTracker.update('P4', { correct: true, responseTimeMs: 8000, comprehension: 'understood' });
 *   // console.log(ConfidenceTracker.getScore('P4'));  // → 0.156
 */

const ConfidenceTracker = (function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────────────

    const STORAGE_KEY = 'laqtum_confidence';
    const SCHEMA_VERSION = 1;
    const ALL_PATTERNS = ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12'];
    const HISTORY_CAP = 10;

    // Level thresholds
    const LEVELS = {
        NOT_RECOGNIZED: { min: 0.0,  max: 0.35 },
        EMERGING:       { min: 0.35, max: 0.65 },
        SOLID:          { min: 0.65, max: 0.85 },
        MASTERED:       { min: 0.85, max: 1.0  }
    };

    // Update parameters
    const BASE_DELTA_CORRECT = 0.22;
    const BASE_DELTA_WRONG = -0.05;      // Balanced penalty during active learning phase
    const BASE_DELTA_WRONG_LOCKED = -0.10; // Re-open penalty when locked pattern missed
    const FAST_THRESHOLD_MS = 15000;
    const SLOW_THRESHOLD_MS = 45000;
    const FAST_MULTIPLIER = 1.3;
    const SLOW_MULTIPLIER = 0.6;

    // Comprehension modifiers
    const COMPREHENSION_MODIFIERS = {
        understood: 1.0,
        slightly_understood: 0.8,
        nothing_understood: null,  // Special: overrides delta to -0.10
        some_doubts: 0.7,
        cant_apply_but_understood: 0.5
    };
    const NOTHING_UNDERSTOOD_OVERRIDE = -0.10;

    // Related-pattern nudge
    const NUDGE_AMOUNT = 0.02;
    const PATTERN_OVERLAPS = {
        P1:  ['P12'],
        P2:  [],
        P3:  ['P12'],
        P4:  ['P7'],
        P5:  ['P11'],
        P6:  [],
        P7:  ['P4'],
        P8:  [],
        P9:  [],
        P10: [],
        P11: ['P5'],
        P12: ['P1', 'P3']
    };

    // Lock-in parameters
    const LOCK_IN_CONSECUTIVE = 3;
    const REOPEN_CONSECUTIVE_MISSES = 2;

    // Decay parameters
    const DECAY_GRACE_DAYS = 3;
    const DECAY_RATE_PER_DAY = 0.03;

    // Exam frequency weights (placeholder, 1-5 scale)
    // TODO: replace with real frequency data from usage analytics
    const EXAM_FREQUENCY = {
        P1: 4, P2: 3, P3: 5, P4: 5, P5: 3,
        P6: 2, P7: 4, P8: 3, P9: 2, P10: 2,
        P11: 3, P12: 3
    };

    // Trap severity bonus — patterns whose traps include T8 or T3 get higher bonus
    const TRAP_SEVERITY = {
        P1: 0.5, P2: 0.3, P3: 0.6, P4: 0.5, P5: 0.7,
        P6: 0.3, P7: 0.5, P8: 0.4, P9: 0.3, P10: 0.3,
        P11: 0.6, P12: 0.5
    };

    // ─── Private state ───────────────────────────────────────────

    let _state = null;
    let _contradictionFlags = {}; // pattern → count of remaining "distrust self-report" updates

    // ─── Initialization ──────────────────────────────────────────

    function _getStorage() {
        if (typeof localStorage !== 'undefined') return localStorage;
        // In-memory fallback for Node.js environment
        if (!global._nodeStorage) global._nodeStorage = {};
        return {
            getItem: (k) => global._nodeStorage[k] || null,
            setItem: (k, v) => { global._nodeStorage[k] = String(v); },
            removeItem: (k) => { delete global._nodeStorage[k]; }
        };
    }

    function init() {
        let authState = null;
        if (typeof AuthManager !== 'undefined') {
            const user = AuthManager.getCurrentUserSync();
            if (user && user.confidenceStates && Object.keys(user.confidenceStates).length > 0) {
                authState = user.confidenceStates;
            }
        }

        if (authState) {
            _state = authState;
        } else {
            const storage = _getStorage();
            const saved = storage.getItem(STORAGE_KEY);
            if (saved) {
                try {
                    _state = JSON.parse(saved);
                    if (_state.version !== SCHEMA_VERSION) {
                        _state = _createFreshState();
                    }
                } catch (e) {
                    _state = _createFreshState();
                }
            } else {
                _state = _createFreshState();
            }
        }

        // Initialize contradiction flags from memory (not persisted — session-only)
        _contradictionFlags = {};

        // Apply decay on every init (app startup)
        applyDecay();

        _persist();
        // console.log('[ConfidenceTracker] Initialized. Scores:', getAllScores());
    }

    function _createFreshState() {
        const patterns = {};
        for (const p of ALL_PATTERNS) {
            patterns[p] = {
                score: 0.0,
                history: [],
                locked: false,
                lastTouched: null,
                consecutiveMisses: 0
            };
        }
        return {
            version: SCHEMA_VERSION,
            lastUpdated: new Date().toISOString(),
            patterns
        };
    }

    // ─── Core update logic ───────────────────────────────────────

    /**
     * update — Process a learner's response to a question for a given pattern.
     *
     * @param {string} pattern — P1–P12
     * @param {object} result — { correct: boolean, responseTimeMs: number, comprehension: string|null }
     * @returns {object} — { oldScore, newScore, delta, level, locked }
     */
    function update(pattern, result) {
        _ensureInit();
        if (!_state.patterns[pattern]) {
            console.error(`[ConfidenceTracker] Unknown pattern: ${pattern}`);
            return null;
        }

        const patternState = _state.patterns[pattern];
        const oldScore = patternState.score;
        const { correct, responseTimeMs, comprehension } = result;

        // Increment unvisitedTurns for all patterns, reset for current pattern
        for (const pKey in _state.patterns) {
            _state.patterns[pKey].unvisitedTurns = (_state.patterns[pKey].unvisitedTurns || 0) + 1;
        }
        patternState.unvisitedTurns = 0;

        // 1. Base delta from correctness
        let delta = correct ? BASE_DELTA_CORRECT : (patternState.locked ? BASE_DELTA_WRONG_LOCKED : BASE_DELTA_WRONG);

        // 2. Speed modifier (only for correct answers)
        if (correct) {
            if (responseTimeMs < FAST_THRESHOLD_MS) {
                delta *= FAST_MULTIPLIER;
            } else if (responseTimeMs > SLOW_THRESHOLD_MS) {
                delta *= SLOW_MULTIPLIER;
            }
        }

        // 3. Comprehension modifier
        if (comprehension && comprehension !== 'understood') {
            // Check if we're in "distrust self-report" mode for this pattern
            const distrustActive = (_contradictionFlags[pattern] || 0) > 0;

            if (comprehension === 'nothing_understood') {
                // Override: self-report of non-understanding always applies
                delta = NOTHING_UNDERSTOOD_OVERRIDE;
            } else if (!distrustActive) {
                const modifier = COMPREHENSION_MODIFIERS[comprehension];
                if (modifier !== null && modifier !== undefined) {
                    delta *= modifier;
                }
            }
            // If distrust is active, ignore the comprehension modifier (trust performance only)
        }

        // 4. Contradiction detection
        if (comprehension === 'understood' && !correct) {
            // Learner says "understood" but got it wrong — distrust self-report for next 2 updates
            _contradictionFlags[pattern] = 2;
            // console.warn(`[ConfidenceTracker] Contradiction detected for ${pattern}: reported "understood" but answered wrong.`);
        } else if (_contradictionFlags[pattern] > 0) {
            _contradictionFlags[pattern]--;
        }

        // 5. Apply delta, clamp to [0.0, 1.0]
        const newScore = Math.max(0.0, Math.min(1.0, oldScore + delta));
        patternState.score = newScore;

        // 6. Record history
        patternState.history.push({
            delta: +(newScore - oldScore).toFixed(4),
            correct,
            reason: comprehension || (correct ? 'correct' : 'wrong'),
            timestamp: new Date().toISOString()
        });
        if (patternState.history.length > HISTORY_CAP) {
            patternState.history = patternState.history.slice(-HISTORY_CAP);
        }

        // 7. Update timestamps
        patternState.lastTouched = new Date().toISOString();
        _state.lastUpdated = new Date().toISOString();

        // 8. Consecutive misses tracking (for re-open)
        if (!correct) {
            patternState.consecutiveMisses++;
        } else {
            patternState.consecutiveMisses = 0;
        }

        // 9. Lock-in check
        _checkLockIn(pattern);

        // 10. Re-open check
        if (patternState.locked && patternState.consecutiveMisses >= REOPEN_CONSECUTIVE_MISSES) {
            patternState.locked = false;
            patternState.consecutiveMisses = 0;
            // console.log(`[ConfidenceTracker] ${pattern} UNLOCKED — 2 consecutive misses while locked.`);
        }

        // 11. Related-pattern nudge
        const overlaps = PATTERN_OVERLAPS[pattern] || [];
        for (const related of overlaps) {
            if (_state.patterns[related]) {
                const nudge = correct ? NUDGE_AMOUNT : -NUDGE_AMOUNT;
                _state.patterns[related].score = Math.max(0.0, Math.min(1.0, _state.patterns[related].score + nudge));
            }
        }

        // 12. Persist
        _persist();

        const result_summary = {
            pattern,
            oldScore: +oldScore.toFixed(4),
            newScore: +newScore.toFixed(4),
            delta: +(newScore - oldScore).toFixed(4),
            level: getLevel(pattern),
            locked: patternState.locked
        };

        // console.log(`[ConfidenceTracker] ${pattern}: ${result_summary.oldScore} → ${result_summary.newScore} (${result_summary.delta >= 0 ? '+' : ''}${result_summary.delta}) [${result_summary.level}]${result_summary.locked ? ' 🔒' : ''}`);

        return result_summary;
    }

    // ─── Lock-in logic ───────────────────────────────────────────

    function _checkLockIn(pattern) {
        const patternState = _state.patterns[pattern];
        const history = patternState.history;

        if (history.length < LOCK_IN_CONSECUTIVE) return;

        // Check last N entries: are they all in the same level band?
        const recentScores = [];
        let runningScore = patternState.score;
        // Walk backwards through deltas to reconstruct recent scores
        for (let i = history.length - 1; i >= Math.max(0, history.length - LOCK_IN_CONSECUTIVE); i--) {
            recentScores.unshift(runningScore);
            runningScore = runningScore - history[i].delta;
        }

        const levels = recentScores.map(s => _classifyScore(s));
        const allSameLevel = levels.every(l => l === levels[0]);

        if (allSameLevel && !patternState.locked) {
            patternState.locked = true;
            // console.log(`[ConfidenceTracker] ${pattern} LOCKED at level ${levels[0]} — stable for ${LOCK_IN_CONSECUTIVE} updates.`);
        }
    }

    // ─── Decay logic ─────────────────────────────────────────────

    function applyDecay() {
        _ensureInit();
        const now = Date.now();

        for (const p of ALL_PATTERNS) {
            const ps = _state.patterns[p];
            if (!ps.lastTouched) continue; // Never touched — no decay

            const daysSince = (now - new Date(ps.lastTouched).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSince <= DECAY_GRACE_DAYS) continue; // Within grace period

            const oldScore = ps.score;
            const decayFactor = 1 - (DECAY_RATE_PER_DAY * daysSince);
            ps.score = Math.max(0.0, ps.score * Math.max(0, decayFactor));

            if (ps.score !== oldScore) {
                // Check if decay crossed a threshold — unlock if so
                const oldLevel = _classifyScore(oldScore);
                const newLevel = _classifyScore(ps.score);
                if (oldLevel !== newLevel) {
                    ps.locked = false;
                }

                // console.log(`[ConfidenceTracker] Decay: ${p} ${oldScore.toFixed(4)} → ${ps.score.toFixed(4)} (${daysSince.toFixed(1)} days inactive)`);
            }
        }

        _persist();
    }

    // ─── Getters ─────────────────────────────────────────────────

    function getScore(pattern) {
        _ensureInit();
        return _state.patterns[pattern] ? _state.patterns[pattern].score : 0;
    }

    function getLevel(pattern) {
        _ensureInit();
        return _classifyScore(getScore(pattern));
    }

    function isLocked(pattern) {
        _ensureInit();
        return _state.patterns[pattern] ? _state.patterns[pattern].locked : false;
    }

    function getHistory(pattern) {
        _ensureInit();
        return _state.patterns[pattern] ? [..._state.patterns[pattern].history] : [];
    }

    function getAllScores() {
        _ensureInit();
        const scores = {};
        for (const p of ALL_PATTERNS) {
            scores[p] = +_state.patterns[p].score.toFixed(4);
        }
        return scores;
    }

    function getAllStates() {
        _ensureInit();
        const result = {};
        for (const p of ALL_PATTERNS) {
            const ps = _state.patterns[p];
            result[p] = {
                score: +ps.score.toFixed(4),
                level: _classifyScore(ps.score),
                locked: ps.locked,
                lastTouched: ps.lastTouched,
                consecutiveMisses: ps.consecutiveMisses,
                historyLength: ps.history.length
            };
        }
        return result;
    }

    function getExamFrequency(pattern) {
        return EXAM_FREQUENCY[pattern] || 1;
    }

    function getTrapSeverity(pattern) {
        return TRAP_SEVERITY[pattern] || 0.3;
    }

    /**
     * computePriorityScore — The priority formula from Section 9.
     * priority = (exam_frequency_weight × 0.4) + (diagnostic_gap × 0.4) + (trap_severity_bonus × 0.2)
     *
     * exam_frequency_weight is normalized to 0-1 from the 1-5 scale.
     * diagnostic_gap = 1 - current confidence score.
     */
    function computePriorityScore(pattern) {
        _ensureInit();
        const score = getScore(pattern);
        const examFreq = (getExamFrequency(pattern) - 1) / 4; // Normalize 1-5 to 0-1
        const diagnosticGap = 1 - score;
        const trapSeverity = getTrapSeverity(pattern);
        const ps = _state.patterns[pattern];
        const turnsSince = ps ? (ps.unvisitedTurns || 0) : 0;
        const starvationBoost = Math.min(1, turnsSince / 25);

        return (examFreq * 0.35) + (diagnosticGap * 0.35) + (trapSeverity * 0.15) + (starvationBoost * 0.15);
    }

    /**
     * getReentryStep — When a learner returns after a gap, determine which
     * Six-Step Teaching Unit step to re-enter at.
     * Per Section 10: re-enter at Step 4 (Trap Reveal) rather than Step 1.
     */
    function getReentryStep(pattern) {
        _ensureInit();
        const ps = _state.patterns[pattern];
        if (!ps.lastTouched) return 1; // Never touched — start from beginning

        const daysSince = (Date.now() - new Date(ps.lastTouched).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > DECAY_GRACE_DAYS) return 4; // Gap detected — re-enter at Step 4

        // No gap — entry point based on current level
        const level = _classifyScore(ps.score);
        switch (level) {
            case 'NOT_RECOGNIZED': return 1;
            case 'EMERGING':       return 3;
            case 'SOLID':          return 4;
            case 'MASTERED':       return 5;
            default: return 1;
        }
    }

    // ─── Mutations ───────────────────────────────────────────────

    function unlock(pattern) {
        _ensureInit();
        if (_state.patterns[pattern]) {
            _state.patterns[pattern].locked = false;
            _state.patterns[pattern].consecutiveMisses = 0;
            _persist();
        }
    }

    function reset() {
        _state = _createFreshState();
        _contradictionFlags = {};
        _persist();
        // console.log('[ConfidenceTracker] All data reset.');
    }

    /**
     * seedFromDiagnostic — After the initial diagnostic quiz, seed scores
     * for patterns based on the learner's results.
     *
     * @param {Array} results — [{ pattern, correct, responseTimeMs }]
     */
    function seedFromDiagnostic(results) {
        _ensureInit();
        for (const r of results) {
            if (_state.patterns[r.pattern]) {
                // Seed with a larger initial delta since this is diagnostic
                let seedScore;
                if (r.correct) {
                    seedScore = r.responseTimeMs < FAST_THRESHOLD_MS ? 0.45 : 0.35;
                } else {
                    seedScore = 0.15;
                }
                _state.patterns[r.pattern].score = seedScore;
                _state.patterns[r.pattern].lastTouched = new Date().toISOString();
                _state.patterns[r.pattern].history.push({
                    delta: seedScore,
                    correct: r.correct,
                    reason: 'diagnostic_seed',
                    timestamp: new Date().toISOString()
                });
            }
        }
        _persist();
        // console.log('[ConfidenceTracker] Seeded from diagnostic:', getAllScores());
    }

    // ─── Internal helpers ────────────────────────────────────────

    function _classifyScore(score) {
        if (score < 0.35) return 'NOT_RECOGNIZED';
        if (score < 0.65) return 'EMERGING';
        if (score < 0.85) return 'SOLID';
        return 'MASTERED';
    }

    function _ensureInit() {
        if (!_state) {
            throw new Error('[ConfidenceTracker] Not initialized. Call ConfidenceTracker.init() first.');
        }
    }

    function _persist() {
        try {
            _getStorage().setItem(STORAGE_KEY, JSON.stringify(_state));
        } catch (e) {
            console.error('[ConfidenceTracker] Failed to persist:', e);
        }
    }

    // ─── Public API ──────────────────────────────────────────────
    return {
        init,
        update,
        applyDecay,
        getScore,
        getLevel,
        isLocked,
        getHistory,
        getAllScores,
        getAllStates,
        getExamFrequency,
        getTrapSeverity,
        computePriorityScore,
        getReentryStep,
        unlock,
        reset,
        seedFromDiagnostic
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConfidenceTracker;
}
