/**
 * route-manager.js — LaquTum 14-Day Placement Route & Daily Study Guide Engine
 * 
 * Core Capabilities:
 * 1. 14-Day Structured Route: 25-35 minutes/day prioritized placement curriculum.
 * 2. Day-by-day Task Engine: Lesson -> 3 Unlabelled Transfer Questions -> Mistake Review.
 * 3. Sprint Mode: 3-Day high-yield condensed route for immediate drives (<= 72 hrs).
 * 4. Resumable State: Tracks current day, completed tasks, and streak.
 * 5. Direct Action Links: Seamlessly launches lessons, practice engine, checkpoints, or notebook.
 */

const RouteManager = (function () {
    'use strict';

    const STORAGE_KEY = 'laqtum_route_state';

    const DEFAULT_14_DAY_PLAN = [
        {
            day: 1,
            title: "Starting Diagnostic & Weak Pattern Read",
            timeMinutes: 25,
            badge: "Orientation",
            desc: "12 mixed questions to identify which problem knots stop you and map your 14-day route.",
            type: "diagnostic"
        },
        {
            day: 2,
            title: "Rate × Time = Quantity (Speed & Work)",
            pattern: "P3",
            topic: "time-work",
            timeMinutes: 30,
            badge: "High Frequency",
            desc: "Master inverse work-rate relations, pipe inlets/leaks, and relative speed without algebra.",
            type: "pattern_day"
        },
        {
            day: 3,
            title: "Percent-as-Fraction & Multipliers",
            pattern: "P4",
            topic: "percentages",
            timeMinutes: 30,
            badge: "High Frequency",
            desc: "Replace 3-step profit/loss equations with single-multiplier fractions and successive change.",
            type: "pattern_day"
        },
        {
            day: 4,
            title: "Ratio-Lock & Invariant Quantities",
            pattern: "P2",
            topic: "ratio",
            timeMinutes: 30,
            badge: "Core Knot",
            desc: "Identify the quantity that NEVER changes when mixing substances or comparing ages.",
            type: "pattern_day"
        },
        {
            day: 5,
            title: "Difference-Elimination & Modular HCF",
            pattern: "P5",
            topic: "hcf-lcm",
            timeMinutes: 25,
            badge: "Speed Shortcut",
            desc: "Solve system equations and traffic-light periodicity in 15 seconds using differences.",
            type: "pattern_day"
        },
        {
            day: 6,
            title: "Constant-Shift & Averages Balance",
            pattern: "P6",
            topic: "averages",
            timeMinutes: 25,
            badge: "Mental Math",
            desc: "Use fulcrum deviation balancing instead of calculating massive sum totals.",
            type: "pattern_day"
        },
        {
            day: 7,
            title: "Anchor-to-100 & Compounding",
            pattern: "P7",
            topic: "si-ci",
            timeMinutes: 30,
            badge: "High Yield",
            desc: "Scale-invariance shortcuts for Simple & Compound interest differences.",
            type: "pattern_day"
        },
        {
            day: 8,
            title: "Complementary Counting & Permutation",
            pattern: "P8",
            topic: "permutations",
            timeMinutes: 35,
            badge: "Tricky Knots",
            desc: "Crack 'at least one' conditions by counting the complement and subtracting from total.",
            type: "pattern_day"
        },
        {
            day: 9,
            title: "Checkpoint 1: Timed Mixed Simulation",
            timeMinutes: 30,
            badge: "Midpoint Gate",
            desc: "10 mixed, unlabelled questions with scaled time budgets and skip-and-return navigation.",
            type: "checkpoint_1"
        },
        {
            day: 10,
            title: "Spaced Retries & Boundary Checks",
            timeMinutes: 25,
            badge: "Reinforcement",
            desc: "Clear your Mistake Notebook and practice near-twin questions where the shortcut fails.",
            type: "boundary_and_retries"
        },
        {
            day: 11,
            title: "Constraint-Elimination & Seating Knots",
            pattern: "P10",
            topic: "seating-linear",
            timeMinutes: 30,
            badge: "Logical Reasoning",
            desc: "Anchor left/right perspectives and crack circular & linear puzzles with zero ambiguity.",
            type: "pattern_day"
        },
        {
            day: 12,
            title: "Cyclicity & Recurrence (Remainders & Series)",
            pattern: "P11",
            topic: "number-systems",
            timeMinutes: 25,
            badge: "Aptitude Tricks",
            desc: "Crack unit digits of huge powers and recurring clock/calendar modular systems.",
            type: "pattern_day"
        },
        {
            day: 13,
            title: "Reading & First-Move Speed Drills",
            timeMinutes: 20,
            badge: "Exam Strategy",
            desc: "Story-stripping drills: identify the condition, choose first move, or decide to skip in < 15s.",
            type: "first_move_drills"
        },
        {
            day: 14,
            title: "Checkpoint 2 & Verified Progress Report",
            timeMinutes: 35,
            badge: "Final Certification",
            desc: "12 unlabelled questions on an exam clock + downloadable before/after performance report.",
            type: "checkpoint_2"
        }
    ];

    function loadRouteState() {
        try {
            const raw = JSON.stringify(UserStorage.read(STORAGE_KEY, null));
            if (JSON.parse(raw)) return JSON.parse(raw);
        } catch (e) {
            console.warn('[RouteManager] Failed to read route state:', e);
        }
        return {
            currentDay: 1,
            completedDays: [],
            isSprintMode: false,
            startedAt: Date.now()
        };
    }

    function saveRouteState(state) {
        try {
            UserStorage.write(STORAGE_KEY, state);
            syncToCloud(state);
        } catch (e) {
            console.warn('[RouteManager] Failed to save route state:', e);
        }
    }

    async function syncToCloud(state) {
        return UserStorage.sync(STORAGE_KEY, state, 'route_state');
    }

    function completeDay(dayNumber) {
        const state = loadRouteState();
        if (!state.completedDays.includes(dayNumber)) {
            state.completedDays.push(dayNumber);
            if (state.currentDay === dayNumber && dayNumber < 14) {
                state.currentDay = dayNumber + 1;
            }
            saveRouteState(state);
        }
    }

    /**
     * Render the 14-Day Placement Route Dashboard
     */
    function renderRouteView(container, onActionLaunch) {
        if (!container) return;
        const state = loadRouteState();
        const plan = DEFAULT_14_DAY_PLAN;
        const currentTask = plan.find(p => p.day === state.currentDay) || plan[0];
        const completedCount = state.completedDays.length;
        const progressPct = Math.round((completedCount / plan.length) * 100);

        const daysCardsHTML = plan.map(item => {
            const isCompleted = state.completedDays.includes(item.day);
            const isCurrent = state.currentDay === item.day;
            const isLocked = item.day > state.currentDay && !isCompleted;

            let statusBorder = '#e5eade';
            let statusBg = '#ffffff';
            let statusText = 'Locked';
            let statusColor = '#64715b';

            if (isCompleted) {
                statusBorder = 'rgba(16,185,129,0.3)';
                statusBg = 'rgba(16,185,129,0.06)';
                statusText = 'Completed';
                statusColor = '#34714e';
            } else if (isCurrent) {
                statusBorder = '#59764b';
                statusBg = '#f1f5eb';
                statusText = 'Today\'s Focus';
                statusColor = '#365740';
            }

            return `
                <div class="route-day-card" data-day="${item.day}" style="background:${statusBg};border:1.5px solid ${statusBorder};border-radius:18px;padding:18px;margin-bottom:14px;transition:all 0.25s ease;cursor:${isLocked ? 'default' : 'pointer'};opacity:${isLocked ? '0.65' : '1'};">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <span style="width:30px;height:30px;border-radius:50%;background:${isCompleted ? '#e8f2e9' : isCurrent ? '#eaf0e9' : 'rgba(36, 48, 40, 0.1)'};color:#222e28;display:flex;align-items:center;justify-content:center;font-size:0.82rem;font-weight:800;flex-shrink:0;">
                                ${isCompleted ? '✓' : item.day}
                            </span>
                            <div>
                                <span style="font-size:0.75rem;padding:2px 8px;border-radius:6px;background:rgba(36, 48, 40, 0.08);color:${statusColor};font-weight:700;">
                                    ${item.badge}
                                </span>
                                <span style="font-size:0.75rem;color:#657169;margin-left:6px;">~${item.timeMinutes} mins</span>
                            </div>
                        </div>
                        <span style="font-size:0.75rem;font-weight:800;color:${statusColor};">
                            ${statusText}
                        </span>
                    </div>

                    <h4 style="font-size:1rem;font-weight:800;color:#222e28;margin:0 0 6px 0;">
                        Day ${item.day}: ${item.title}
                    </h4>
                    <p style="font-size:0.82rem;color:#657169;line-height:1.5;margin:0 0 14px 0;">
                        ${item.desc}
                    </p>

                    ${!isLocked ? `
                        <button type="button" class="route-action-btn" data-day="${item.day}" style="width:100%;padding:10px;border-radius:12px;background:#edf1ea;border:${isCurrent ? 'none' : '1px solid rgba(36, 48, 40, 0.1)'};color:#222e28;font-size:0.85rem;font-weight:700;cursor:pointer;transition:all 0.2s;">
                            ${isCurrent ? 'Start Today\'s Route' : isCompleted ? '🔄 Review Day' : 'Start Day'}
                        </button>
                    ` : ''}
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="route-screen-wrap" style="max-width:680px;margin:0 auto;padding:16px 12px 80px;animation:fadeIn 0.3s ease;">
                <!-- Header Banner -->
                <div style="background:#edf1ea;border:1px solid rgba(66, 100, 81, 0.16);border-radius:20px;padding:22px;margin-bottom:24px;text-align:center;">
                    <div style="font-size:0.75rem;font-weight:800;color:#426451;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">
                        YOUR STUDY PLAN
                    </div>
                    <h2 style="font-size:1.5rem;font-weight:900;color:#222e28;margin:0 0 8px;">
                        14-Day Placement Route
                    </h2>
                    <p style="font-size:0.85rem;color:#657169;margin:0 0 16px;">
                        A focused daily session. Learn a pattern, practise it, and revisit what needs work.
                    </p>

                    <!-- Overall Progress Bar -->
                    <div style="background:rgba(36, 48, 40, 0.08);height:8px;border-radius:4px;overflow:hidden;margin-bottom:8px;">
                        <div style="height:100%;width:${progressPct}%;background:#edf1ea;border-radius:4px;transition:width 0.4s ease;"></div>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:#657169;">
                        <span>${completedCount} of 14 Days Completed</span>
                        <span>${progressPct}% complete</span>
                    </div>
                </div>

                <!-- Today's Action Card -->
                <div style="background:#ffffff;border:2px solid #426451;border-radius:20px;padding:20px;margin-bottom:26px;box-shadow:none;">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                        <span style="font-size:0.75rem;padding:3px 10px;border-radius:999px;background:rgba(66, 100, 81, 0.16);color:#426451;font-weight:800;text-transform:uppercase;">
                            Up Next (Day ${currentTask.day})
                        </span>
                        <span style="font-size:0.75rem;color:#657169;">
                            ~${currentTask.timeMinutes} mins
                        </span>
                    </div>
                    <h3 style="font-size:1.15rem;font-weight:800;color:#222e28;margin:0 0 6px;">
                        ${currentTask.title}
                    </h3>
                    <p style="font-size:0.85rem;color:#657169;line-height:1.5;margin:0 0 18px;">
                        ${currentTask.desc}
                    </p>
                    <button type="button" id="resume-today-btn" style="width:100%;padding:14px;border-radius:14px;background:#edf1ea;border:none;color:#222e28;font-size:0.95rem;font-weight:800;cursor:pointer;box-shadow:none;">
                        Continue day ${currentTask.day} →
                    </button>
                </div>

                <!-- Full 14-Day Calendar Schedule -->
                <div style="font-size:0.85rem;font-weight:700;color:#657169;text-transform:uppercase;letter-spacing:1px;margin-bottom:14px;">
                    Your 14-day plan
                </div>
                <div class="route-days-list">
                    ${daysCardsHTML}
                </div>
            </div>
        `;

        // Wire Action button for today
        const resumeBtn = document.getElementById('resume-today-btn');
        if (resumeBtn) {
            resumeBtn.addEventListener('click', () => {
                handleLaunchDay(currentTask, onActionLaunch);
            });
        }

        // Wire individual day cards
        container.querySelectorAll('.route-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const dayNum = parseInt(btn.dataset.day, 10);
                const task = plan.find(p => p.day === dayNum);
                if (task) handleLaunchDay(task, onActionLaunch);
            });
        });
    }

    /**
     * Dispatch action when user starts a day
     */
    function handleLaunchDay(task, onActionLaunch) {
        if (typeof onActionLaunch !== 'function') return;

        if (task.type === 'pattern_day') {
            onActionLaunch({
                action: 'open_pattern',
                pattern: task.pattern,
                topic: task.topic,
                day: task.day
            });
        } else if (task.type === 'checkpoint_1') {
            onActionLaunch({
                action: 'open_checkpoint',
                checkpointNumber: 1,
                day: task.day
            });
        } else if (task.type === 'checkpoint_2') {
            onActionLaunch({
                action: 'open_checkpoint',
                checkpointNumber: 2,
                day: task.day
            });
        } else if (task.type === 'boundary_and_retries') {
            onActionLaunch({
                action: 'open_notebook',
                day: task.day
            });
        } else if (task.type === 'first_move_drills') {
            onActionLaunch({
                action: 'open_first_move_drills',
                day: task.day
            });
        } else if (task.type === 'diagnostic') {
            onActionLaunch({
                action: 'open_diagnostic',
                day: task.day
            });
        }
    }

    return {
        loadRouteState,
        saveRouteState,
        completeDay,
        renderRouteView,
        DEFAULT_14_DAY_PLAN
    };
})();
