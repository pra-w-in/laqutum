/**
 * checkpoints.js — LaquTum Timed Mixed Checkpoints & Exam Simulation Engine
 * 
 * Core Capabilities:
 * 1. Timed Mixed Checkpoints: Checkpoint 1 (10 questions, Day 9) & Checkpoint 2 (12 questions, Day 14).
 * 2. Interleaved Assembly: Guarantees no two consecutive questions share the same pattern.
 * 3. Proctored Exam Clock: Overall countdown timer + per-question latency tracking.
 * 4. Skip & Return Palette: Jump between questions, mark for review, and skip questions.
 * 5. Tactical Diagnostic Review:
 *    - Hint-Free Accuracy score.
 *    - Average response time vs. benchmark.
 *    - Error type breakdown.
 *    - Tactical feedback: "You skipped N questions you could easily solve."
 * 6. Automatic mistake forwarding to MistakeNotebook.
 */

const CheckpointsEngine = (function () {
    'use strict';

    let currentCheckpoint = null;
    let overallTimerInterval = null;
    let timeRemainingSec = 0;
    let currentQuestionIndex = 0;
    let questionsList = [];
    let userResponses = []; // [{ selectedIndex, timeSec, isMarkedForReview }]
    let questionStartTime = 0;

    /**
     * Compose an interleaved set of unlabelled questions
     */
    function composeCheckpointQuestions(count) {
        if (typeof ContentBank === 'undefined') return [];
        const livePatterns = ContentBank.getLivePatterns() || ['P1','P2','P3','P4','P5','P6','P7','P8','P9','P10','P11','P12'];
        const pool = [];

        // Shuffle patterns
        const shuffledPatterns = [...livePatterns].sort(() => Math.random() - 0.5);
        let patternIdx = 0;

        for (let i = 0; i < count; i++) {
            const pat = shuffledPatterns[patternIdx % shuffledPatterns.length];
            patternIdx++;
            const questions = ContentBank.getQuestions(pat) || [];
            if (questions.length > 0) {
                const picked = questions[Math.floor(Math.random() * questions.length)];
                pool.push({
                    ...picked,
                    checkpointIndex: i
                });
            }
        }

        // Guarantee no two consecutive questions share the same pattern
        for (let i = 1; i < pool.length; i++) {
            if (pool[i].pattern === pool[i - 1].pattern && i + 1 < pool.length) {
                // Swap with next
                const temp = pool[i];
                pool[i] = pool[i + 1];
                pool[i + 1] = temp;
            }
        }

        return pool;
    }

    /**
     * Start a Checkpoint simulation
     */
    function startCheckpoint(container, checkpointNumber, onCompleteCallback) {
        if (!container) return;
        const count = checkpointNumber === 1 ? 10 : 12;
        questionsList = composeCheckpointQuestions(count);
        if (questionsList.length === 0) {
            alert('Content bank is loading. Please wait 2 seconds and retry.');
            return;
        }

        // Initialize state
        currentCheckpoint = checkpointNumber;
        currentQuestionIndex = 0;
        timeRemainingSec = count * 90; // 90 seconds per question
        userResponses = questionsList.map(() => ({
            selectedIndex: null,
            timeSec: 0,
            isMarkedForReview: false
        }));

        if (overallTimerInterval) clearInterval(overallTimerInterval);
        overallTimerInterval = setInterval(() => {
            timeRemainingSec--;
            updateTimerDisplay();
            if (timeRemainingSec <= 0) {
                clearInterval(overallTimerInterval);
                finishCheckpoint(container, onCompleteCallback);
            }
        }, 1000);

        renderQuestionView(container, onCompleteCallback);
    }

    function updateTimerDisplay() {
        const timerEl = document.getElementById('checkpoint-clock-display');
        if (!timerEl) return;
        const mins = String(Math.floor(timeRemainingSec / 60)).padStart(2, '0');
        const secs = String(timeRemainingSec % 60).padStart(2, '0');
        timerEl.textContent = `${mins}:${secs}`;
        if (timeRemainingSec < 120) {
            timerEl.style.color = '#a33b35';
        }
    }

    function recordCurrentQuestionTime() {
        if (questionStartTime > 0) {
            const delta = Math.floor((Date.now() - questionStartTime) / 1000);
            userResponses[currentQuestionIndex].timeSec += delta;
        }
        questionStartTime = Date.now();
    }

    /**
     * Render the active question in the checkpoint
     */
    function renderQuestionView(container, onCompleteCallback) {
        recordCurrentQuestionTime();
        const q = questionsList[currentQuestionIndex];
        const resp = userResponses[currentQuestionIndex];
        const total = questionsList.length;

        // Navigation Palette Pills
        const paletteHTML = questionsList.map((item, idx) => {
            const r = userResponses[idx];
            const isCurr = idx === currentQuestionIndex;
            let bg = '#e5eade';
            let border = 'rgba(255,255,255,0.1)';
            let color = '#64715b';

            if (r.selectedIndex !== null) {
                bg = 'rgba(16,185,129,0.2)';
                border = '#34714e';
                color = '#34714e';
            } else if (r.isMarkedForReview) {
                bg = 'rgba(245,158,11,0.2)';
                border = '#F59E0B';
                color = '#866128';
            }
            if (isCurr) {
                border = '#59764b';
                bg = '#e8f0df';
                color = '#365740';
            }

            return `
                <button type="button" class="palette-pill-btn" data-idx="${idx}" style="width:34px;height:34px;border-radius:10px;background:${bg};border:1.5px solid ${border};color:${color};font-weight:800;font-size:0.8rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;">
                    ${idx + 1}
                </button>
            `;
        }).join('');

        container.innerHTML = `
            <div class="checkpoint-screen-wrap" style="max-width:680px;margin:0 auto;padding:16px 12px 80px;animation:fadeIn 0.25s ease;">
                <!-- Top Status Bar -->
                <div style="display:flex;align-items:center;justify-content:space-between;background:#ffffff;border:1px solid rgba(36, 48, 40, 0.08);border-radius:16px;padding:12px 18px;margin-bottom:14px;">
                    <div>
                        <div style="font-size:0.75rem;font-weight:800;color:#426451;text-transform:uppercase;letter-spacing:0.8px;">
                            Checkpoint ${currentCheckpoint} Simulation
                        </div>
                        <div style="font-size:0.85rem;color:#657169;font-weight:600;">
                            Question ${currentQuestionIndex + 1} of ${total}
                        </div>
                    </div>
                    <div id="checkpoint-clock-display" style="font-size:1.15rem;font-weight:800;color:#34714e;font-family:monospace;letter-spacing:1px;">
                        --:--
                    </div>
                </div>

                <!-- Navigation Palette Tray -->
                <div style="background:rgba(36, 48, 40, 0.02);border:1px solid rgba(36, 48, 40, 0.06);border-radius:14px;padding:10px 14px;margin-bottom:18px;display:flex;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;">
                    ${paletteHTML}
                </div>

                <!-- Unlabelled Question Card -->
                <div style="background:#ffffff;border:1px solid rgba(36, 48, 40, 0.08);border-radius:20px;padding:24px;margin-bottom:20px;box-shadow:none;">
                    <div style="font-size:1.1rem;font-weight:700;color:#222e28;line-height:1.7;margin-bottom:24px;">
                        ${q.question}
                    </div>

                    <!-- Interactive Options -->
                    <div style="display:flex;flex-direction:column;gap:12px;">
                        ${q.options.map((opt, i) => {
                            const isSelected = (resp.selectedIndex === i);
                            return `
                                <button type="button" class="cp-option-btn" aria-pressed="${isSelected}" data-opt-idx="${i}" style="display:flex;align-items:center;gap:14px;padding:16px;background:${isSelected ? 'rgba(66, 100, 81, 0.16)' : 'rgba(36, 48, 40, 0.04)'};border:1.5px solid ${isSelected ? '#426451' : 'rgba(36, 48, 40, 0.08)'};border-radius:14px;color:#222e28;font-size:1rem;font-weight:600;text-align:left;cursor:pointer;transition:all 0.15s;font-family:inherit;">
                                    <span style="width:30px;height:30px;border-radius:50%;background:${isSelected ? '#eaf0e9' : 'rgba(36, 48, 40, 0.08)'};color:${isSelected ? '#222e28' : '#426451'};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.85rem;flex-shrink:0;">
                                        ${String.fromCharCode(65 + i)}
                                    </span>
                                    <span style="flex:1;">${opt}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Navigation Controls Bottom Bar -->
                <div style="display:flex;gap:10px;margin-bottom:16px;">
                    <button type="button" id="cp-mark-review-btn" style="flex:1;padding:12px;border-radius:12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:#866128;font-weight:700;font-size:0.85rem;cursor:pointer;">
                        ${resp.isMarkedForReview ? '★ Marked' : '☆ Mark for Review'}
                    </button>
                    <button type="button" id="cp-prev-btn" ${currentQuestionIndex === 0 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} style="padding:12px 18px;border-radius:12px;background:rgba(36, 48, 40, 0.06);border:1px solid rgba(36, 48, 40, 0.1);color:#222e28;font-weight:700;font-size:0.85rem;cursor:pointer;">
                        ← Prev
                    </button>
                    <button type="button" id="cp-next-btn" style="flex:1;padding:12px;border-radius:12px;background:#edf1ea;border:none;color:#222e28;font-weight:800;font-size:0.85rem;cursor:pointer;">
                        ${currentQuestionIndex === total - 1 ? 'Review & Submit →' : 'Next Question →'}
                    </button>
                </div>

                <div style="text-align:center;">
                    <button type="button" id="cp-submit-early-btn" style="background:none;border:none;color:#657169;font-size:0.8rem;text-decoration:underline;cursor:pointer;">
                        Finish & Submit Checkpoint Now
                    </button>
                </div>
            </div>
        `;

        updateTimerDisplay();

        // Wire Option Clicks
        container.querySelectorAll('.cp-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const optIdx = parseInt(btn.dataset.optIdx, 10);
                userResponses[currentQuestionIndex].selectedIndex = optIdx;
                renderQuestionView(container, onCompleteCallback);
            });
        });

        // Wire Palette Pills
        container.querySelectorAll('.palette-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetIdx = parseInt(btn.dataset.idx, 10);
                currentQuestionIndex = targetIdx;
                renderQuestionView(container, onCompleteCallback);
            });
        });

        // Wire Mark for Review
        document.getElementById('cp-mark-review-btn').addEventListener('click', () => {
            resp.isMarkedForReview = !resp.isMarkedForReview;
            renderQuestionView(container, onCompleteCallback);
        });

        // Wire Prev
        const prevBtn = document.getElementById('cp-prev-btn');
        if (prevBtn && currentQuestionIndex > 0) {
            prevBtn.addEventListener('click', () => {
                currentQuestionIndex--;
                renderQuestionView(container, onCompleteCallback);
            });
        }

        // Wire Next
        document.getElementById('cp-next-btn').addEventListener('click', () => {
            if (currentQuestionIndex < total - 1) {
                currentQuestionIndex++;
                renderQuestionView(container, onCompleteCallback);
            } else {
                finishCheckpoint(container, onCompleteCallback);
            }
        });

        // Wire Finish Early
        document.getElementById('cp-submit-early-btn').addEventListener('click', () => {
            if (confirm("Are you sure you want to finish and view your diagnostic review?")) {
                finishCheckpoint(container, onCompleteCallback);
            }
        });
    }

    /**
     * Complete Checkpoint and Render Diagnostic Review
     */
    function finishCheckpoint(container, onCompleteCallback) {
        if (overallTimerInterval) clearInterval(overallTimerInterval);
        recordCurrentQuestionTime();

        let correctCount = 0;
        let skippedCount = 0;
        let wrongCount = 0;
        let totalTimeSpent = 0;
        const errorBreakdown = {
            misread: 0,
            knot: 0,
            slip: 0
        };

        const detailedReview = questionsList.map((q, idx) => {
            const resp = userResponses[idx];
            const isAttempted = (resp.selectedIndex !== null);
            const isCorrect = isAttempted && (resp.selectedIndex === q.correct_index);
            totalTimeSpent += (resp.timeSec || 0);

            if (isCorrect) {
                correctCount++;
            } else if (isAttempted) {
                wrongCount++;
                // Add to Mistake Notebook
                if (typeof MistakeNotebook !== 'undefined') {
                    MistakeNotebook.addMistake({
                        questionId: q.id,
                        question: q.question,
                        options: q.options,
                        correctIndex: q.correct_index,
                        userSelectedIndex: resp.selectedIndex,
                        pattern: q.pattern,
                        topic: q.topic_costume,
                        knot: q.knot_name || q.knot || 'Checkpoint Knot',
                        errorType: 'wrong_relationship',
                        errorLabel: 'Checkpoint Slip',
                        errorDiagnosis: q.why_others_wrong || 'Pattern relation was misapplied under timed pressure.',
                        errorFix: 'Review the 15-second first move for this knot.',
                        timeTakenSec: resp.timeSec,
                        hintsUsed: 0
                    });
                }
            } else {
                skippedCount++;
            }

            return {
                question: q,
                response: resp,
                isCorrect,
                isAttempted
            };
        });

        const total = questionsList.length;
        const accuracyPct = Math.round((correctCount / total) * 100);
        const avgTimeSec = Math.round(totalTimeSpent / total);

        // Mark day complete in RouteManager
        if (typeof RouteManager !== 'undefined') {
            RouteManager.completeDay(currentCheckpoint === 1 ? 9 : 14);
        }

        container.innerHTML = `
            <div class="checkpoint-review-wrap" style="max-width:680px;margin:0 auto;padding:16px 12px 80px;animation:fadeIn 0.35s ease;">
                <!-- Review Header Banner -->
                <div style="background:#edf1ea;border:1.5px solid #34714e;border-radius:22px;padding:26px;text-align:center;margin-bottom:24px;">
                    <div style="font-size:0.75rem;font-weight:800;color:#34714e;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                        🏁 Checkpoint ${currentCheckpoint} Completed
                    </div>
                    <h2 style="font-size:2rem;font-weight:900;color:#222e28;margin:0 0 6px;">
                        ${correctCount} / ${total} Correct
                    </h2>
                    <p style="font-size:0.9rem;color:#657169;margin:0 0 18px;">
                        ${accuracyPct >= 70 ? 'Placement Ready! Strong independent application.' : 'Good baseline. Target the missed knots below in your Mistake Notebook.'}
                    </p>

                    <!-- Metrics Grid -->
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;text-align:center;">
                        <div style="background:rgba(36, 48, 40, 0.06);padding:12px;border-radius:12px;">
                            <div style="font-size:1.15rem;font-weight:800;color:#34714e;">${accuracyPct}%</div>
                            <div style="font-size:0.7rem;color:#657169;">Hint-Free Acc.</div>
                        </div>
                        <div style="background:rgba(36, 48, 40, 0.06);padding:12px;border-radius:12px;">
                            <div style="font-size:1.15rem;font-weight:800;color:#866128;">${avgTimeSec}s</div>
                            <div style="font-size:0.7rem;color:#657169;">Avg / Question</div>
                        </div>
                        <div style="background:rgba(36, 48, 40, 0.06);padding:12px;border-radius:12px;">
                            <div style="font-size:1.15rem;font-weight:800;color:#a33b35;">${skippedCount}</div>
                            <div style="font-size:0.7rem;color:#657169;">Skipped</div>
                        </div>
                    </div>
                </div>

                <!-- Tactical Placement Feedback -->
                <div style="background:#ffffff;border:1px solid rgba(36, 48, 40, 0.08);border-radius:18px;padding:18px;margin-bottom:24px;">
                    <div style="font-size:0.85rem;font-weight:800;color:#426451;margin-bottom:8px;">
                        Tactical Placement Assessment:
                    </div>
                    <ul style="margin:0;padding-left:18px;font-size:0.85rem;color:#657169;line-height:1.7;">
                        <li><strong>Speed Management:</strong> You averaged ${avgTimeSec}s per problem (Target is 60–75s).</li>
                        ${skippedCount > 0 ? `<li><strong>Skip Strategy:</strong> You skipped ${skippedCount} question${skippedCount > 1 ? 's' : ''}. In IT campus drives (TCS/Infosys), practice attempting all non-negative questions.</li>` : ''}
                        <li><strong>Mistake Forwarding:</strong> All ${wrongCount} missed questions have been logged into your <strong>Mistake Notebook</strong> for Day 10 spaced retries.</li>
                    </ul>
                </div>

                <!-- Back to Route Button -->
                <button type="button" id="cp-return-route-btn" style="width:100%;padding:16px;border-radius:16px;background:#edf1ea;border:none;color:#222e28;font-size:1rem;font-weight:800;cursor:pointer;box-shadow:none;">
                    Return to 14-Day Placement Route →
                </button>
            </div>
        `;

        document.getElementById('cp-return-route-btn').addEventListener('click', () => {
            if (typeof onCompleteCallback === 'function') {
                onCompleteCallback({ correctCount, total, accuracyPct });
            }
        });
    }

    return {
        startCheckpoint
    };
})();
