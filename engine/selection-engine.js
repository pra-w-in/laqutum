/**
 * selection-engine.js — Laqtum Adaptive Selection Engine & Next-Item Router
 *
 * Connects ContentBank (content loader) and ConfidenceTracker (scoring engine)
 * to determine the optimal next item (question, explanation, walkthrough, clarification, escalation)
 * for a learner based on dynamic priority queue ranking, re-entry step rules,
 * checkpoint routing, early mastery fallback, and time-boxed exit planning.
 *
 * Compatible with Browser and Node.js environments.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['./content-loader', './confidence-tracker'], factory);
    } else if (typeof exports === 'object') {
        module.exports = factory(
            require('./content-loader'),
            require('./confidence-tracker')
        );
    } else {
        root.SelectionEngine = factory(root.ContentBank, root.ConfidenceTracker);
    }
}(typeof self !== 'undefined' ? self : this, function (ContentBank, ConfidenceTracker) {
    'use strict';

    let _initialized = false;
    let _history = [];

    /**
     * Initialize SelectionEngine
     */
    function init() {
        if (!_initialized) {
            _history = [];
            _initialized = true;
            // console.log('[SelectionEngine] Initialized.');
        }
    }

    function _ensureInit() {
        if (!_initialized) {
            init();
        }
    }

    /**
     * Compute and return the active priority queue of live patterns,
     * ranked by priority score descending.
     * Locked patterns and excluded patterns are moved to low priority or filtered.
     *
     * @param {object} options — { includeLocked: false }
     * @returns {Array} — Ranked pattern list [{ pattern, score, level, locked, priority }]
     */
    function getPriorityQueue(options) {
        _ensureInit();
        const includeLocked = options && options.includeLocked === true;
        const livePatterns = ContentBank.getLivePatterns();
        const queue = [];

        for (const p of livePatterns) {
            const score = ConfidenceTracker.getScore(p);
            const level = ConfidenceTracker.getLevel(p);
            const locked = ConfidenceTracker.isLocked(p);
            const priority = ConfidenceTracker.computePriorityScore(p);

            if (!locked || includeLocked) {
                queue.push({
                    pattern: p,
                    score,
                    level,
                    locked,
                    priority
                });
            }
        }

        // Sort descending by priority score
        queue.sort((a, b) => b.priority - a.priority);
        return queue;
    }

    /**
     * Main Selection Function: Determines the single best next content item to present.
     *
     * @param {object} sessionState — { currentPattern: string|null, answeredCount: number }
     * @returns {object} — { type, entry, pattern, step, reasoning, isEarlyMastery }
     */
    function getNextItem(sessionState) {
        _ensureInit();
        const livePatterns = ContentBank.getLivePatterns();

        if (livePatterns.length === 0) {
            return {
                type: 'empty',
                entry: null,
                pattern: null,
                reasoning: 'No live patterns available in ContentBank.'
            };
        }

        // 1. Check if ALL live patterns are locked or Mastered (Early Mastery Mode)
        const activeQueue = getPriorityQueue({ includeLocked: false });
        const allStates = ConfidenceTracker.getAllStates();
        const allLiveMasteredOrLocked = livePatterns.every(p => {
            const s = allStates[p];
            return s.locked || s.level === 'MASTERED';
        });

        if (activeQueue.length === 0 || allLiveMasteredOrLocked) {
            // Early Mastery / Stress-Test Mode (Section 11.2)
            return _getEarlyMasteryItem(livePatterns);
        }

        // 2. Pick highest priority pattern
        // If sessionState specifies an active pattern that is still unlocked, stick with it unless another pattern has higher priority
        let selectedPattern = activeQueue[0].pattern;
        if (sessionState && sessionState.currentPattern && livePatterns.includes(sessionState.currentPattern)) {
            const curP = sessionState.currentPattern;
            if (!ConfidenceTracker.isLocked(curP)) {
                // Keep current pattern if still active
                selectedPattern = curP;
            }
        }

        // 3. Determine re-entry step for selected pattern
        const reentryStep = ConfidenceTracker.getReentryStep(selectedPattern);
        const questions = ContentBank.getQuestions(selectedPattern);

        if (questions.length === 0) {
            // Fallback: pick next pattern in queue
            const altPattern = activeQueue.find(item => ContentBank.getQuestions(item.pattern).length > 0);
            if (altPattern) {
                return getNextItem({ ...sessionState, currentPattern: altPattern.pattern });
            }
            return _getEarlyMasteryItem(livePatterns);
        }

        // 4. Sort questions by step and difficulty, find candidate where q.step >= reentryStep
        const sortedQuestions = [...questions].sort((a, b) => {
            if (a.step !== b.step) return a.step - b.step;
            return (a.difficulty || 1) - (b.difficulty || 1);
        });

        // Find candidate question matching step target
        let candidateQuestion = sortedQuestions.find(q => (q.step || 1) >= reentryStep);
        if (!candidateQuestion) {
            candidateQuestion = sortedQuestions[sortedQuestions.length - 1]; // Fallback to last question
        }

        // 5. Check if explanation is needed before question (low confidence or step 1/3 start)
        const score = ConfidenceTracker.getScore(selectedPattern);
        if (candidateQuestion.explanation_id && (score < 0.5 || reentryStep === 1)) {
            const explanation = ContentBank.getById(candidateQuestion.explanation_id);
            if (explanation && explanation.type === 'explanation') {
                return {
                    type: 'explanation',
                    entry: explanation,
                    pattern: selectedPattern,
                    step: candidateQuestion.step || 1,
                    targetQuestion: candidateQuestion,
                    reasoning: `Concept explanation delivered before Step ${candidateQuestion.step} question (confidence score: ${score.toFixed(2)})`
                };
            }
        }

        // 6. Deliver Question
        return {
            type: 'question',
            entry: candidateQuestion,
            pattern: selectedPattern,
            step: candidateQuestion.step || 1,
            reasoning: `Delivering Step ${candidateQuestion.step || 1} question for ${selectedPattern} (Reentry target: Step ${reentryStep}, priority: ${activeQueue[0].priority.toFixed(3)})`
        };
    }

    /**
     * Early Mastery / Stress-Test Item Generator (Section 11.2)
     * Surfaces high-difficulty questions (Difficulty 4-5) across all live patterns.
     */
    function _getEarlyMasteryItem(livePatterns) {
        let hardQuestions = [];
        for (const p of livePatterns) {
            const qList = ContentBank.getQuestions(p);
            const hard = qList.filter(q => (q.difficulty || 1) >= 3 || q.step >= 5);
            hardQuestions.push(...hard);
        }

        if (hardQuestions.length === 0) {
            // Pick any live question
            for (const p of livePatterns) {
                hardQuestions.push(...ContentBank.getQuestions(p));
            }
        }

        const picked = hardQuestions[Math.floor(Math.random() * hardQuestions.length)];
        return {
            type: 'question',
            entry: picked,
            pattern: picked ? picked.pattern : livePatterns[0],
            step: picked ? picked.step : 5,
            isEarlyMastery: true,
            reasoning: 'Early Mastery Mode: All patterns Solid/Mastered. Delivering high-difficulty speed-challenge question.'
        };
    }

    /**
     * Process User Response to an Item:
     * - Updates ConfidenceTracker
     * - Checks lock-in / re-open events
     * - Evaluates post-answer / post-explanation checkpoint routing
     *
     * @param {object} item — The item returned by getNextItem()
     * @param {object} responseData — { correct: boolean, responseTimeMs: number, comprehension: string|null }
     * @returns {object} — { updateResult, nextDirective, lockEvent }
     */
    function processResponse(item, responseData) {
        _ensureInit();
        if (!item || !item.pattern) {
            return { updateResult: null, nextDirective: 'CONTINUE' };
        }

        const pattern = item.pattern;
        const entry = item.entry;

        // 1. Update Confidence Tracker
        const updateResult = ConfidenceTracker.update(pattern, {
            correct: responseData.correct,
            responseTimeMs: responseData.responseTimeMs,
            comprehension: responseData.comprehension || null
        });

        // 2. Checkpoint routing (if response includes comprehension)
        let nextDirective = 'CONTINUE';
        let resolvedItem = null;

        if (responseData.comprehension && entry) {
            const checkpointMap = entry.checkpoint_options || entry.post_answer_checkpoint;
            if (checkpointMap && checkpointMap[responseData.comprehension]) {
                const nextId = checkpointMap[responseData.comprehension].next;
                resolvedItem = ContentBank.resolveNext(nextId);
                if (resolvedItem && resolvedItem !== 'CONTINUE') {
                    nextDirective = resolvedItem.type || 'routed';
                }
            }
        }

        // 3. Record interaction in history
        _history.push({
            pattern,
            type: item.type,
            entryId: item.entryId || null,
            correct: responseData.correct,
            responseTimeMs: responseData.responseTimeMs,
            comprehension: responseData.comprehension,
            delta: updateResult ? updateResult.delta : 0,
            timestamp: new Date().toISOString()
        });

        return {
            updateResult,
            nextDirective,
            resolvedItem,
            patternLocked: updateResult ? updateResult.locked : false
        };
    }

    /**
     * Time-Boxed Exit Generator (Section 11.3 & Section 6)
     * Calculates the top N highest-impact unmastered items when study time budget runs out.
     *
     * @param {number} limit — Default 3
     * @returns {Array} — [{ pattern, score, priority, recommendedQuestion }]
     */
    function getTimeBoxedExitList(limit) {
        _ensureInit();
        const n = limit || 3;
        const queue = getPriorityQueue({ includeLocked: true });

        // Filter for unmastered patterns
        const unmastered = queue.filter(item => item.level !== 'MASTERED');
        const targetList = unmastered.length > 0 ? unmastered : queue;
        const topTargets = targetList.slice(0, n);

        return topTargets.map(target => {
            const questions = ContentBank.getQuestions(target.pattern);
            // Recommend step-3 single-knot or step-1 clean example
            const recQ = questions.find(q => q.step === 3) || questions.find(q => q.step === 1) || questions[0] || null;
            return {
                pattern: target.pattern,
                score: target.score,
                level: target.level,
                priority: target.priority,
                recommendedQuestion: recQ
            };
        });
    }

    /**
     * Get overall engine statistics
     */
    function getStats() {
        _ensureInit();
        const livePatterns = ContentBank.getLivePatterns();
        const states = ConfidenceTracker.getAllStates();

        let mastered = 0;
        let solid = 0;
        let emerging = 0;
        let notRecognized = 0;
        let locked = 0;

        for (const p of livePatterns) {
            const s = states[p];
            if (s.locked) locked++;
            if (s.level === 'MASTERED') mastered++;
            else if (s.level === 'SOLID') solid++;
            else if (s.level === 'EMERGING') emerging++;
            else notRecognized++;
        }

        return {
            totalLivePatterns: livePatterns.length,
            mastered,
            solid,
            emerging,
            notRecognized,
            locked,
            isFullyMastered: (mastered + solid) === livePatterns.length,
            interactionsLogged: _history.length
        };
    }

    // Public API
    return {
        init,
        getPriorityQueue,
        getNextItem,
        processResponse,
        getTimeBoxedExitList,
        getStats
    };
}));
