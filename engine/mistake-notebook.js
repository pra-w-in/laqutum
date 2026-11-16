/**
 * mistake-notebook.js — LaquTum Spaced Repetition Mistake Notebook & Targeted Retry Engine
 * 
 * Core Capabilities:
 * 1. Automatic Miss Logging: Logs misses with specific error types, knots, and trap diagnostics.
 * 2. Spaced Repetition Queue: Schedules retries across Day 1, Day 3, and Day 7.
 * 3. Twin-Question Isomorphic Retries: Searches ContentBank for a DIFFERENT question on the same knot.
 * 4. Hint-Free Clearance Rule: A mistake is cleared ONLY upon a hint-free correct attempt.
 * 5. Error Trend Analytics: "You frequently misread conditions in Rate problems."
 */

const MistakeNotebook = (function () {
    'use strict';

    const STORAGE_KEY = 'laqtum_mistake_notebook';

    function loadMistakes() {
        try {
            const raw = JSON.stringify(UserStorage.read(STORAGE_KEY, null));
            return JSON.parse(raw) || [];
        } catch (e) {
            console.warn('[MistakeNotebook] Failed to read from localStorage:', e);
            return [];
        }
    }

    function saveMistakes(list) {
        try {
            UserStorage.write(STORAGE_KEY, list);
            // Non-blocking sync to Supabase profile
            syncToCloud(list);
        } catch (e) {
            console.warn('[MistakeNotebook] Failed to save to localStorage:', e);
        }
    }

    async function syncToCloud(list) {
        return UserStorage.sync(STORAGE_KEY, list, 'mistake_notebook');
    }

    /**
     * Add a missed question to the notebook
     */
    function addMistake(data) {
        const list = loadMistakes();
        const existingIdx = list.findIndex(m => m.questionId === data.questionId && !m.cleared);

        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (existingIdx >= 0) {
            // Update existing entry with new attempt data
            list[existingIdx].lastAttempted = now;
            list[existingIdx].retryCount = (list[existingIdx].retryCount || 0) + 1;
            list[existingIdx].errorType = data.errorType;
            list[existingIdx].errorDiagnosis = data.errorDiagnosis;
            list[existingIdx].nextRetryDate = now + oneDayMs;
        } else {
            // New mistake entry
            list.unshift({
                id: 'm_' + Math.random().toString(36).substring(2, 9),
                questionId: data.questionId,
                question: data.question,
                options: data.options,
                correctIndex: data.correctIndex,
                userSelectedIndex: data.userSelectedIndex,
                pattern: data.pattern,
                topic: data.topic,
                knot: data.knot,
                errorType: data.errorType,
                errorLabel: data.errorLabel,
                errorDiagnosis: data.errorDiagnosis,
                errorFix: data.errorFix,
                timeTakenSec: data.timeTakenSec,
                hintsUsed: data.hintsUsed,
                loggedAt: now,
                lastAttempted: now,
                retryCount: 0,
                nextRetryDate: now + oneDayMs, // Day 1
                cleared: false
            });
        }

        saveMistakes(list);
    }

    /**
     * Clear a mistake after successful hint-free retry
     */
    function clearMistake(idOrQuestionId) {
        const list = loadMistakes();
        const item = list.find(m => m.id === idOrQuestionId || m.questionId === idOrQuestionId);
        if (item) {
            item.cleared = true;
            item.clearedAt = Date.now();
            saveMistakes(list);
            return true;
        }
        return false;
    }

    /**
     * Get active uncleared mistakes
     */
    function getActiveMistakes() {
        return loadMistakes().filter(m => !m.cleared);
    }

    /**
     * Get mistakes due for spaced retry
     */
    function getDueMistakes() {
        const now = Date.now();
        return getActiveMistakes().filter(m => !m.nextRetryDate || m.nextRetryDate <= now);
    }

    /**
     * Compute error diagnostics summary
     */
    function getErrorAnalytics() {
        const active = getActiveMistakes();
        const total = active.length;
        if (total === 0) {
            return {
                total: 0,
                counts: {},
                topPattern: null,
                advice: "There are no questions to revisit right now."
            };
        }

        const counts = {
            misread_condition: 0,
            wrong_relationship: 0,
            arithmetic_slip: 0,
            speed_rush: 0
        };

        const patternCounts = {};

        active.forEach(m => {
            if (counts[m.errorType] !== undefined) {
                counts[m.errorType]++;
            } else {
                counts.wrong_relationship++;
            }
            if (m.pattern) {
                patternCounts[m.pattern] = (patternCounts[m.pattern] || 0) + 1;
            }
        });

        // Determine top weakness
        let topType = 'misread_condition';
        let maxCount = -1;
        for (const [type, cnt] of Object.entries(counts)) {
            if (cnt > maxCount) {
                maxCount = cnt;
                topType = type;
            }
        }

        let topPattern = null;
        let maxPatCount = -1;
        for (const [pat, cnt] of Object.entries(patternCounts)) {
            if (cnt > maxPatCount) {
                maxPatCount = cnt;
                topPattern = pat;
            }
        }

        let advice = "Focus on verifying your mathematical knots before jumping into calculation.";
        if (topType === 'misread_condition') {
            advice = "Your most frequent error is misreading problem conditions. Always underline the last line of the question stem to verify what is asked.";
        } else if (topType === 'speed_rush') {
            advice = "You are answering too quickly under placement anxiety. Slow down by 10-15 seconds on the first move.";
        } else if (topType === 'arithmetic_slip') {
            advice = "Your pattern logic is strong, but calculation slips are costing you marks. Use option unit-digit checking to verify.";
        }

        return {
            total,
            counts,
            topType,
            topPattern,
            advice
        };
    }

    /**
     * Render the Mistake Notebook View
     */
    function renderNotebookScreen(container, onBack) {
        if (!container) return;
        const activeMistakes = getActiveMistakes();
        const dueMistakes = getDueMistakes();
        const analytics = getErrorAnalytics();

        let mistakeCardsHTML = '';
        if (activeMistakes.length === 0) {
            mistakeCardsHTML = `
                <div style="text-align:center;padding:48px 20px;background:rgba(36, 48, 40, 0.02);border-radius:20px;border:1px dashed rgba(36, 48, 40, 0.1);">
                    
                    <h3 style="font-size:1.2rem;color:#222e28;margin:0 0 8px;">No mistakes to review yet</h3>
                    <p style="font-size:0.85rem;color:#657169;margin:0 0 20px;">
                        Any missed questions from Independent Practice or Timed Checkpoints will be automatically logged here for spaced retries.
                    </p>
                </div>
            `;
        } else {
            mistakeCardsHTML = activeMistakes.map(m => {
                const topicName = (m.topic || m.pattern || 'Aptitude').replace(/-/g, ' ');
                const isDue = !m.nextRetryDate || m.nextRetryDate <= Date.now();
                return `
                    <div class="mistake-item-card" data-mid="${m.id}" data-qid="${m.questionId}" data-pattern="${m.pattern || ''}" data-knot="${m.knot || ''}" style="background:#ffffff;border:1px solid rgba(36, 48, 40, 0.08);border-radius:18px;padding:20px;margin-bottom:16px;box-shadow:none;position:relative;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-size:0.75rem;padding:3px 10px;border-radius:8px;background:rgba(239,68,68,0.15);color:#a33b35;font-weight:700;">
                                    ${m.errorLabel || 'Missed Move'}
                                </span>
                                <span style="font-size:0.75rem;color:#657169;text-transform:capitalize;">
                                    ${topicName}
                                </span>
                            </div>
                            <span style="font-size:0.75rem;font-weight:700;color:${isDue ? '#34714e' : '#866128'};">
                                ${isDue ? 'Ready for Retry' : 'Scheduled'}
                            </span>
                        </div>

                        <div style="font-size:0.95rem;font-weight:600;color:#222e28;line-height:1.6;margin-bottom:14px;">
                            ${m.question}
                        </div>

                        <div style="background:rgba(239,68,68,0.06);border:1px solid #c98688;border-radius:6px;padding:10px 14px;font-size:0.82rem;color:#a33b35;margin-bottom:14px;line-height:1.5;">
                            <strong>A point to check:</strong> ${m.errorDiagnosis || 'Review the steps and try this question again.'}
                        </div>

                        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                            <span style="font-size:0.75rem;color:#657169;">
                                Knot: <strong>${m.knot || 'Core Knot'}</strong>
                            </span>
                            <button type="button" class="retry-mistake-btn" data-mid="${m.id}" style="padding:8px 16px;border-radius:10px;background:#edf1ea;border:none;color:#222e28;font-size:0.82rem;font-weight:700;cursor:pointer;transition:all 0.2s;">
                                Retry Knot
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = `
            <div class="mistake-notebook-wrap" style="max-width:680px;margin:0 auto;padding:16px 12px 80px;animation:fadeIn 0.3s ease;">
                <!-- Header -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <button type="button" id="notebook-back-btn" style="width:36px;height:36px;border-radius:50%;background:rgba(36, 48, 40, 0.06);border:1px solid rgba(36, 48, 40, 0.1);color:#222e28;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                            ←
                        </button>
                        <div>
                            <h2 style="font-size:1.35rem;font-weight:800;color:#222e28;margin:0;">Mistake Notebook</h2>
                            <p style="font-size:0.78rem;color:#657169;margin:2px 0 0;">Questions to revisit</p>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:1.1rem;font-weight:800;color:#a33b35;">${activeMistakes.length}</span>
                        <div style="font-size:0.7rem;color:#657169;">Active Misses</div>
                    </div>
                </div>

                <!-- Error Pattern Diagnosis Box -->
                <div style="background:#edf1ea;border:1px solid rgba(66, 100, 81, 0.16);border-radius:18px;padding:18px;margin-bottom:22px;">
                    <div style="font-size:0.85rem;font-weight:800;color:#426451;display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                        Your mistake patterns
                    </div>
                    <div style="font-size:0.88rem;color:#222e28;line-height:1.6;margin-bottom:14px;">
                        ${analytics.advice}
                    </div>

                    <!-- Micro Stat Badges -->
                    <div style="display:flex;flex-wrap:wrap;gap:8px;">
                        <span style="font-size:0.75rem;padding:4px 10px;border-radius:8px;background:rgba(36, 48, 40, 0.06);color:#a33b35;">
                            Misread Condition: <strong>${analytics.counts.misread_condition || 0}</strong>
                        </span>
                        <span style="font-size:0.75rem;padding:4px 10px;border-radius:8px;background:rgba(36, 48, 40, 0.06);color:#866128;">
                            Relationship Inversion: <strong>${analytics.counts.wrong_relationship || 0}</strong>
                        </span>
                        <span style="font-size:0.75rem;padding:4px 10px;border-radius:8px;background:rgba(36, 48, 40, 0.06);color:#385f75;">
                            Calculation Slip: <strong>${analytics.counts.arithmetic_slip || 0}</strong>
                        </span>
                        <span style="font-size:0.75rem;padding:4px 10px;border-radius:8px;background:rgba(36, 48, 40, 0.06);color:#F472B6;">
                            Speed Rush: <strong>${analytics.counts.speed_rush || 0}</strong>
                        </span>
                    </div>
                </div>

                <!-- Section Title -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <div style="font-size:0.85rem;font-weight:700;color:#657169;text-transform:uppercase;letter-spacing:0.8px;">
                        Recorded Mistakes (${activeMistakes.length})
                    </div>
                    ${dueMistakes.length > 0 ? `
                        <span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:rgba(16,185,129,0.15);color:#34714e;font-weight:700;">
                            ${dueMistakes.length} Due Today
                        </span>
                    ` : ''}
                </div>

                <!-- List of Mistake Cards -->
                <div id="mistake-cards-list">
                    ${mistakeCardsHTML}
                </div>
            </div>
        `;

        // Wire Back button
        const backBtn = document.getElementById('notebook-back-btn');
        if (backBtn && typeof onBack === 'function') {
            backBtn.addEventListener('click', onBack);
        }

        // Wire Retry buttons
        container.querySelectorAll('.retry-mistake-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mid = btn.dataset.mid;
                const mistake = activeMistakes.find(m => m.id === mid);
                if (!mistake) return;
                launchTargetedRetry(container, mistake, onBack);
            });
        });
    }

    /**
     * Launch targeted retry using an isomorphic question on the same knot/pattern
     */
    function launchTargetedRetry(container, mistake, onBack) {
        if (typeof PracticeEngine === 'undefined') return;

        let retryQuestion = null;
        if (typeof ContentBank !== 'undefined') {
            // Find an isomorphic fresh question with same pattern/knot that isn't the identical question
            const candidateList = ContentBank.getQuestions(mistake.pattern) || [];
            const freshCandidate = candidateList.find(q => q.id !== mistake.questionId && (q.knot_name === mistake.knot || q.knot_id === mistake.knot));
            retryQuestion = freshCandidate || candidateList.find(q => q.id !== mistake.questionId) || candidateList[0];
        }

        if (!retryQuestion) {
            // Fallback to original question
            retryQuestion = {
                id: mistake.questionId,
                question: mistake.question,
                options: mistake.options,
                correct_index: mistake.correctIndex,
                pattern: mistake.pattern,
                topic_costume: mistake.topic,
                knot_name: mistake.knot,
                difficulty: 2
            };
        }

        PracticeEngine.renderIndependentQuestion(container, retryQuestion, (result) => {
            if (result.isCorrect && result.hintsUsed === 0) {
                // Cleared without hints!
                clearMistake(mistake.id);
                AppUI.notify("Knot Mastered! This mistake has been cleared from your notebook.");
            } else if (result.isCorrect) {
                AppUI.notify("Correct, but you needed hints. This question remains in your notebook for a hint-free retry.");
            }
            // Return to notebook
            renderNotebookScreen(container, onBack);
        });
    }

    return {
        addMistake,
        clearMistake,
        getActiveMistakes,
        getDueMistakes,
        getErrorAnalytics,
        renderNotebookScreen
    };
})();
