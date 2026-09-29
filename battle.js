/**
 * battle.js — 1vs1 Real-Time Aptitude Battle Engine for LaquTum
 * 
 * Features:
 * - Room code generation & QR code rendering
 * - Camera QR scanning via Html5Qrcode
 * - Real-time matchmaking via Supabase Broadcast Channels (zero-database dependency)
 * - Synchronized 5-minute battle timer
 * - Question order permutation (same questions, shifted order: e.g. Q1 for A is Q3 for B)
 * - Per-question stopwatch tracking
 * - Head-to-head Showdown comparison screen with speed & accuracy breakdown
 */

const BattleManager = (() => {
    let roomCode = null;
    let isHost = false;
    let channel = null;
    let opponent = null;
    let battleQuestions = [];
    let myQuestionOrder = [];
    let currentStep = 0;
    let timerInterval = null;
    let timeRemaining = 300; // 5 minutes in seconds
    let battleStartTime = null;
    let questionStartTime = null;
    let myResults = [];
    let opponentResults = null;
    let html5QrScanner = null;
    let isWaitingForOpponent = false;

    // Helper: Select elements
    const $ = id => document.getElementById(id);

    // Generate unique 6-character room code like LQ-7482
    function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `LQ-${code}`;
    }

    // Get current user info
    function getCurrentUser() {
        if (typeof AuthManager !== 'undefined') {
            const user = AuthManager.getCurrentUserSync();
            if (user) {
                return {
                    id: user.id || 'user_' + Math.random().toString(36).substring(2, 7),
                    name: user.name || (user.email ? user.email.split('@')[0] : 'Challenger')
                };
            }
        }
        return {
            id: 'guest_' + Math.random().toString(36).substring(2, 7),
            name: 'Player'
        };
    }

    /**
     * Open 1vs1 Lobby Screen
     */
    function openLobby() {
        cleanup();
        isHost = true;
        roomCode = generateRoomCode();

        if (typeof PreviewApp !== 'undefined') {
            PreviewApp.showScreen('screen-battle');
            PreviewApp.wireAppBottomNav('battle');
        }

        renderLobbyUI();
        initHostChannel();
    }

    /**
     * Render the 1vs1 Lobby Screen (Host QR + Join by Scan / Code)
     */
    function renderLobbyUI() {
        const container = $('battle-content');
        if (!container) return;

        container.innerHTML = `
            <div class="battle-lobby-wrap">
                <!-- Lobby Header -->
                <div class="battle-lobby-header">
                    <div class="battle-badge">⚔️ Real-Time 1vs1</div>
                    <h1 class="battle-title">Aptitude <span class="highlight-violet">Showdown</span></h1>
                    <p class="battle-subtitle">5 Minutes • Same Questions • Faster Brain Wins</p>
                </div>

                <!-- Lobby Grid (Host vs Join) -->
                <div class="battle-cards-grid">
                    <!-- Host Card: Your Room & QR -->
                    <div class="battle-card battle-host-card">
                        <div class="battle-card-tag">HOST BATTLE</div>
                        <h2 class="battle-card-title">Share Your Code</h2>
                        <p class="battle-card-desc">Ask your friend to scan your QR or enter this unique code to start.</p>
                        
                        <!-- QR Code Frame -->
                        <div class="qr-code-box" id="host-qr-box">
                            <div id="host-qr-code" class="qr-code-canvas"></div>
                        </div>

                        <!-- Room Code Display & Copy -->
                        <div class="room-code-badge" id="btn-copy-code" title="Click to copy code">
                            <span class="room-code-label">ROOM CODE:</span>
                            <span class="room-code-val">${roomCode}</span>
                            <span class="copy-icon">📋</span>
                        </div>
                        <div class="copied-tooltip" id="copied-tooltip">Copied to clipboard!</div>

                        <!-- Waiting Status Pulse -->
                        <div class="host-waiting-status">
                            <span class="waiting-dot"></span>
                            <span>Waiting for opponent to connect...</span>
                        </div>
                    </div>

                    <!-- Join Card: Scan or Enter Code -->
                    <div class="battle-card battle-join-card">
                        <div class="battle-card-tag">JOIN BATTLE</div>
                        <h2 class="battle-card-title">Join a Friend</h2>
                        <p class="battle-card-desc">Scan your friend's screen with camera or type their room code below.</p>

                        <!-- Camera Scan Button -->
                        <button class="battle-scan-btn" id="btn-open-scanner">
                            <span class="scan-btn-icon">📷</span>
                            <span>Scan QR Code</span>
                        </button>

                        <div class="battle-divider">
                            <span>OR ENTER CODE</span>
                        </div>

                        <!-- Manual Code Input -->
                        <div class="battle-input-wrap">
                            <input 
                                type="text" 
                                id="join-room-input" 
                                class="battle-room-input" 
                                placeholder="e.g. ${roomCode}" 
                                maxlength="10"
                                autocomplete="off"
                                spellcheck="false"
                            />
                            <button class="battle-join-btn" id="btn-join-room">Join</button>
                        </div>
                        <div class="battle-error-msg" id="join-error-msg"></div>

                        <!-- Quick How It Works -->
                        <div class="battle-rules-box">
                            <div class="rule-item">⏱️ <strong>5-Min Clock:</strong> Synchronized timer for both players.</div>
                            <div class="rule-item">🔀 <strong>Scrambled Order:</strong> Same questions, different question positions!</div>
                            <div class="rule-item">🏆 <strong>Winner:</strong> Highest score & fastest completion wins.</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Render QR Code using QRCode library
        setTimeout(() => {
            renderHostQRCode();
        }, 80);

        // Attach lobby listeners
        attachLobbyListeners();
    }

    /**
     * Render the QR Code canvas
     */
    function renderHostQRCode() {
        const qrContainer = $('host-qr-code');
        if (!qrContainer) return;
        qrContainer.innerHTML = '';

        if (typeof QRCode !== 'undefined') {
            try {
                new QRCode(qrContainer, {
                    text: roomCode,
                    width: 170,
                    height: 170,
                    colorDark: '#0D0D19',
                    colorLight: '#FFFFFF',
                    correctLevel: QRCode.CorrectLevel.M
                });
            } catch (e) {
                console.warn('[Battle] QRCode render error:', e);
                qrContainer.innerHTML = `<div style="padding:20px;color:#fff;font-weight:700;">${roomCode}</div>`;
            }
        } else {
            qrContainer.innerHTML = `<div style="padding:20px;color:#fff;font-weight:700;">${roomCode}</div>`;
        }
    }

    /**
     * Attach Lobby Event Listeners
     */
    function attachLobbyListeners() {
        // Copy Room Code Button
        const copyBtn = $('btn-copy-code');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(roomCode);
                }
                const tooltip = $('copied-tooltip');
                if (tooltip) {
                    tooltip.classList.add('show');
                    setTimeout(() => tooltip.classList.remove('show'), 2000);
                }
            });
        }

        // Open Camera Scanner Button
        const scanBtn = $('btn-open-scanner');
        if (scanBtn) {
            scanBtn.addEventListener('click', openCameraScanner);
        }

        // Close Camera Scanner Modal
        const closeScanBtn = $('qr-scanner-close');
        if (closeScanBtn) {
            closeScanBtn.addEventListener('click', closeCameraScanner);
        }

        // Join Room by Code
        const joinBtn = $('btn-join-room');
        const joinInput = $('join-room-input');
        if (joinBtn && joinInput) {
            const handleJoin = () => {
                const code = joinInput.value.trim().toUpperCase();
                if (!code) {
                    showJoinError('Please enter a room code.');
                    return;
                }
                joinRoom(code);
            };

            joinBtn.addEventListener('click', handleJoin);
            joinInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleJoin();
            });
        }
    }

    function showJoinError(msg) {
        const err = $('join-error-msg');
        if (err) {
            err.textContent = msg;
            err.style.display = 'block';
            setTimeout(() => { err.style.display = 'none'; }, 3500);
        }
    }

    /**
     * Host Supabase Channel Setup
     */
    function initHostChannel() {
        if (!window.supabaseClient) {
            console.error('[Battle] Supabase client not found.');
            return;
        }

        const channelName = `1v1_battle_${roomCode}`;
        channel = window.supabaseClient.channel(channelName, {
            config: { broadcast: { self: false } }
        });

        // Listen for player join
        channel.on('broadcast', { event: 'player_joined' }, (payload) => {
            console.log('[Battle] Opponent joined room:', payload);
            opponent = payload.payload.user;
            onOpponentJoined();
        });

        // Listen for opponent's live progress
        channel.on('broadcast', { event: 'player_progress' }, (payload) => {
            onOpponentProgress(payload.payload);
        });

        // Listen for opponent's completion
        channel.on('broadcast', { event: 'player_finished' }, (payload) => {
            onOpponentFinished(payload.payload);
        });

        // Listen for rematch
        channel.on('broadcast', { event: 'rematch_start' }, (payload) => {
            startBattle(payload.payload.questions, payload.payload.order, payload.payload.startTime);
        });

        channel.subscribe((status) => {
            console.log(`[Battle Host] Channel ${channelName} status:`, status);
        });
    }

    /**
     * Join Room as Challenger
     */
    function joinRoom(targetCode) {
        if (!window.supabaseClient) {
            showJoinError('Database connection error.');
            return;
        }

        if (targetCode === roomCode && isHost) {
            showJoinError('You cannot join your own room.');
            return;
        }

        cleanupChannel();
        isHost = false;
        roomCode = targetCode;

        const channelName = `1v1_battle_${roomCode}`;
        channel = window.supabaseClient.channel(channelName, {
            config: { broadcast: { self: false } }
        });

        const me = getCurrentUser();

        // Listen for battle start from host
        channel.on('broadcast', { event: 'battle_start' }, (payload) => {
            console.log('[Battle] Received battle start:', payload);
            opponent = payload.payload.host;
            startBattle(payload.payload.questions, payload.payload.orderB, payload.payload.startTime);
        });

        // Listen for opponent progress
        channel.on('broadcast', { event: 'player_progress' }, (payload) => {
            onOpponentProgress(payload.payload);
        });

        // Listen for opponent finish
        channel.on('broadcast', { event: 'player_finished' }, (payload) => {
            onOpponentFinished(payload.payload);
        });

        // Listen for rematch
        channel.on('broadcast', { event: 'rematch_start' }, (payload) => {
            startBattle(payload.payload.questions, payload.payload.order, payload.payload.startTime);
        });

        channel.subscribe(async (status) => {
            console.log(`[Battle Challenger] Channel ${channelName} status:`, status);
            if (status === 'SUBSCRIBED') {
                // Send join notification to host
                await channel.send({
                    type: 'broadcast',
                    event: 'player_joined',
                    payload: { user: me }
                });

                // Show waiting indicator
                const container = $('battle-content');
                if (container) {
                    container.innerHTML = `
                        <div class="battle-connecting-wrap">
                            <div class="battle-connecting-icon">⚔️</div>
                            <h2>Connected to ${roomCode}!</h2>
                            <p>Preparing questions with host...</p>
                            <div class="connecting-spinner"></div>
                        </div>
                    `;
                }
            }
        });
    }

    /**
     * Opponent Joined Handler (Host side)
     */
    async function onOpponentJoined() {
        const me = getCurrentUser();

        // Select 5 balanced questions from ContentBank or fallback
        const questions = selectBattleQuestions(5);
        battleQuestions = questions;

        // Sequence orders:
        // Host (A): [0, 1, 2, 3, 4]
        // Challenger (B): [2, 4, 0, 3, 1] — (e.g. Q1 for A is Q3 for B!)
        const orderA = [0, 1, 2, 3, 4];
        const orderB = [2, 4, 0, 3, 1];

        const startTime = Date.now() + 3500; // 3.5s countdown

        // Broadcast battle_start to challenger
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'battle_start',
                payload: {
                    host: me,
                    questions: questions,
                    orderB: orderB,
                    startTime: startTime
                }
            });
        }

        // Start countdown on host
        startBattle(questions, orderA, startTime);
    }

    /**
     * Select 5 aptitude questions from content bank
     */
    function selectBattleQuestions(count = 5) {
        let pool = [];
        if (typeof ContentBank !== 'undefined' && ContentBank.entries) {
            pool = ContentBank.entries.filter(e => e.type === 'question' && e.options && e.options.length >= 4);
        }

        // If pool is empty, provide 5 high-quality standard aptitude questions
        if (pool.length < count) {
            pool = [
                {
                    id: 'q_speed_1',
                    question: 'A train 240 m long passes a pole in 24 seconds. How long will it take to pass a platform 650 m long?',
                    options: ['65 seconds', '89 seconds', '100 seconds', '75 seconds'],
                    correct_index: 1,
                    pattern: 'Time & Distance'
                },
                {
                    id: 'q_perc_2',
                    question: 'If 20% of a = b, then b% of 20 is the same as what percent of a?',
                    options: ['4% of a', '5% of a', '20% of a', 'None of these'],
                    correct_index: 0,
                    pattern: 'Percentages'
                },
                {
                    id: 'q_work_3',
                    question: 'A can do a piece of work in 10 days, and B can do it in 15 days. How long will they take working together?',
                    options: ['5 days', '6 days', '8 days', '12 days'],
                    correct_index: 1,
                    pattern: 'Time & Work'
                },
                {
                    id: 'q_ages_4',
                    question: 'A father is 30 years old and his son is 6 years old. In how many years will the father be 3 times as old as the son?',
                    options: ['6 years', '5 years', '4 years', '8 years'],
                    correct_index: 0,
                    pattern: 'Problems on Ages'
                },
                {
                    id: 'q_prob_5',
                    question: 'Two dice are tossed once. What is the probability of getting a sum of 9?',
                    options: ['1/9', '1/6', '1/12', '1/4'],
                    correct_index: 0,
                    pattern: 'Probability'
                }
            ];
        }

        // Shuffle pool and pick `count`
        const shuffled = [...pool].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count).map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            correct_index: q.correct_index,
            pattern: q.pattern || 'Aptitude'
        }));
    }

    /**
     * Start the 1vs1 Battle Arena
     */
    function startBattle(questions, myOrder, startTime) {
        battleQuestions = questions;
        myQuestionOrder = myOrder;
        currentStep = 0;
        myResults = [];
        opponentResults = null;
        isWaitingForOpponent = false;
        timeRemaining = 300; // 5 minutes

        const container = $('battle-content');
        if (!container) return;

        // Render 3... 2... 1... Countdown Overlay
        container.innerHTML = `
            <div class="battle-countdown-screen">
                <div class="countdown-badge">MATCH CONFIRMED</div>
                <div class="countdown-vs-row">
                    <div class="countdown-player">
                        <div class="player-avatar">👤</div>
                        <div class="player-name">${getCurrentUser().name}</div>
                    </div>
                    <div class="countdown-vs-badge">VS</div>
                    <div class="countdown-player">
                        <div class="player-avatar opp-avatar">⚔️</div>
                        <div class="player-name">${opponent ? opponent.name : 'Opponent'}</div>
                    </div>
                </div>
                <div class="countdown-number" id="countdown-num">3</div>
                <div class="countdown-subtitle">Get Ready! 5 Minutes on the Clock</div>
            </div>
        `;

        // 3-second animated countdown
        let count = 3;
        const countInt = setInterval(() => {
            count--;
            const numEl = $('countdown-num');
            if (numEl) {
                if (count > 0) {
                    numEl.textContent = count;
                    numEl.style.animation = 'none';
                    numEl.offsetHeight; // trigger reflow
                    numEl.style.animation = 'pulsePop 0.8s ease';
                } else if (count === 0) {
                    numEl.textContent = 'START!';
                    numEl.style.color = '#58cc02';
                } else {
                    clearInterval(countInt);
                    launchBattleUI();
                }
            } else {
                clearInterval(countInt);
            }
        }, 1000);
    }

    /**
     * Launch Active Battle Interface
     */
    function launchBattleUI() {
        battleStartTime = Date.now();
        renderQuestionStep();
        startTimer();
    }

    /**
     * Start the 5-Minute Countdown Timer
     */
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();

            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                finishBattleByTimeout();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const timerEl = $('battle-timer-display');
        if (!timerEl) return;

        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        timerEl.textContent = formatted;

        if (timeRemaining <= 60) {
            timerEl.classList.add('urgent');
        }
        if (timeRemaining <= 30) {
            timerEl.classList.add('critical');
        }
    }

    /**
     * Render the Current Question Step
     */
    function renderQuestionStep() {
        const container = $('battle-content');
        if (!container) return;

        if (currentStep >= myQuestionOrder.length) {
            // Player finished all questions
            onPlayerFinishedAll();
            return;
        }

        questionStartTime = Date.now();

        const originalQIndex = myQuestionOrder[currentStep];
        const qData = battleQuestions[originalQIndex];

        const mins = Math.floor(timeRemaining / 60);
        const secs = timeRemaining % 60;
        const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        container.innerHTML = `
            <div class="battle-arena-wrap">
                <!-- Dual Player Status Bar Header -->
                <div class="battle-topbar-card">
                    <!-- You -->
                    <div class="battle-player-status you">
                        <div class="player-dot"></div>
                        <div class="player-info">
                            <span class="p-tag">YOU</span>
                            <span class="p-progress" id="my-progress-text">Q ${currentStep + 1}/${myQuestionOrder.length}</span>
                        </div>
                    </div>

                    <!-- Synchronized Timer -->
                    <div class="battle-center-timer">
                        <span class="timer-icon">⏱️</span>
                        <span class="timer-val" id="battle-timer-display">${formattedTime}</span>
                    </div>

                    <!-- Opponent -->
                    <div class="battle-player-status opp">
                        <div class="player-info text-right">
                            <span class="p-tag">${opponent ? opponent.name : 'OPPONENT'}</span>
                            <span class="p-progress" id="opp-progress-text">Q 1/${myQuestionOrder.length}</span>
                        </div>
                        <div class="player-dot opp-dot" id="opp-status-dot"></div>
                    </div>
                </div>

                <!-- Battle Progress Track -->
                <div class="battle-track-bar">
                    <div class="battle-track-fill" style="width: ${((currentStep) / myQuestionOrder.length) * 100}%;"></div>
                </div>

                <!-- Question Card -->
                <div class="battle-question-card">
                    <div class="battle-q-tag">Question ${currentStep + 1} of ${myQuestionOrder.length} • ${qData.pattern}</div>
                    <div class="battle-q-text">${qData.question}</div>

                    <!-- Options Grid -->
                    <div class="battle-options-grid">
                        ${qData.options.map((opt, idx) => `
                            <button class="battle-opt-btn" data-index="${idx}">
                                <span class="opt-letter">${String.fromCharCode(65 + idx)}</span>
                                <span class="opt-text">${opt}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Wire option clicks
        container.querySelectorAll('.battle-opt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const selectedIdx = parseInt(btn.dataset.index, 10);
                handleAnswerSelection(selectedIdx);
            });
        });
    }

    /**
     * Handle Answer Selection
     */
    async function handleAnswerSelection(selectedIdx) {
        const timeSpent = Math.max(1, Math.round((Date.now() - questionStartTime) / 1000));
        const originalQIndex = myQuestionOrder[currentStep];
        const qData = battleQuestions[originalQIndex];
        const isCorrect = (selectedIdx === qData.correct_index);

        // Record player result
        myResults.push({
            step: currentStep,
            originalIndex: originalQIndex,
            questionText: qData.question,
            options: qData.options,
            selectedIndex: selectedIdx,
            correctIndex: qData.correct_index,
            isCorrect: isCorrect,
            timeSpent: timeSpent
        });

        // Broadcast progress to opponent
        if (channel) {
            channel.send({
                type: 'broadcast',
                event: 'player_progress',
                payload: {
                    user: getCurrentUser(),
                    answeredStep: currentStep + 1,
                    totalSteps: myQuestionOrder.length
                }
            });
        }

        currentStep++;
        renderQuestionStep();
    }

    /**
     * Opponent Progress Update Event
     */
    function onOpponentProgress(data) {
        const oppProgressText = $('opp-progress-text');
        const oppDot = $('opp-status-dot');

        if (oppProgressText && data.answeredStep) {
            oppProgressText.textContent = `Q ${data.answeredStep}/${data.totalSteps || 5}`;
        }
        if (oppDot) {
            oppDot.classList.add('pulse');
            setTimeout(() => oppDot.classList.remove('pulse'), 800);
        }
    }

    /**
     * Player Finished All Questions
     */
    async function onPlayerFinishedAll() {
        isWaitingForOpponent = true;
        const totalScore = myResults.filter(r => r.isCorrect).length;
        const totalTime = Math.round((Date.now() - battleStartTime) / 1000);

        // Broadcast finished payload
        if (channel) {
            await channel.send({
                type: 'broadcast',
                event: 'player_finished',
                payload: {
                    user: getCurrentUser(),
                    score: totalScore,
                    totalTime: totalTime,
                    results: myResults
                }
            });
        }

        // If opponent also finished, show showdown!
        if (opponentResults) {
            clearInterval(timerInterval);
            renderShowdownResults();
        } else {
            // Show waiting for opponent screen
            const container = $('battle-content');
            if (container) {
                container.innerHTML = `
                    <div class="battle-waiting-finish-wrap">
                        <div class="finish-check-icon">✓</div>
                        <h2 class="finish-title">All Questions Submitted!</h2>
                        <p class="finish-subtitle">Your Score: <strong style="color:#a855f7;">${totalScore}/${myResults.length}</strong> in ${formatTime(totalTime)}</p>
                        
                        <div class="waiting-opp-card">
                            <span class="waiting-dot"></span>
                            <span>Waiting for ${opponent ? opponent.name : 'opponent'} to finish...</span>
                        </div>
                    </div>
                `;
            }
        }
    }

    /**
     * Opponent Finished Event
     */
    function onOpponentFinished(payload) {
        opponentResults = payload;
        console.log('[Battle] Opponent finished battle:', opponentResults);

        if (isWaitingForOpponent) {
            clearInterval(timerInterval);
            renderShowdownResults();
        }
    }

    /**
     * Timeout Finish (5-Minute Clock Expired)
     */
    function finishBattleByTimeout() {
        // Fill remaining questions as unanswered
        while (currentStep < myQuestionOrder.length) {
            const originalQIndex = myQuestionOrder[currentStep];
            const qData = battleQuestions[originalQIndex];
            myResults.push({
                step: currentStep,
                originalIndex: originalQIndex,
                questionText: qData.question,
                options: qData.options,
                selectedIndex: -1,
                correctIndex: qData.correct_index,
                isCorrect: false,
                timeSpent: 60
            });
            currentStep++;
        }

        onPlayerFinishedAll();
    }

    /**
     * Render the 1vs1 Showdown Results Screen
     */
    function renderShowdownResults() {
        cleanupChannel();
        const container = $('battle-content');
        if (!container) return;

        const myScore = myResults.filter(r => r.isCorrect).length;
        const myTotalTime = myResults.reduce((acc, r) => acc + r.timeSpent, 0);

        const oppScore = opponentResults ? opponentResults.score : 0;
        const oppTotalTime = opponentResults ? opponentResults.totalTime : 300;
        const oppResultsList = opponentResults ? opponentResults.results : [];

        // Determine Winner:
        // 1. Higher score wins
        // 2. If score tie, faster total time wins
        // 3. If exact score and exact time, Draw
        let outcome = 'DRAW';
        if (myScore > oppScore) {
            outcome = 'VICTORY';
        } else if (myScore < oppScore) {
            outcome = 'DEFEAT';
        } else {
            if (myTotalTime < oppTotalTime) {
                outcome = 'VICTORY';
            } else if (myTotalTime > oppTotalTime) {
                outcome = 'DEFEAT';
            } else {
                outcome = 'DRAW';
            }
        }

        const outcomeBannerClass = outcome === 'VICTORY' ? 'victory' : (outcome === 'DEFEAT' ? 'defeat' : 'draw');
        const outcomeTitle = outcome === 'VICTORY' ? '🏆 VICTORY!' : (outcome === 'DEFEAT' ? '💀 DEFEAT' : '🤝 IT\'S A TIE!');
        const outcomeSub = outcome === 'VICTORY' 
            ? 'Outstanding speed and precision! You outmatched your opponent.'
            : (outcome === 'DEFEAT' ? 'Tough match! Your opponent was quicker on this round.' : 'Identical score and timing — a true clash of equals!');

        container.innerHTML = `
            <div class="battle-showdown-wrap">
                <!-- Result Banner -->
                <div class="showdown-outcome-banner ${outcomeBannerClass}">
                    <div class="outcome-title">${outcomeTitle}</div>
                    <div class="outcome-subtitle">${outcomeSub}</div>
                </div>

                <!-- Head-to-Head Comparison Cards -->
                <div class="showdown-h2h-grid">
                    <!-- You -->
                    <div class="h2h-player-card ${outcome === 'VICTORY' ? 'winner' : ''}">
                        <div class="h2h-header">
                            <span class="h2h-badge">YOU</span>
                            <span class="h2h-name">${getCurrentUser().name}</span>
                        </div>
                        <div class="h2h-score-big">${myScore} <span class="h2h-total">/ ${myResults.length}</span></div>
                        <div class="h2h-metric-row">
                            <span>⏱️ Total Time:</span>
                            <strong>${formatTime(myTotalTime)}</strong>
                        </div>
                        <div class="h2h-metric-row">
                            <span>⚡ Avg Speed:</span>
                            <strong>${Math.round(myTotalTime / (myResults.length || 1))}s / question</strong>
                        </div>
                    </div>

                    <!-- Opponent -->
                    <div class="h2h-player-card ${outcome === 'DEFEAT' ? 'winner' : ''}">
                        <div class="h2h-header">
                            <span class="h2h-badge opp-badge">OPPONENT</span>
                            <span class="h2h-name">${opponent ? opponent.name : 'Challenger'}</span>
                        </div>
                        <div class="h2h-score-big">${oppScore} <span class="h2h-total">/ ${myResults.length}</span></div>
                        <div class="h2h-metric-row">
                            <span>⏱️ Total Time:</span>
                            <strong>${formatTime(oppTotalTime)}</strong>
                        </div>
                        <div class="h2h-metric-row">
                            <span>⚡ Avg Speed:</span>
                            <strong>${Math.round(oppTotalTime / (myResults.length || 1))}s / question</strong>
                        </div>
                    </div>
                </div>

                <!-- Question-by-Question Timing Comparison Table -->
                <div class="showdown-breakdown-card">
                    <div class="breakdown-header">
                        <h3>Detailed Question Timing Breakdown</h3>
                        <span class="breakdown-tag">Exact Seconds Spent</span>
                    </div>

                    <div class="breakdown-list">
                        ${battleQuestions.map((q, idx) => {
                            // Find how you did on this question
                            const myEntry = myResults.find(r => r.originalIndex === idx);
                            // Find how opponent did on this question
                            const oppEntry = oppResultsList.find(r => r.originalIndex === idx);

                            const myCorrect = myEntry ? myEntry.isCorrect : false;
                            const myTime = myEntry ? myEntry.timeSpent : 0;

                            const oppCorrect = oppEntry ? oppEntry.isCorrect : false;
                            const oppTime = oppEntry ? oppEntry.timeSpent : 0;

                            let speedWinner = '';
                            if (myTime > 0 && oppTime > 0) {
                                if (myTime < oppTime) {
                                    speedWinner = `<span class="speed-badge faster">⚡ You were ${oppTime - myTime}s faster!</span>`;
                                } else if (oppTime < myTime) {
                                    speedWinner = `<span class="speed-badge slower">Opponent was ${myTime - oppTime}s faster</span>`;
                                } else {
                                    speedWinner = `<span class="speed-badge tied">Equal Speed</span>`;
                                }
                            }

                            return `
                                <div class="breakdown-item">
                                    <div class="q-breakdown-title">
                                        <strong>Q${idx + 1}:</strong> ${q.question}
                                    </div>
                                    <div class="q-comparison-row">
                                        <div class="q-side-col">
                                            <span class="q-side-label">You:</span>
                                            <span class="q-acc-tag ${myCorrect ? 'correct' : 'wrong'}">
                                                ${myCorrect ? '✓ Correct' : '✗ Wrong'}
                                            </span>
                                            <span class="q-time-val">${myTime}s</span>
                                        </div>
                                        <div class="q-side-vs">vs</div>
                                        <div class="q-side-col">
                                            <span class="q-side-label">${opponent ? opponent.name : 'Opponent'}:</span>
                                            <span class="q-acc-tag ${oppCorrect ? 'correct' : 'wrong'}">
                                                ${oppCorrect ? '✓ Correct' : '✗ Wrong'}
                                            </span>
                                            <span class="q-time-val">${oppTime}s</span>
                                        </div>
                                    </div>
                                    <div class="q-speed-winner">${speedWinner}</div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Showdown Action Buttons -->
                <div class="showdown-actions">
                    <button class="showdown-btn rematch-btn" id="btn-play-again">
                        ⚔️ Play Another Battle
                    </button>
                    <button class="showdown-btn home-btn" id="btn-battle-home">
                        🏠 Back to Home
                    </button>
                </div>
            </div>
        `;

        // Wire Action Buttons
        const playAgainBtn = $('btn-play-again');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                openLobby();
            });
        }

        const homeBtn = $('btn-battle-home');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                if (typeof PreviewApp !== 'undefined') {
                    PreviewApp.renderPostResultsChoice();
                }
            });
        }
    }

    /**
     * Camera QR Scanner implementation
     */
    function openCameraScanner() {
        const modal = $('qr-scanner-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        if (typeof Html5Qrcode === 'undefined') {
            alert('Camera scanner library not loaded. You can enter the code manually.');
            return;
        }

        try {
            html5QrScanner = new Html5Qrcode('qr-reader');
            html5QrScanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 240, height: 240 }
                },
                (decodedText) => {
                    console.log('[Battle Scanner] Decoded code:', decodedText);
                    closeCameraScanner();
                    joinRoom(decodedText.trim().toUpperCase());
                },
                (errorMessage) => {
                    // Ongoing scanning errors are normal frames without code
                }
            ).catch(err => {
                console.warn('[Battle Scanner] Camera start error:', err);
                alert('Could not access camera. Please make sure camera permissions are allowed, or type the code manually.');
                closeCameraScanner();
            });
        } catch (e) {
            console.error('[Battle Scanner] Exception:', e);
            closeCameraScanner();
        }
    }

    function closeCameraScanner() {
        const modal = $('qr-scanner-modal');
        if (modal) modal.classList.add('hidden');

        if (html5QrScanner) {
            html5QrScanner.stop().then(() => {
                html5QrScanner.clear();
                html5QrScanner = null;
            }).catch(e => {
                console.warn('[Battle Scanner] Stop error:', e);
                html5QrScanner = null;
            });
        }
    }

    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
    }

    function cleanupChannel() {
        if (channel && window.supabaseClient) {
            try {
                window.supabaseClient.removeChannel(channel);
            } catch (e) {}
            channel = null;
        }
    }

    function cleanup() {
        cleanupChannel();
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        closeCameraScanner();
    }

    return {
        openLobby,
        joinRoom,
        cleanup
    };
})();

window.BattleManager = BattleManager;
