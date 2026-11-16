/**
 * practice-engine.js — LaquTum Independent Application & Error Diagnostic Engine
 * 
 * Core Capabilities:
 * 1. Independent Application Mode: Fresh questions served unlabelled (no pattern/formula spoilers).
 * 2. Need a hint?: Nudge -> Knot Condition -> First Move (logs hint level used).
 * 3. Stopwatch Latency Tracking: Precise response time measurement.
 * 4. Error-Diagnosing Classifier: Identifies misread_condition, wrong_relationship, arithmetic_slip, speed_rush.
 * 5. Outcome Badging: "Solid (Hint-Free & Timed)", "Correct-but-Slow", "Correct-after-Hint", "Trap Triggered".
 * 6. "When The Move Doesn't Apply" Boundary Cards & Twin Check questions.
 */

const PracticeEngine = (function () {
    'use strict';

    let currentSession = null;
    let timerInterval = null;
    let startTime = 0;
    let elapsedSeconds = 0;
    let currentHintLevel = 0; // 0: None, 1: Nudge, 2: Knot Condition, 3: First Move
    let selectedOptionIndex = null;

    // Benchmark times per difficulty level (seconds)
    const BENCHMARK_TIMES = {
        1: 45,
        2: 60,
        3: 75,
        4: 90,
        5: 120
    };

    // Boundary rules for "When the move DOES NOT apply"
    const BOUNDARY_RULES = {
        'P1': {
            rule: "Do NOT use simple addition when the components have overlapping sets.",
            example: "If 20 students play Cricket and 15 play Football, total players is NOT 35 if some play both! Check for intersections first."
        },
        'P2': {
            rule: "Do NOT apply constant ratio scaling when an absolute quantity is added or removed from only one part.",
            example: "If water is added to milk, only water changes. The quantity of pure milk remains locked. Never change both parts equally."
        },
        'P3': {
            rule: "Do NOT use arithmetic mean (Speed1 + Speed2) / 2 when distances are equal.",
            example: "For equal distances, average speed is the Harmonic Mean: 2ab / (a+b). Arithmetic mean applies ONLY when times are equal."
        },
        'P4': {
            rule: "Do NOT apply successive percentage formula a + b + (ab/100) when percentages are on different reference bases.",
            example: "If price increases by 20% of Cost Price and tax is 10% of Selling Price, the bases differ. You cannot simply combine them as 32%."
        },
        'P5': {
            rule: "Do NOT use difference elimination when common factors cancel out completely.",
            example: "Always check if the equations are linearly independent before subtracting. Dependent equations produce 0 = 0."
        },
        'P6': {
            rule: "Do NOT assume linear constant shift when terms follow compounding or exponential growth.",
            example: "Population doubling every 5 years is a geometric progression, not an arithmetic progression with a constant difference."
        },
        'P7': {
            rule: "Do NOT anchor to 100 if the problem explicitly anchors to a variable or fixed non-100 base.",
            example: "Anchor-to-100 is for percentage scale-invariance. If real rupees or weights are specified in the question, verify dimensional match."
        },
        'P8': {
            rule: "Do NOT use standard complementary counting 1 - P(none) when conditions are not mutually exclusive.",
            example: "Ensure the complementary event completely covers all other sample spaces before subtracting from 1."
        },
        'P9': {
            rule: "Do NOT use flat Euclidean distance formulas when movement is restricted to a grid (Manhattan distance).",
            example: "If walking strictly North/South and East/West along city blocks, distance is |dx| + |dy|, NOT sqrt(dx^2 + dy^2)."
        },
        'P10': {
            rule: "Do NOT eliminate constraints prematurely before testing negative or zero boundary values.",
            example: "In linear or circular arrangements, check whether direction facing (inwards vs outwards) reverses left and right orientations."
        },
        'P11': {
            rule: "Do NOT assume a 4-cycle for all powers without checking the base unit digit.",
            example: "Base digits 0, 1, 5, 6 have a cyclicity of 1 (remain constant). Base 4 and 9 have a cyclicity of 2. Only 2, 3, 7, 8 have cyclicity 4."
        },
        'P12': {
            rule: "Do NOT use alligation cross-rule when more than two components are mixed without a fixed ratio.",
            example: "Weighted mixing requires known relative weights or target concentrations. It fails when chemical reactions alter solvent volumes."
        }
    };

    /**
     * Generate dynamic 3-step hint ladder for a question
     */
    function generateHintLadder(entry) {
        const knot = entry.knot_name || entry.knot || 'the underlying constraint';
        const trick = entry.trick || 'Analyze the relationship between the quantities before calculating.';
        const why = entry.why || 'Notice the invariant property in this question.';

        // Step 1: Nudge (Points attention without revealing math)
        let nudge = "Notice what is fixed vs what changes in the story. Focus on the final target asked.";
        if (entry.pattern === 'P3') nudge = "Identify whether the distance or the time is constant in this journey.";
        else if (entry.pattern === 'P4') nudge = "Check whether the percentage change applies to the original base or a new modified value.";
        else if (entry.pattern === 'P2') nudge = "Look for the quantity that is NEVER added or subtracted — that is your anchor.";
        else if (entry.pattern === 'P8') nudge = "Is it much easier to count the cases that do NOT satisfy the rule, and subtract from total?";
        else if (entry.pattern === 'P10') nudge = "Start with the most restrictive clue that leaves the fewest possibilities.";

        // Step 2: Knot Condition (The core invariant)
        let knotCondition = `The key idea is: "${knot}". ${trick.split('.')[0]}.`;

        // Step 3: The First Move (The opening equation / operation)
        let firstMove = trick.length > 20 ? trick : (why.split('.')[0] + '. Start with this equation.');

        return {
            level1_nudge: nudge,
            level2_knot: knotCondition,
            level3_first_move: firstMove
        };
    }

    /**
     * Classify wrong option into specific pedagogical error type
     */
    function classifyError(entry, selectedIdx, responseTimeSec) {
        if (responseTimeSec < 8) {
            return {
                type: 'speed_rush',
                label: 'Check your reading pace',
                diagnosis: "You answered quickly. Reading the question once more may help you spot the important detail.",
                fix: "Re-read the question and confirm what is being asked. Take the time you need."
            };
        }

        const whyOthers = entry.why_others_wrong || '';
        const trapExpl = entry.trap_explanation || '';
        const selectedText = (entry.options && entry.options[selectedIdx]) ? String(entry.options[selectedIdx]) : '';

        // Check if why_others_wrong mentions this option
        if (selectedText && whyOthers && whyOthers.toLowerCase().includes(selectedText.toLowerCase())) {
            // Find sentence mentioning this option
            const sentences = whyOthers.split('.');
            const matching = sentences.find(s => s.toLowerCase().includes(selectedText.toLowerCase()));
            if (matching) {
                if (matching.toLowerCase().includes('misread') || matching.toLowerCase().includes('condition')) {
                    return {
                        type: 'misread_condition',
                        label: 'Check the question conditions',
                        diagnosis: "A possible explanation for this option: " + matching.trim(),
                        fix: "Underline or re-read the final question sentence. Check if it asked for A, B, total, or percentage."
                    };
                }
                if (matching.toLowerCase().includes('slip') || matching.toLowerCase().includes('calculat')) {
                    return {
                        type: 'arithmetic_slip',
                        label: 'Check the calculation',
                        diagnosis: "A possible explanation for this option: " + matching.trim(),
                        fix: "Compare your calculation with the worked solution, keeping related steps grouped."
                    };
                }
                return {
                    type: 'wrong_relationship',
                    label: 'Check the relationship',
                    diagnosis: "A possible explanation for this option: " + matching.trim(),
                    fix: "Check whether the variables are directly or inversely proportional."
                };
            }
        }

        if (trapExpl) {
            return {
                type: 'misread_condition',
                label: 'A detail worth checking',
                diagnosis: "This question includes a potential pitfall: " + trapExpl,
                fix: "Compare the question conditions with the method in the worked solution."
            };
        }

        // An answer alone cannot establish why the learner chose it.
        return {
            type: 'wrong_relationship',
            label: 'Review the worked solution',
            diagnosis: "This answer does not match the solution. Compare the worked steps with your approach to find where they differ.",
            fix: "Check the relationship between the quantities, then work through the calculation again."
        };
    }

    /**
     * Render an Independent Application Question
     */
    function renderIndependentQuestion(container, entry, onCompleteCallback) {
        if (!container || !entry) return;

        // Reset state
        currentSession = {
            entry: entry,
            onComplete: onCompleteCallback
        };
        currentHintLevel = 0;
        selectedOptionIndex = null;
        elapsedSeconds = 0;
        startTime = Date.now();

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const timerEl = document.getElementById('practice-timer-display');
            if (timerEl) {
                const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
                const secs = String(elapsedSeconds % 60).padStart(2, '0');
                timerEl.textContent = `${mins}:${secs}`;
                
                // Practice has no time limit; timing remains available for learning feedback.
            }
        }, 1000);

        const hints = generateHintLadder(entry);
        const benchmark = BENCHMARK_TIMES[entry.difficulty || 2] || 60;
        const topicLabel = (entry.topic_costume || 'Placement Pattern').replace(/-/g, ' ');

        container.innerHTML = `
            <div class="practice-container" style="max-width:680px;margin:0 auto;padding:16px 12px 140px;animation:fadeIn 0.3s ease;">
                <!-- Top Practice Header -->
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;background:rgba(36, 48, 40, 0.03);padding:10px 16px;border-radius:14px;border:1px solid rgba(36, 48, 40, 0.06);">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <span style="font-size:0.75rem;padding:3px 10px;border-radius:999px;background:rgba(66, 100, 81, 0.15);color:#426451;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">
                            Try it yourself
                        </span>
                        <span style="font-size:0.75rem;color:#657169;font-weight:600;">
                            ${topicLabel}
                        </span>
                    </div>
                    <div id="practice-timer-display" aria-label="Time spent on this question" style="font-size:0.95rem;font-weight:800;color:#34714e;font-family:monospace;letter-spacing:1px;">
                        00:00
                    </div>
                </div>

                <!-- Unlabelled Question Card -->
                <div class="practice-card" style="background:#ffffff;border:1px solid rgba(36, 48, 40, 0.08);border-radius:20px;padding:24px;box-shadow:none;margin-bottom:20px;">
                    <div style="font-size:0.75rem;font-weight:700;color:#657169;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                        Choose one answer · Take your time
                    </div>
                    <div style="font-size:1.15rem;font-weight:700;color:#222e28;line-height:1.7;margin-bottom:24px;">
                        ${entry.question}
                    </div>

                    <!-- Interactive Options -->
                    <div class="practice-options" id="practice-options-list" style="display:flex;flex-direction:column;gap:12px;">
                        ${entry.options.map((opt, i) => `
                            <button type="button" class="practice-option-btn" aria-pressed="false" data-opt-index="${i}" style="display:flex;align-items:center;gap:14px;padding:16px;background:rgba(36, 48, 40, 0.04);border:1.5px solid rgba(36, 48, 40, 0.08);border-radius:14px;color:#222e28;font-size:1rem;font-weight:600;text-align:left;cursor:pointer;transition:all 0.2s ease;font-family:inherit;width:100%;">
                                <span style="width:32px;height:32px;border-radius:50%;background:rgba(36, 48, 40, 0.06);display:flex;align-items:center;justify-content:center;font-weight:800;color:#426451;font-size:0.85rem;flex-shrink:0;">
                                    ${String.fromCharCode(65 + i)}
                                </span>
                                <span style="flex:1;">${opt}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Need a hint? Section -->
                <div class="hint-ladder-box" style="background:rgba(245,158,11,0.05);border:1px dashed rgba(245,158,11,0.3);border-radius:16px;padding:16px;margin-bottom:20px;">
                    <div style="display:flex;align-items:center;justify-content:space-between;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            
                            <span style="font-size:0.88rem;font-weight:700;color:#866128;">Need a hint?</span>
                            <span id="hint-status-badge" style="font-size:0.7rem;padding:2px 8px;border-radius:8px;background:rgba(36, 48, 40, 0.08);color:#657169;">
                                0 of 3 used
                            </span>
                        </div>
                        <button type="button" id="practice-get-hint-btn" style="padding:8px 14px;border-radius:10px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#866128;font-weight:700;font-size:0.8rem;cursor:pointer;transition:all 0.2s;">
                            Show hint 1
                        </button>
                    </div>

                    <!-- Revealed Hints Container -->
                    <div id="practice-revealed-hints" style="margin-top:12px;display:flex;flex-direction:column;gap:8px;"></div>
                </div>

                <!-- Submit Button -->
                <button type="button" id="practice-submit-btn" disabled style="width:100%;padding:16px;border-radius:16px;background:rgba(66, 100, 81, 0.16);border:none;color:#657169;font-size:1.05rem;font-weight:800;cursor:not-allowed;transition:all 0.25s;font-family:inherit;">
                    Choose an answer above
                </button>

                <!-- Feedback Outcome Drawer (Hidden initially) -->
                <div id="practice-outcome-drawer" style="display:none;margin-top:24px;"></div>
            </div>
        `;

        const mainScroll = document.querySelector('.preview-main');
        if (mainScroll) mainScroll.scrollTop = 0;

        // Wire option selection
        const optionBtns = container.querySelectorAll('.practice-option-btn');
        const submitBtn = document.getElementById('practice-submit-btn');

        optionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (selectedOptionIndex !== null && document.getElementById('practice-outcome-drawer').style.display === 'block') {
                    return; // Already submitted
                }
                optionBtns.forEach(b => {
                    b.setAttribute('aria-pressed', 'false');
                    b.style.borderColor = 'rgba(36, 48, 40, 0.08)';
                    b.style.background = 'rgba(36, 48, 40, 0.04)';
                });
                btn.setAttribute('aria-pressed', 'true');
                btn.style.borderColor = '#426451';
                btn.style.background = 'rgba(66, 100, 81, 0.15)';
                selectedOptionIndex = parseInt(btn.dataset.optIndex, 10);

                submitBtn.disabled = false;
                submitBtn.style.background = '#edf1ea';
                submitBtn.style.color = '#222e28';
                submitBtn.style.cursor = 'pointer';
                submitBtn.style.boxShadow = 'none';
                submitBtn.textContent = 'Check my answer';
            });
        });

        // Wire Hint Ladder
        const hintBtn = document.getElementById('practice-get-hint-btn');
        const hintContainer = document.getElementById('practice-revealed-hints');
        const hintBadge = document.getElementById('hint-status-badge');

        hintBtn.addEventListener('click', () => {
            if (currentHintLevel >= 3) return;
            currentHintLevel++;
            hintBadge.textContent = `${currentHintLevel} / 3 Hints Used`;

            let hintHTML = '';
            if (currentHintLevel === 1) {
                hintHTML = `
                    <div style="padding:10px 14px;background:rgba(245,158,11,0.1);border-left:3px solid #866128;border-radius:6px;font-size:0.85rem;color:#866128;">
                        <strong>Hint 1:</strong> ${hints.level1_nudge}
                    </div>
                `;
                hintBtn.textContent = 'Show hint 2';
            } else if (currentHintLevel === 2) {
                hintHTML = `
                    <div style="padding:10px 14px;background:rgba(59,130,246,0.1);border-left:3px solid #385f75;border-radius:6px;font-size:0.85rem;color:#385f75;">
                        <strong>Hint 2:</strong> ${hints.level2_knot}
                    </div>
                `;
                hintBtn.textContent = 'Show the first step';
            } else if (currentHintLevel === 3) {
                hintHTML = `
                    <div style="padding:10px 14px;background:rgba(66, 100, 81, 0.1);border-left:3px solid #426451;border-radius:6px;font-size:0.85rem;color:#426451;">
                        <strong>First step:</strong> ${hints.level3_first_move}
                    </div>
                `;
                hintBtn.disabled = true;
                hintBtn.textContent = 'All Hints Revealed';
                hintBtn.style.opacity = '0.5';
            }
            hintContainer.insertAdjacentHTML('beforeend', hintHTML);
        });

        // Wire Submit button
        submitBtn.addEventListener('click', () => {
            if (selectedOptionIndex === null) return;
            handleSubmit(container, entry);
        });
    }

    /**
     * Handle submission and render detailed diagnostic feedback
     */
    function handleSubmit(container, entry) {
        if (timerInterval) clearInterval(timerInterval);
        const finalTimeSec = elapsedSeconds;
        const isCorrect = (selectedOptionIndex === entry.correct_index);
        const benchmark = BENCHMARK_TIMES[entry.difficulty || 2] || 60;

        // Freeze options
        const optionBtns = container.querySelectorAll('.practice-option-btn');
        optionBtns.forEach((btn, i) => {
            btn.disabled = true;
            btn.style.pointerEvents = 'none';
            btn.dataset.result = i === entry.correct_index ? 'correct' : i === selectedOptionIndex ? 'incorrect' : 'unselected';
            if (i === entry.correct_index) {
                const label = document.createElement('small');
                label.className = 'answer-result-label'; label.textContent = 'Correct answer'; btn.appendChild(label);
                btn.style.borderColor = '#34714e';
                btn.style.background = 'rgba(16,185,129,0.15)';
                btn.querySelector('span:first-child').style.background = '#e8f2e9';
                btn.querySelector('span:first-child').style.color = '#222e28';
            } else if (i === selectedOptionIndex && !isCorrect) {
                const label = document.createElement('small');
                label.className = 'answer-result-label'; label.textContent = 'Your answer'; btn.appendChild(label);
                btn.style.borderColor = '#a33b35';
                btn.style.background = 'rgba(239,68,68,0.15)';
                btn.querySelector('span:first-child').style.background = '#faeeeb';
                btn.querySelector('span:first-child').style.color = '#222e28';
            }
        });
        const hintButton = document.getElementById('practice-get-hint-btn');
        if (hintButton) hintButton.disabled = true;

        // Hide submit button
        document.getElementById('practice-submit-btn').style.display = 'none';

        // Evaluate Diagnostic Badge
        let badgeText = '';
        let badgeColor = '';
        let badgeBg = '';

        if (isCorrect) {
            if (currentHintLevel === 0 && finalTimeSec <= benchmark) {
                badgeText = 'Correct — you solved it yourself';
                badgeColor = '#34714e';
                badgeBg = 'rgba(16,185,129,0.15)';
            } else if (currentHintLevel === 0 && finalTimeSec > benchmark) {
                badgeText = 'Correct — keep practising at your own pace';
                badgeColor = '#866128';
                badgeBg = 'rgba(245,158,11,0.15)';
            } else {
                badgeText = `Correct — with ${currentHintLevel} hint${currentHintLevel > 1 ? 's' : ''}`;
                badgeColor = '#385f75';
                badgeBg = 'rgba(59,130,246,0.15)';
            }
        } else {
            badgeText = 'Not correct yet — let’s learn from it';
            badgeColor = '#a33b35';
            badgeBg = 'rgba(239,68,68,0.15)';
        }

        // Error diagnosis if incorrect
        let errorData = null;
        if (!isCorrect) {
            errorData = classifyError(entry, selectedOptionIndex, finalTimeSec);
            // Automatically log to Mistake Notebook
            if (typeof MistakeNotebook !== 'undefined') {
                MistakeNotebook.addMistake({
                    questionId: entry.id,
                    question: entry.question,
                    options: entry.options,
                    correctIndex: entry.correct_index,
                    userSelectedIndex: selectedOptionIndex,
                    pattern: entry.pattern,
                    topic: entry.topic_costume,
                    knot: entry.knot_name || entry.knot || 'Core Knot',
                    errorType: errorData.type,
                    errorLabel: errorData.label,
                    errorDiagnosis: errorData.diagnosis,
                    errorFix: errorData.fix,
                    timeTakenSec: finalTimeSec,
                    hintsUsed: currentHintLevel
                });
            }
        }

        // Update confidence tracker if available
        if (typeof ConfidenceTracker !== 'undefined' && entry.pattern) {
            try {
                if (typeof ConfidenceTracker.init === 'function') ConfidenceTracker.init();
                ConfidenceTracker.update(entry.pattern, {
                    correct: isCorrect,
                    responseTimeMs: finalTimeSec * 1000,
                    comprehension: isCorrect ? (currentHintLevel === 0 ? 'understood' : 'slightly_understood') : 'nothing_understood'
                });
            } catch (err) {
                console.warn('[PracticeEngine] ConfidenceTracker update error:', err);
            }
        }

        // Boundary Rule Card
        const boundary = BOUNDARY_RULES[entry.pattern] || null;

        // Render Outcome Drawer
        const drawer = document.getElementById('practice-outcome-drawer');
        drawer.style.display = 'block';

        drawer.innerHTML = `
            <div style="background:#ffffff;border:2px solid ${badgeColor};border-radius:20px;padding:24px;box-shadow:none;animation:slideUp 0.35s ease;">
                <!-- Status Badge -->
                <h2 id="practice-result-heading" tabindex="-1" style="display:inline-block;padding:6px 14px;border-radius:999px;background:${badgeBg};color:${badgeColor};font-size:1rem;font-weight:700;margin:0 0 16px;">
                    ${badgeText}
                </h2>

                <!-- Timing & Hint Stat Row -->
                <div style="display:flex;gap:14px;margin-bottom:20px;font-size:0.8rem;color:#657169;border-bottom:1px solid rgba(36, 48, 40, 0.06);padding-bottom:14px;">
                    <div><strong>Your time:</strong> ${finalTimeSec}s</div>
                    <div><strong>Hints:</strong> ${currentHintLevel}/3</div>
                    <div><strong>Result:</strong> ${isCorrect ? 'Solved' : '❌ Missed'}</div>
                </div>

                ${!isCorrect && errorData ? `
                    <!-- Error Diagnostic Box -->
                    <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:14px;padding:16px;margin-bottom:20px;">
                        <div style="font-size:0.88rem;font-weight:800;color:#a33b35;margin-bottom:6px;">
                            ${errorData.label}
                        </div>
                        <div style="font-size:0.92rem;color:#222e28;line-height:1.6;margin-bottom:10px;">
                            ${errorData.diagnosis}
                        </div>
                        <div style="font-size:0.82rem;color:#866128;background:rgba(245,158,11,0.1);padding:8px 12px;border-radius:8px;">
                            <strong>Try this next:</strong> ${errorData.fix}
                        </div>
                        <div style="font-size:0.75rem;color:#657169;margin-top:8px;">
                            Saved to your <strong>Mistake Notebook</strong>. Scheduled for retry in 1 day.
                        </div>
                    </div>
                ` : ''}

                <!-- Master Explanation & Trick -->
                <div style="background:rgba(36, 48, 40, 0.03);border-radius:14px;padding:16px;margin-bottom:20px;">
                    <div style="font-size:0.85rem;font-weight:800;color:#426451;margin-bottom:8px;">
                        How to start:
                    </div>
                    <div style="font-size:0.95rem;color:#222e28;line-height:1.7;margin-bottom:12px;">
                        ${entry.trick || entry.why}
                    </div>
                    ${entry.why ? `
                        <div style="font-size:0.85rem;color:#657169;line-height:1.6;">
                            <strong>Why it works:</strong> ${entry.why}
                        </div>
                    ` : ''}
                </div>

                ${boundary ? `
                    <!-- Boundary Check: When The Move DOES NOT Apply -->
                    <details style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:14px;padding:16px;margin-bottom:20px;">
                        <summary style="cursor:pointer;font-size:0.9rem;color:#866128;">More about this method</summary>
                        <div style="font-size:0.85rem;font-weight:800;color:#866128;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                            When this method does not work
                        </div>
                        <div style="font-size:0.88rem;color:#222e28;line-height:1.6;margin-bottom:8px;">
                            ${boundary.rule}
                        </div>
                        <div style="font-size:0.8rem;color:#657169;">
                            <em>Example:</em> ${boundary.example}
                        </div>
                    </details>
                ` : ''}

                <!-- Next Button -->
                <button type="button" id="practice-next-btn" style="width:100%;padding:15px;border-radius:14px;background:#edf1ea;border:none;color:#222e28;font-size:1rem;font-weight:800;cursor:pointer;transition:all 0.2s;">
                    Continue learning
                </button>
            </div>
        `;

        setTimeout(() => {
            const heading = drawer.querySelector('#practice-result-heading');
            heading?.focus({ preventScroll: true });
            const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            drawer.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }, 50);

        const nextBtn = document.getElementById('practice-next-btn');
        if (nextBtn) {
            nextBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Immediate visual feedback to prevent duplicate taps
                nextBtn.disabled = true;
                nextBtn.textContent = 'Continuing…';
                nextBtn.style.opacity = '0.75';
                nextBtn.style.cursor = 'default';

                if (timerInterval) {
                    clearInterval(timerInterval);
                    timerInterval = null;
                }

                try {
                    if (currentSession && typeof currentSession.onComplete === 'function') {
                        currentSession.onComplete({
                            isCorrect,
                            timeTakenSec: finalTimeSec,
                            hintsUsed: currentHintLevel,
                            badgeText
                        });
                    } else if (typeof PreviewApp !== 'undefined') {
                        if (typeof PreviewApp.advanceFlow === 'function') {
                            PreviewApp.advanceFlow();
                        } else if (typeof PreviewApp.renderPostResultsChoice === 'function') {
                            PreviewApp.renderPostResultsChoice();
                        }
                    }
                } catch (err) {
                    console.error('[PracticeEngine] Next button onComplete error:', err);
                    if (typeof PreviewApp !== 'undefined' && typeof PreviewApp.renderPostResultsChoice === 'function') {
                        PreviewApp.renderPostResultsChoice();
                    }
                }
            };
        }
    }

    return {
        renderIndependentQuestion,
        generateHintLadder,
        classifyError,
        BOUNDARY_RULES
    };
})();
