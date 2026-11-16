/**
 * coverage-map.js — LaquTum Exam Coverage Map & Transparent ₹1,499 Offer
 * 
 * Core Capabilities:
 * 1. Verified Assessment Coverage Matrix (TCS NQT, Infosys, Cognizant, Wipro, Accenture).
 * 2. Explicit Transparency: Exactly what is covered vs. what is NOT covered.
 * 3. Transparent ₹1,499 Offer Page:
 *    - 6-Month Unlimited Entitlement.
 *    - 14-Day Structured Placement Route.
 *    - Mistake Notebook & Spaced Repetition.
 *    - 2 Proctored Timed Checkpoint Simulators.
 *    - Bounded Support: 3 Written Doubt Reviews (48h SLA) + 2 Monthly Clinics.
 *    - Instant Razorpay Entitlement & Refund Policy.
 */

const CoverageMap = (function () {
    'use strict';

    const COVERAGE_MATRIX = [
        {
            company: 'TCS NQT (Foundation & Advanced)',
            verifiedDate: 'October 2026 Drive',
            status: '95% Covered',
            statusColor: '#10B981',
            topicsCovered: 'Percentages, Time & Work, Speed & Distance, Profit-Loss, Mixtures, Number Systems, Seating Arrangements, Data Interpretation',
            notCovered: 'Coding & Verbal English'
        },
        {
            company: 'Infosys Placement Assessment',
            verifiedDate: 'September 2026 Drive',
            status: '92% Covered',
            statusColor: '#10B981',
            topicsCovered: 'Cryptarithmetic basics, Permutations & Combinations, Probability, Clocks & Calendars, Syllogisms, Data Sufficiency',
            notCovered: 'Pseudocode & Verbal'
        },
        {
            company: 'Cognizant (GenC & GenC Next)',
            verifiedDate: 'October 2026 Drive',
            status: '90% Covered',
            statusColor: '#10B981',
            topicsCovered: 'Quantitative Ability, Analytical Reasoning, Blood Relations, Linear/Circular Seating, Direction Sense',
            notCovered: 'Automata Fix & Business English'
        },
        {
            company: 'Accenture Cognitive Assessment',
            verifiedDate: 'August 2026 Drive',
            status: '94% Covered',
            statusColor: '#10B981',
            topicsCovered: 'Critical Reasoning, Abstract Reasoning, Ratio Proportions, Speed Arithmetic, Visual Venn Diagrams',
            notCovered: 'MS Office MCQs & Coding'
        },
        {
            company: 'Wipro Elite NLTH',
            verifiedDate: 'September 2026 Drive',
            status: '90% Covered',
            statusColor: '#10B981',
            topicsCovered: 'Arithmetic Aptitude, Logical Reasoning, HCF-LCM, Averages, Ages, Compound Interest',
            notCovered: 'Essay Writing & Coding'
        }
    ];

    /**
     * Render the Coverage Map & Trust Offer Screen
     */
    function renderCoverageScreen(container, onBack) {
        if (!container) return;

        const tableRows = COVERAGE_MATRIX.map(row => `
            <div style="background:#ffffff;border:1px solid rgba(36, 48, 40, 0.08);border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:none;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                    <div>
                        <div style="font-size:1.05rem;font-weight:800;color:#222e28;">${row.company}</div>
                        <div style="font-size:0.75rem;color:#657169;">Coverage review: ${row.verifiedDate}</div>
                    </div>
                    <span style="font-size:0.8rem;padding:4px 10px;border-radius:8px;background:rgba(16,185,129,0.15);color:${row.statusColor};font-weight:800;">
                        ${row.status}
                    </span>
                </div>
                <div style="font-size:0.82rem;color:#222e28;margin-bottom:8px;line-height:1.5;">
                    <strong style="color:#426451;">Covered in LaquTum:</strong> ${row.topicsCovered}
                </div>
                <div style="font-size:0.78rem;color:#a33b35;background:rgba(239,68,68,0.06);padding:6px 12px;border-radius:8px;">
                    <strong>Not Covered (Study separately):</strong> ${row.notCovered}
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="coverage-screen-wrap" style="max-width:680px;margin:0 auto;padding:16px 12px 80px;animation:fadeIn 0.3s ease;">
                <!-- Header -->
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
                    <button type="button" id="coverage-back-btn" style="width:36px;height:36px;border-radius:50%;background:rgba(36, 48, 40, 0.06);border:1px solid rgba(36, 48, 40, 0.1);color:#222e28;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">
                        ←
                    </button>
                    <div>
                        <h2 style="font-size:1.35rem;font-weight:800;color:#222e28;margin:0;">Exam coverage</h2>
                        <p style="font-size:0.78rem;color:#657169;margin:2px 0 0;">Plan your preparation around the topics covered here.</p>
                    </div>
                </div>

                <!-- Scope Transparency Banner -->
                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:18px;padding:18px;margin-bottom:22px;">
                    <div style="font-size:0.9rem;font-weight:800;color:#385f75;margin-bottom:6px;">
                        A clear view of the syllabus
                    </div>
                    <p style="font-size:0.85rem;color:#222e28;line-height:1.6;margin:0 0 10px 0;">
                        Build your foundation in <strong>quantitative aptitude, arithmetic, and logical reasoning</strong>. Use the guide below to see where you may need additional preparation.
                    </p>
                    <div style="font-size:0.78rem;color:#657169;">
                        Coverage is a guide. Confirm the current syllabus with your target employer.
                    </div>
                </div>

                <!-- Verified Company Matrix -->
                <div style="font-size:0.85rem;font-weight:700;color:#657169;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
                    Verified Target Assessments
                </div>
                ${tableRows}

                <!-- ₹1,499 Value Proposition Box -->
                <div style="background:#edf1ea;border:2px solid #426451;border-radius:22px;padding:26px;margin-top:28px;text-align:center;box-shadow:none;">
                    <span style="font-size:0.75rem;padding:3px 12px;border-radius:999px;background:#eaf0e9;color:#222e28;font-weight:800;text-transform:uppercase;">
                        LaquTum Complete Placement Pass
                    </span>
                    <div style="font-size:2.4rem;font-weight:900;color:#222e28;margin:12px 0 4px;">
                        ₹1,499 <span style="font-size:0.95rem;color:#657169;font-weight:500;">/ 6 Months Access</span>
                    </div>
                    <p style="font-size:0.82rem;color:#657169;margin:0 0 20px;">
                        One single payment. Full access to everything built to get you placed.
                    </p>

                    <!-- Inclusions List -->
                    <div style="text-align:left;background:#f2f4ef;border-radius:16px;padding:16px;margin-bottom:22px;display:flex;flex-direction:column;gap:10px;font-size:0.85rem;color:#222e28;">
                        <div><strong>14-Day Structured Placement Route</strong> (25–35 min/day)</div>
                        <div><strong>Unlabelled Independent Practice</strong> with 3-Step Hint Ladders</div>
                        <div><strong>Error Diagnostic Engine</strong> (Identifies traps & misread conditions)</div>
                        <div><strong>Mistake Notebook</strong> with Spaced Repetition (Days 1, 3, 7)</div>
                        <div><strong>2 Timed Checkpoint Sessions</strong> with tactical feedback</div>
                        <div><strong>"When the Move Fails"</strong> boundary failure twin cards</div>
                        <div><strong>Bounded Support:</strong> 3 Written Mentor Doubt Reviews (48h SLA) + 2 Monthly Clinics</div>
                        <div><strong>Instant Full Unlock</strong> across Web & Mobile</div>
                    </div>

                    <button type="button" id="coverage-checkout-btn" style="width:100%;padding:16px;border-radius:16px;background:#edf1ea;border:none;color:#222e28;font-size:1.05rem;font-weight:800;cursor:pointer;box-shadow:none;transition:all 0.2s;">
                        Get Complete Access — ₹1,499 →
                    </button>

                    <div style="font-size:0.75rem;color:#657169;margin-top:14px;line-height:1.5;">
                        <strong>7-Day Learning Guarantee:</strong> Complete the first 3 days of the route. If you don't feel a measurable leap in solving unfamiliar questions independently, get a 100% refund upon email request.
                    </div>
                </div>
            </div>
        `;

        if (onBack) {
            document.getElementById('coverage-back-btn').addEventListener('click', onBack);
        }

        // Wire Checkout
        document.getElementById('coverage-checkout-btn').addEventListener('click', () => {
            launchRazorpayCheckout();
        });
    }

    /**
     * Launch Razorpay Checkout for ₹1,499
     */
    async function launchRazorpayCheckout() {
        // Share the same verified checkout and recovery flow as topic access.
        PreviewApp.showPaywall();
    }

    return {
        renderCoverageScreen,
        COVERAGE_MATRIX,
        launchRazorpayCheckout
    };
})();
