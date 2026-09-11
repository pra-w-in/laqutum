/**
 * content-loader.js — Laqtum Runtime Content Indexer
 *
 * Fetches the pre-built content-bank.json (produced by build-content.js),
 * builds in-memory indexes, and exposes lookup functions.
 *
 * Usage:
 *   <script src="engine/content-loader.js"></script>
 *   await ContentBank.init();
 *   const q = ContentBank.getById('p4_percentages_clean_001');
 */

const ContentBank = (function () {
    'use strict';

    // ─── Private state ───────────────────────────────────────────
    let _loaded = false;
    let _stats = null;

    // Indexes
    const _byId = new Map();
    const _byPattern = new Map();         // pattern → entry[]
    const _byPatternAndType = new Map();  // "P4:question" → entry[]
    const _byKnotId = new Map();          // knot_id → entry[]
    const _byCostume = new Map();         // topic_costume → entry[]
    const _livePatterns = new Set();
    const _excludedPatterns = new Set();

    // ─── Initialization ──────────────────────────────────────────
    async function init(bankUrl) {
        if (_loaded) return;

        const url = bankUrl || 'content-bank.json';
        let data;

        try {
            if (typeof window === 'undefined' && typeof require !== 'undefined') {
                const fs = require('fs');
                const path = require('path');
                const filePath = path.isAbsolute(url) ? url : path.join(process.cwd(), url);
                data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            } else {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                data = await response.json();
            }
        } catch (e) {
            // console.error(`[ContentBank] Failed to load content bank from "${url}":`, e);
            throw e;
        }

        _stats = data.stats;
        const entries = data.entries || [];

        // Populate live/excluded pattern sets
        if (data.stats.patternsLive) {
            data.stats.patternsLive.forEach(p => _livePatterns.add(p));
        }
        if (data.stats.patternsExcluded) {
            data.stats.patternsExcluded.forEach(p => _excludedPatterns.add(p));
        }

        // Build indexes
        for (const entry of entries) {
            // byId
            if (entry.id) {
                if (_byId.has(entry.id)) {
                    // console.warn(`[ContentBank] Duplicate ID at runtime: "${entry.id}"`);
                }
                _byId.set(entry.id, entry);
            }

            // byPattern
            if (entry.pattern) {
                if (!_byPattern.has(entry.pattern)) _byPattern.set(entry.pattern, []);
                _byPattern.get(entry.pattern).push(entry);

                // byPatternAndType
                if (entry.type) {
                    const key = `${entry.pattern}:${entry.type}`;
                    if (!_byPatternAndType.has(key)) _byPatternAndType.set(key, []);
                    _byPatternAndType.get(key).push(entry);
                }
            }

            // byKnotId
            if (entry.knot_id) {
                if (!_byKnotId.has(entry.knot_id)) _byKnotId.set(entry.knot_id, []);
                _byKnotId.get(entry.knot_id).push(entry);
            }

            // byCostume
            if (entry.topic_costume) {
                if (!_byCostume.has(entry.topic_costume)) _byCostume.set(entry.topic_costume, []);
                _byCostume.get(entry.topic_costume).push(entry);
            }
        }

        _loaded = true;
        console.log(`[ContentBank] Loaded ${entries.length} entries. Live patterns: ${[..._livePatterns].join(', ')}`);
    }

    // ─── Lookup functions ────────────────────────────────────────

    function getById(id) {
        _ensureLoaded();
        return _byId.get(id) || null;
    }

    function getByPattern(pattern) {
        _ensureLoaded();
        return _byPattern.get(pattern) || [];
    }

    function getQuestions(pattern) {
        _ensureLoaded();
        return _byPatternAndType.get(`${pattern}:question`) || [];
    }

    function getExplanations(pattern) {
        _ensureLoaded();
        return _byPatternAndType.get(`${pattern}:explanation`) || [];
    }

    function getEscalations(pattern) {
        _ensureLoaded();
        return _byPatternAndType.get(`${pattern}:escalation`) || [];
    }

    function getClarifications(pattern) {
        _ensureLoaded();
        return _byPatternAndType.get(`${pattern}:clarification`) || [];
    }

    function getWalkthroughs(pattern) {
        _ensureLoaded();
        return _byPatternAndType.get(`${pattern}:guided_walkthrough`) || [];
    }

    function getByKnot(knotId) {
        _ensureLoaded();
        return _byKnotId.get(knotId) || [];
    }

    function isPatternLive(pattern) {
        _ensureLoaded();
        return _livePatterns.has(pattern);
    }

    function getLivePatterns() {
        _ensureLoaded();
        return [..._livePatterns];
    }

    function getExcludedPatterns() {
        _ensureLoaded();
        return [..._excludedPatterns];
    }

    function getStats() {
        _ensureLoaded();
        return _stats;
    }

    /**
     * resolveNext — Given a 'next' value from a checkpoint, resolve it.
     *
     * Returns:
     *   - The string "CONTINUE" if nextValue is "CONTINUE"
     *   - The resolved entry object if the ID exists
     *   - null if the ID is dangling (caller must handle per Section 11.8)
     */
    function resolveNext(nextValue) {
        _ensureLoaded();
        if (nextValue === 'CONTINUE') return 'CONTINUE';
        if (!nextValue) return null;
        const entry = _byId.get(nextValue);
        if (!entry) {
            // console.error(`[ContentBank] DANGLING REFERENCE: "${nextValue}" not found in content bank. Falling back to CONTINUE.`);
            return null;
        }
        return entry;
    }

    /**
     * getQuestionsForDiagnostic — Returns one question per live pattern for initial diagnostic.
     * Picks the step-1 (clean example, knot_id=null) question with lowest difficulty.
     */
    function getQuestionsForDiagnostic() {
        _ensureLoaded();
        const diagnosticQuestions = [];
        for (const pattern of _livePatterns) {
            const questions = getQuestions(pattern);
            // Prefer step-1 clean examples (no knot)
            const cleanExamples = questions.filter(q => q.knot_id === null && q.step === 1);
            if (cleanExamples.length > 0) {
                // Pick lowest difficulty
                cleanExamples.sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1));
                diagnosticQuestions.push(cleanExamples[0]);
            } else if (questions.length > 0) {
                // Fallback: pick any question with lowest difficulty
                const sorted = [...questions].sort((a, b) => (a.difficulty || 1) - (b.difficulty || 1));
                diagnosticQuestions.push(sorted[0]);
            }
        }
        return diagnosticQuestions;
    }

    /**
     * getQuestionsByCostumes — Returns all 'question' type entries matching any of the given costumes.
     */
    function getQuestionsByCostumes(costumes) {
        _ensureLoaded();
        const results = [];
        const seen = new Set();
        for (const costume of costumes) {
            const entries = _byCostume.get(costume) || [];
            for (const e of entries) {
                if (e.type === 'question' && e.id && !seen.has(e.id)) {
                    seen.add(e.id);
                    results.push(e);
                }
            }
        }
        return results;
    }

    /**
     * hasCostumeContent — Returns true if any of the given costumes have content loaded.
     */
    function hasCostumeContent(costumes) {
        _ensureLoaded();
        for (const costume of costumes) {
            if (_byCostume.has(costume) && _byCostume.get(costume).length > 0) return true;
        }
        return false;
    }

    // ─── Internal helpers ────────────────────────────────────────

    function _ensureLoaded() {
        if (!_loaded) {
            throw new Error('[ContentBank] Not initialized. Call await ContentBank.init() first.');
        }
    }

    // ─── Public API ──────────────────────────────────────────────
    return {
        init,
        getById,
        getByPattern,
        getQuestions,
        getExplanations,
        getEscalations,
        getClarifications,
        getWalkthroughs,
        getByKnot,
        isPatternLive,
        getLivePatterns,
        getExcludedPatterns,
        getStats,
        resolveNext,
        getQuestionsForDiagnostic,
        getQuestionsByCostumes,
        hasCostumeContent
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ContentBank;
}
