/**
 * socio.js — LaquTum Socio: Student Social Network
 * Connect, Chat, Share Notes, Earn XP
 */

const SocioManager = (() => {
    let currentTab = 'discover';
    let socioProfile = null; // Current user's socio profile
    let connections = []; // Connected users
    let allProfiles = []; // All discoverable profiles
    let chatPartner = null; // Currently chatting with
    let chatMessages = []; // Current chat messages
    let chatPollInterval = null;

    const INTERESTS = [
        'Aptitude', 'Reasoning', 'Verbal', 'Coding', 'DSA',
        'Maths', 'Physics', 'Gate', 'CAT', 'Bank Exams',
        'Placements', 'Competitive Exams', 'Machine Learning', 'Web Dev'
    ];

    const AVATAR_EMOJIS = ['🧑‍🎓', '👩‍💻', '👨‍💻', '🦊', '🐱', '🚀', '⚡', '🎯', '🧠', '🌟', '🔥', '💡'];

    const YEAR_OPTIONS = ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate', 'Working Professional'];

    // ─── ENTRY POINT ─────────────────────────────
    async function open() {
        if (typeof PreviewApp !== 'undefined') {
            PreviewApp.showScreen('screen-socio');
            if (PreviewApp.wireAppBottomNav) {
                PreviewApp.wireAppBottomNav('socio');
            }
        }
        const container = document.getElementById('screen-socio');
        if (!container) return;

        let currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
        if (!currentUser && typeof AuthManager !== 'undefined' && AuthManager.getCurrentUser) {
            try {
                currentUser = await AuthManager.getCurrentUser();
            } catch (e) {}
        }

        if (!currentUser) {
            try {
                const storedGuest = localStorage.getItem('laqutum_socio_guest');
                if (storedGuest) {
                    currentUser = JSON.parse(storedGuest);
                }
            } catch (e) {}
        }

        if (!currentUser) {
            container.innerHTML = renderNeedAuth();
            wireNeedAuth(container);
            return;
        }

        const profile = await loadProfile(currentUser.id);
        socioProfile = profile;
        if (!profile) {
            container.innerHTML = renderSetup(currentUser);
            wireSetup(currentUser);
        } else {
            renderMain(container);
        }
    }

    // ─── SUPABASE DATA LAYER (WITH OFFLINE-FIRST CACHING) ─────────────────────
    async function loadProfile(userId) {
        try {
            const cached = localStorage.getItem('laqutum_socio_profile_' + userId);
            if (cached) return JSON.parse(cached);
        } catch (e) {}

        if (!window.supabaseClient) return null;
        try {
            const { data, error } = await window.supabaseClient
                .from('socio_profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();
            if (error) return null;
            if (data) {
                try { localStorage.setItem('laqutum_socio_profile_' + userId, JSON.stringify(data)); } catch (e) {}
            }
            return data;
        } catch (e) {
            return null;
        }
    }

    async function saveProfile(profileData) {
        try {
            localStorage.setItem('laqutum_socio_profile_' + profileData.user_id, JSON.stringify(profileData));
        } catch (e) {}

        if (window.supabaseClient) {
            window.supabaseClient
                .from('socio_profiles')
                .upsert(profileData, { onConflict: 'user_id' })
                .then(() => {})
                .catch(() => {});
        }
        return profileData;
    }

    async function loadAllProfiles() {
        let profiles = getDemoProfiles();
        if (window.supabaseClient) {
            try {
                const currentUser = typeof AuthManager !== 'undefined' ? AuthManager.getCurrentUserSync() : null;
                const userId = currentUser ? currentUser.id : null;
                let query = window.supabaseClient.from('socio_profiles').select('*').order('xp_earned', { ascending: false }).limit(50);
                if (userId) query = query.neq('user_id', userId);
                
                const fetchPromise = query.then(res => res).catch(() => null);
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 400));
                const res = await Promise.race([fetchPromise, timeoutPromise]);
                
                if (res && !res.error && res.data && res.data.length > 0) {
                    profiles = [...res.data, ...profiles];
                }
            } catch (e) {}
        }
        return profiles;
    }

    async function loadConnections(userId) {
        let localConns = [];
        try {
            const stored = localStorage.getItem('laqutum_socio_conns_' + userId);
            if (stored) localConns = JSON.parse(stored);
        } catch (e) {}

        if (!window.supabaseClient) return localConns;
        try {
            const { data, error } = await window.supabaseClient
                .from('socio_connections')
                .select('*')
                .or(`from_user.eq.${userId},to_user.eq.${userId}`);
            if (error || !data) return localConns;
            return [...localConns, ...data];
        } catch (e) {
            return localConns;
        }
    }

    async function sendConnectionRequest(toUserId) {
        if (!socioProfile) return;
        const newConn = {
            id: 'conn_' + Date.now().toString(36),
            from_user: socioProfile.user_id,
            to_user: toUserId,
            status: 'pending',
            created_at: new Date().toISOString()
        };
        try {
            const current = JSON.parse(localStorage.getItem('laqutum_socio_conns_' + socioProfile.user_id) || '[]');
            current.push(newConn);
            localStorage.setItem('laqutum_socio_conns_' + socioProfile.user_id, JSON.stringify(current));
            connections = current;
        } catch (e) {}

        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('socio_connections').insert({
                    from_user: socioProfile.user_id,
                    to_user: toUserId,
                    status: 'pending'
                });
            } catch (e) {}
        }
        await awardXP(5, 'connection_request');
    }

    async function acceptConnection(connectionId) {
        if (socioProfile) {
            try {
                const current = JSON.parse(localStorage.getItem('laqutum_socio_conns_' + socioProfile.user_id) || '[]');
                const found = current.find(c => c.id === connectionId);
                if (found) found.status = 'accepted';
                localStorage.setItem('laqutum_socio_conns_' + socioProfile.user_id, JSON.stringify(current));
                connections = current;
            } catch (e) {}
        }
        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('socio_connections')
                    .update({ status: 'accepted' })
                    .eq('id', connectionId);
            } catch (e) {}
        }
        await awardXP(10, 'connection_accepted');
    }

    async function loadChatMessages(partnerId) {
        const myId = socioProfile ? socioProfile.user_id : 'me';
        const key = `laqutum_chat_${[myId, partnerId].sort().join('_')}`;
        let localMsgs = [];
        try {
            const stored = localStorage.getItem(key);
            if (stored) localMsgs = JSON.parse(stored);
        } catch (e) {}

        if (!window.supabaseClient || !socioProfile) return localMsgs;
        try {
            const { data, error } = await window.supabaseClient
                .from('socio_messages')
                .select('*')
                .or(`and(from_user.eq.${myId},to_user.eq.${partnerId}),and(from_user.eq.${partnerId},to_user.eq.${myId})`)
                .order('created_at', { ascending: true })
                .limit(100);
            if (error || !data) return localMsgs;
            return [...localMsgs, ...data];
        } catch (e) {
            return localMsgs;
        }
    }

    async function sendChatMessage(partnerId, message) {
        const myId = socioProfile ? socioProfile.user_id : 'me';
        const key = `laqutum_chat_${[myId, partnerId].sort().join('_')}`;
        const newMsg = {
            id: 'msg_' + Date.now().toString(36),
            from_user: myId,
            to_user: partnerId,
            message: message,
            created_at: new Date().toISOString()
        };
        try {
            const current = JSON.parse(localStorage.getItem(key) || '[]');
            current.push(newMsg);
            localStorage.setItem(key, JSON.stringify(current));
        } catch (e) {}

        if (window.supabaseClient && socioProfile) {
            try {
                await window.supabaseClient.from('socio_messages').insert({
                    from_user: socioProfile.user_id,
                    to_user: partnerId,
                    message: message
                });
            } catch (e) {}
        }
        await awardXP(2, 'message_sent');

        // If chatting with a demo user, simulate an interactive peer response!
        if (partnerId.startsWith('demo')) {
            setTimeout(async () => {
                const demoReplies = [
                    "Great point! In the LaquTum framework, once you recognize the invariant pattern, questions become so much faster to solve! ⚡",
                    "Hey! I'm solving quantitative aptitude sets right now. Have you tried the 30-second mental clarity trick on this?",
                    "That's super helpful! Let's solve a few problems together and share our notes! 🤝",
                    "Awesome insight! Adding this note to my revision deck. Keep crushing it! 🚀"
                ];
                const replyText = demoReplies[Math.floor(Math.random() * demoReplies.length)];
                const replyMsg = {
                    id: 'msg_reply_' + Date.now().toString(36),
                    from_user: partnerId,
                    to_user: myId,
                    message: '[Demo automated reply] ' + replyText,
                    created_at: new Date().toISOString()
                };
                try {
                    const current = JSON.parse(localStorage.getItem(key) || '[]');
                    current.push(replyMsg);
                    localStorage.setItem(key, JSON.stringify(current));
                } catch (e) {}
                if (chatPartner && chatPartner.user_id === partnerId) {
                    chatMessages.push(replyMsg);
                    renderChatMessages();
                }
            }, 1200);
        }
    }

    async function loadNotes() {
        let notes = getDemoNotes();
        try {
            const sharedNotes = JSON.parse(localStorage.getItem('laqutum_socio_shared_notes') || '[]');
            if (sharedNotes.length > 0) {
                notes = [...sharedNotes, ...notes];
            }
        } catch (e) {}

        if (window.supabaseClient) {
            try {
                const fetchPromise = window.supabaseClient.from('socio_notes').select('*').order('likes', { ascending: false }).limit(20).then(res => res).catch(() => null);
                const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 400));
                const res = await Promise.race([fetchPromise, timeoutPromise]);
                if (res && !res.error && res.data && res.data.length > 0) {
                    notes = [...res.data, ...notes];
                }
            } catch (e) {}
        }
        return notes;
    }

    async function awardXP(amount, reason) {
        if (!socioProfile) return;
        const newXP = (socioProfile.xp_earned || 0) + amount;
        socioProfile.xp_earned = newXP;
        try {
            localStorage.setItem('laqutum_socio_profile_' + socioProfile.user_id, JSON.stringify(socioProfile));
        } catch (e) {}

        if (window.supabaseClient) {
            try {
                await window.supabaseClient.from('socio_profiles')
                    .update({ xp_earned: newXP })
                    .eq('user_id', socioProfile.user_id);
            } catch (e) {}
        }
    }

    // ─── DEMO DATA (when Supabase tables don't exist yet) ─────
    function getDemoProfiles() {
        return [
            { user_id: 'demo1', display_name: 'Arun Kumar', college: 'Anna University', year: '3rd Year', interests: ['Aptitude', 'Placements', 'DSA'], bio: 'Preparing for campus placements', avatar_emoji: 'AK', xp_earned: 340, online: true },
            { user_id: 'demo2', display_name: 'Priya S', college: 'VIT Vellore', year: '2nd Year', interests: ['Reasoning', 'Maths', 'CAT'], bio: 'CAT aspirant, love solving puzzles', avatar_emoji: 'PS', xp_earned: 520, online: true },
            { user_id: 'demo3', display_name: 'Karthik R', college: 'SRM Chennai', year: '4th Year', interests: ['Coding', 'Web Dev', 'Placements'], bio: 'Full-stack dev preparing for dream company', avatar_emoji: 'KR', xp_earned: 780, online: false },
            { user_id: 'demo4', display_name: 'Divya M', college: 'PSG Coimbatore', year: '3rd Year', interests: ['Machine Learning', 'Maths', 'Gate'], bio: 'GATE aspirant & ML enthusiast', avatar_emoji: 'DM', xp_earned: 450, online: true },
            { user_id: 'demo5', display_name: 'Rahul V', college: 'NIT Trichy', year: '2nd Year', interests: ['Aptitude', 'Competitive Exams', 'Verbal'], bio: 'Speed solving is my thing!', avatar_emoji: 'RV', xp_earned: 290, online: false },
            { user_id: 'demo6', display_name: 'Sneha P', college: 'CEG Guindy', year: '3rd Year', interests: ['Bank Exams', 'Reasoning', 'Maths'], bio: 'Preparing for SBI PO exam', avatar_emoji: 'SP', xp_earned: 610, online: true },
            { user_id: 'demo7', display_name: 'Vijay K', college: 'BITS Pilani', year: '4th Year', interests: ['DSA', 'Coding', 'Placements'], bio: 'Competitive programmer & placement mentor', avatar_emoji: 'VK', xp_earned: 920, online: false },
        ];
    }

    function getDemoNotes() {
        return [
            { id: 'n1', title: 'Time & Work Shortcuts', topic: 'Aptitude', likes: 42, user_id: 'demo1', author_name: 'Arun Kumar', content: 'Quick formulas for solving time and work problems in 30 seconds...' },
            { id: 'n2', title: 'Blood Relations Tricks', topic: 'Reasoning', likes: 38, user_id: 'demo2', author_name: 'Priya S', content: 'Family tree approach to crack blood relation questions...' },
            { id: 'n3', title: 'Percentage to Fraction Map', topic: 'Maths', likes: 55, user_id: 'demo4', author_name: 'Divya M', content: 'Essential percentage-fraction conversions for mental math...' },
            { id: 'n4', title: 'Permutation vs Combination', topic: 'Aptitude', likes: 31, user_id: 'demo6', author_name: 'Sneha P', content: 'When to use P and when to use C — a simple decision tree...' },
        ];
    }

    // ─── RENDER: NEED AUTH ────────────────────────
    function renderNeedAuth() {
        return `
            <div class="socio-container">
                <div class="socio-empty" style="padding-top:40px;">
                    <div class="socio-empty-icon" style="font-size:3.5rem;margin-bottom:12px;">🤝</div>
                    <h3 style="font-size:1.3rem;margin-bottom:8px;color:#172b4d;">Welcome to LaquTum Socio</h3>
                    <p style="color:#526179;margin-bottom:24px;max-width:320px;margin-left:auto;margin-right:auto;line-height:1.5;">
                        Connect with juniors, seniors, classmates & other colleges. Find study partners, share notes, learn together and earn XP!
                    </p>
                    <div style="display:flex;flex-direction:column;gap:12px;max-width:280px;margin:0 auto;">
                        <button class="socio-setup-btn" id="socio-btn-login" style="margin-top:0;">Log in / Create account</button>
                        <button class="socio-action-secondary" id="socio-btn-guest" style="padding:12px;border-radius:14px;border:1px solid rgba(36, 48, 40, 0.15);background:rgba(36, 48, 40, 0.06);color:#2458c6;font-weight:700;cursor:pointer;">Explore as a student</button>
                    </div>
                </div>
            </div>
        `;
    }

    function wireNeedAuth(container) {
        const loginBtn = container.querySelector('#socio-btn-login');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                if (typeof AuthManager !== 'undefined') {
                    AuthManager.openAuthModal('signin');
                }
            });
        }
        const guestBtn = container.querySelector('#socio-btn-guest');
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                const guestUser = {
                    id: 'guest_' + Date.now().toString(36),
                    name: 'Student Partner',
                    email: 'student@laqutum.com'
                };
                try {
                    localStorage.setItem('laqutum_socio_guest', JSON.stringify(guestUser));
                } catch (e) {}
                container.innerHTML = renderSetup(guestUser);
                wireSetup(guestUser);
            });
        }
    }

    // ─── RENDER: SETUP PROFILE ───────────────────
    function renderSetup(currentUser) {
        const interestTags = INTERESTS.map(i =>
            `<button type="button" class="socio-interest-tag" data-interest="${i}">${i}</button>`
        ).join('')

        const yearOptions = YEAR_OPTIONS.map(y =>
            `<option value="${y}">${y}</option>`
        ).join('')

        const avatarPicker = AVATAR_EMOJIS.map((e, idx) =>
            `<button type="button" class="socio-interest-tag ${idx === 0 ? 'selected' : ''}" data-avatar="${e}" style="font-size:1.2rem;padding:8px 12px;">${e}</button>`
        ).join('')

        return `
            <div class="socio-container">
                <div class="socio-setup">
                    <h3>🤝 Set Up Your Socio Profile</h3>
                    <p class="socio-setup-desc">Let other students find you and build study partnerships</p>

                    <div class="socio-form-group">
                        <label>Choose Your Avatar</label>
                        <div class="socio-interest-tags" id="socio-avatar-picker">
                            ${avatarPicker}
                        </div>
                    </div>

                    <div class="socio-form-group">
                        <label>Display Name</label>
                        <input type="text" id="socio-display-name" placeholder="Your name" value="${currentUser.name || ''}" maxlength="30">
                    </div>

                    <div class="socio-form-group">
                        <label>College / University</label>
                        <input type="text" id="socio-college" placeholder="e.g. Anna University" maxlength="60">
                    </div>

                    <div class="socio-form-group">
                        <label>Year</label>
                        <select id="socio-year">
                            <option value="" disabled selected>Select your year</option>
                            ${yearOptions}
                        </select>
                    </div>

                    <div class="socio-form-group">
                        <label>Short Bio</label>
                        <textarea id="socio-bio" placeholder="What are you preparing for?" rows="2" maxlength="120"></textarea>
                    </div>

                    <div class="socio-form-group">
                        <label>Interests (pick at least 2)</label>
                        <div class="socio-interest-tags" id="socio-interest-picker">
                            ${interestTags}
                        </div>
                    </div>

                    <button class="socio-setup-btn" id="socio-save-profile">Save study profile</button>
                </div>
            </div>
        `;
    }

    function wireSetup(currentUser) {
        // Avatar picker
        const avatarPicker = document.getElementById('socio-avatar-picker');
        if (avatarPicker) {
            avatarPicker.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-avatar]');
                if (!btn) return;
                avatarPicker.querySelectorAll('[data-avatar]').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        }

        // Interest picker
        const interestPicker = document.getElementById('socio-interest-picker');
        if (interestPicker) {
            interestPicker.addEventListener('click', (e) => {
                const btn = e.target.closest('.socio-interest-tag');
                if (!btn) return;
                btn.classList.toggle('selected');
            });
        }

        // Save profile
        const saveBtn = document.getElementById('socio-save-profile');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const displayName = document.getElementById('socio-display-name').value.trim();
                const college = document.getElementById('socio-college').value.trim();
                const year = document.getElementById('socio-year').value;
                const bio = document.getElementById('socio-bio').value.trim();
                const selectedInterests = Array.from(document.querySelectorAll('#socio-interest-picker .socio-interest-tag.selected')).map(b => b.dataset.interest);
                const selectedAvatar = document.querySelector('#socio-avatar-picker [data-avatar].selected');
                const avatarEmoji = selectedAvatar ? selectedAvatar.dataset.avatar : '🧑‍🎓';

                if (!displayName) { AppUI.notify('Please enter your display name'); return; }
                if (!college) { AppUI.notify('Please enter your college'); return; }
                if (!year) { AppUI.notify('Please select your year'); return; }
                if (selectedInterests.length < 2) { AppUI.notify('Please select at least 2 interests'); return; }

                saveBtn.textContent = '⏳ Saving...';
                saveBtn.disabled = true;

                const profileData = {
                    user_id: currentUser.id,
                    display_name: displayName,
                    college: college,
                    year: year,
                    bio: bio || 'Learning and growing!',
                    interests: selectedInterests,
                    avatar_emoji: avatarEmoji,
                    xp_earned: 0
                };

                const saved = await saveProfile(profileData);
                if (saved) {
                    socioProfile = saved;
                } else {
                    // Even if Supabase fails, use local data
                    socioProfile = profileData;
                }

                const container = document.getElementById('screen-socio');
                if (container) renderMain(container);
            });
        }
    }

    // ─── RENDER: MAIN SOCIO VIEW ─────────────────
    async function renderMain(container) {
        container.innerHTML = `
            <div class="socio-container">
                <div class="socio-header">
                    <h2>Better, together.</h2>
                    <p>Find your study circle. Share what you’re learning.</p>
                </div>

                <div class="socio-tabs">
                    <button class="socio-tab ${currentTab === 'discover' ? 'active' : ''}" data-tab="discover">Discover</button>
                    <button class="socio-tab ${currentTab === 'partners' ? 'active' : ''}" data-tab="partners">Partners</button>
                    <button class="socio-tab ${currentTab === 'notes' ? 'active' : ''}" data-tab="notes">Notes</button>
                    <button class="socio-tab ${currentTab === 'earn' ? 'active' : ''}" data-tab="earn">Your progress</button>
                </div>

                <div class="socio-search-wrap">
                    <span class="socio-search-icon">🔍</span>
                    <input type="text" class="socio-search-input" id="socio-search" aria-label="Search students, colleges and interests" placeholder="Search students, colleges, interests...">
                </div>

                <div id="socio-tab-content"></div>
            </div>
        `;

        // Wire tabs
        container.querySelectorAll('.socio-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                currentTab = tab.dataset.tab;
                container.querySelectorAll('.socio-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderTabContent();
            });
        });

        // Wire search
        const searchInput = document.getElementById('socio-search');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => renderTabContent(searchInput.value.trim()), 300);
            });
        }

        renderTabContent();
    }

    async function renderTabContent(searchQuery = '') {
        const contentEl = document.getElementById('socio-tab-content');
        if (!contentEl) return;

        switch (currentTab) {
            case 'discover':
                await renderDiscover(contentEl, searchQuery);
                break;
            case 'partners':
                await renderPartners(contentEl, searchQuery);
                break;
            case 'notes':
                await renderNotes(contentEl, searchQuery);
                break;
            case 'earn':
                renderEarn(contentEl);
                break;
        }
    }

    // ─── TAB: DISCOVER ───────────────────────────
    async function renderDiscover(el, query) {
        el.innerHTML = '<div style="text-align:center;padding:24px;color:#526179;">Loading students...</div>';
        allProfiles = await loadAllProfiles();

        let filtered = allProfiles;
        if (query) {
            const q = query.toLowerCase();
            filtered = allProfiles.filter(p =>
                (p.display_name || '').toLowerCase().includes(q) ||
                (p.college || '').toLowerCase().includes(q) ||
                (p.interests || []).some(i => i.toLowerCase().includes(q))
            );
        }

        if (filtered.length === 0) {
            el.innerHTML = `
                <div class="socio-empty">
                    <div class="socio-empty-icon">🔍</div>
                    <h3>No students found</h3>
                    <p>Try different search terms or check back later</p>
                </div>
            `;
            return;
        }

        el.innerHTML = `
            <div class="socio-section-title"> Students Near You</div>
            <div class="socio-user-list">
                ${filtered.map(p => renderUserCard(p)).join('')}
            </div>
        `;

        wireUserCards(el);
    }

    function renderUserCard(profile) {
        const interestBadges = (profile.interests || []).slice(0, 2).map(i =>
            `<span class="socio-user-badge socio-badge-college">${i}</span>`
        ).join('');

        const connectionStatus = getConnectionStatus(profile.user_id);
        let btnClass = 'connect';
        let btnText = '+ Connect';
        if (connectionStatus === 'accepted') { btnClass = 'connected'; btnText = '✓ Partners'; }
        else if (connectionStatus === 'pending') { btnClass = 'pending'; btnText = '⏳ Pending'; }

        return `
            <div class="socio-user-card" data-userid="${profile.user_id}">
                <div class="socio-avatar socio-avatar-gradient">
                    ${profile.avatar_emoji || '🧑‍🎓'}
                    ${profile.online ? '<span class="socio-online-dot"></span>' : ''}
                </div>
                <div class="socio-user-info">
                    <div class="socio-user-name">${escapeHtml(profile.display_name || 'Student')}${profile.user_id.startsWith('demo') ? ' · Demo' : ''}</div>
                    <div class="socio-user-meta">
                        <span class="socio-user-badge socio-badge-year">${profile.year || ''}</span>
                        ${interestBadges}
                        <span class="socio-user-badge socio-badge-xp">${profile.xp_earned || 0} XP</span>
                    </div>
                </div>
                <button class="socio-connect-btn ${btnClass}" data-connect="${profile.user_id}">${btnText}</button>
            </div>
        `;
    }

    function getConnectionStatus(userId) {
        if (!socioProfile) return 'none';
        const conn = connections.find(c =>
            (c.from_user === socioProfile.user_id && c.to_user === userId) ||
            (c.to_user === socioProfile.user_id && c.from_user === userId)
        );
        return conn ? conn.status : 'none';
    }

    function wireUserCards(el) {
        // Connect buttons
        el.querySelectorAll('.socio-connect-btn.connect').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = btn.dataset.connect;
                btn.textContent = '⏳ Sending...';
                btn.classList.remove('connect');
                btn.classList.add('pending');
                await sendConnectionRequest(userId);
                btn.textContent = '⏳ Pending';
            });
        });

        // Card click -> show profile
        el.querySelectorAll('.socio-user-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.socio-connect-btn')) return;
                const userId = card.dataset.userid;
                const profile = allProfiles.find(p => p.user_id === userId);
                if (profile) showProfileModal(profile);
            });
        });
    }

    // ─── TAB: PARTNERS ───────────────────────────
    async function renderPartners(el, query) {
        if (socioProfile) {
            connections = await loadConnections(socioProfile.user_id);
        }

        const acceptedConns = connections.filter(c => c.status === 'accepted');
        const pendingConns = connections.filter(c => c.status === 'pending' && c.to_user === (socioProfile ? socioProfile.user_id : ''));

        // Get partner profiles
        const partnerIds = acceptedConns.map(c =>
            c.from_user === (socioProfile ? socioProfile.user_id : '') ? c.to_user : c.from_user
        );

        const partnerProfiles = allProfiles.filter(p => partnerIds.includes(p.user_id));

        let html = '';

        if (pendingConns.length > 0) {
            html += `<div class="socio-section-title"><span class="socio-section-icon">📩</span> Pending Requests (${pendingConns.length})</div>`;
            html += '<div class="socio-user-list" style="margin-bottom:20px;">';
            pendingConns.forEach(conn => {
                const fromProfile = allProfiles.find(p => p.user_id === conn.from_user) || { display_name: 'Student', avatar_emoji: '🧑‍🎓', year: '', interests: [], xp_earned: 0 };
                html += `
                    <div class="socio-user-card">
                        <div class="socio-avatar socio-avatar-gradient">${fromProfile.avatar_emoji || '🧑‍🎓'}</div>
                        <div class="socio-user-info">
                            <div class="socio-user-name">${fromProfile.display_name}</div>
                            <div class="socio-user-meta">Wants to connect with you</div>
                        </div>
                        <button class="socio-connect-btn connect" data-accept="${conn.id}" style="background:#edf1ea;">
                            ✓ Accept
                        </button>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (partnerProfiles.length > 0) {
            html += `<div class="socio-section-title"><span class="socio-section-icon">🤝</span> Study Partners (${partnerProfiles.length})</div>`;
            html += '<div class="socio-user-list">';
            partnerProfiles.forEach(p => {
                html += `
                    <div class="socio-user-card" data-chat="${p.user_id}">
                        <div class="socio-avatar socio-avatar-gradient">
                            ${p.avatar_emoji || '🧑‍🎓'}
                            ${p.online ? '<span class="socio-online-dot"></span>' : ''}
                        </div>
                        <div class="socio-user-info">
                            <div class="socio-user-name">${p.display_name}</div>
                            <div class="socio-user-meta">
                                <span class="socio-user-badge socio-badge-year">${p.year || ''}</span>
                                <span class="socio-user-badge socio-badge-college">${p.college || ''}</span>
                            </div>
                        </div>
                        <button class="socio-connect-btn connected" style="background:rgba(66, 100, 81, 0.16);color:#2458c6;">Chat</button>
                    </div>
                `;
            });
            html += '</div>';
        }

        if (acceptedConns.length === 0 && pendingConns.length === 0) {
            html = `
                <div class="socio-empty">
                    <div class="socio-empty-icon">🤝</div>
                    <h3>No study partners yet</h3>
                    <p>Discover students and send connection requests to build your study network!</p>
                </div>
            `;
        }

        el.innerHTML = html;

        // Wire accept buttons
        el.querySelectorAll('[data-accept]').forEach(btn => {
            btn.addEventListener('click', async () => {
                btn.textContent = '✓ Accepted!';
                btn.style.background = 'rgba(34,197,94,0.2)';
                btn.style.color = '#34714e';
                await acceptConnection(btn.dataset.accept);
                setTimeout(() => renderTabContent(), 500);
            });
        });

        // Wire chat buttons
        el.querySelectorAll('[data-chat]').forEach(card => {
            card.addEventListener('click', () => {
                const partnerId = card.dataset.chat;
                const partner = allProfiles.find(p => p.user_id === partnerId) || partnerProfiles.find(p => p.user_id === partnerId);
                if (partner) openChat(partner);
            });
        });
    }

    // ─── TAB: NOTES ──────────────────────────────
    async function renderNotes(el, query) {
        el.innerHTML = '<div style="text-align:center;padding:24px;color:#526179;">Loading notes...</div>';
        const notes = await loadNotes();

        let filtered = notes;
        if (query) {
            const q = query.toLowerCase();
            filtered = notes.filter(n =>
                (n.title || '').toLowerCase().includes(q) ||
                (n.topic || '').toLowerCase().includes(q)
            );
        }

        const topicIcons = { 'Aptitude': '🧮', 'Reasoning': '🧩', 'Maths': '📐', 'Coding': '💻', 'Verbal': '📖' };

        el.innerHTML = `
            <div class="socio-section-title"> Community Notes</div>
            <div class="socio-notes-grid">
                ${filtered.map(n => `
                    <div class="socio-note-card" data-note="${n.id}">
                        <div class="socio-note-icon">${topicIcons[n.topic] || '📄'}</div>
                        <div class="socio-note-title">${n.title}</div>
                        <div class="socio-note-author">by ${escapeHtml(n.author_name || 'Anonymous')}${String(n.user_id).startsWith('demo') ? ' · Demo' : ''}</div>
                        <div class="socio-note-likes">${n.likes || 0} likes</div>
                    </div>
                `).join('')}
            </div>
            ${socioProfile ? `
                <button class="socio-setup-btn" style="margin-top:20px;" id="socio-share-note-btn">Share your notes</button>
            ` : ''}
        `;

        // Wire share note button
        const shareBtn = document.getElementById('socio-share-note-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => showShareNoteModal());
        }
    }

    function showShareNoteModal() {
        const existing = document.getElementById('socio-share-note-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'socio-share-note-modal';
        modal.className = 'socio-profile-modal';
        modal.innerHTML = `
            <div class="socio-profile-card" style="text-align:left;">
                <h3 style="color:#172b4d;margin:0 0 16px;font-size:1.1rem;">Share a note</h3>
                <div class="socio-form-group">
                    <label>Title</label>
                    <input type="text" id="share-note-title" placeholder="e.g. Time & Work Shortcuts" maxlength="60">
                </div>
                <div class="socio-form-group">
                    <label>Topic</label>
                    <select id="share-note-topic">
                        <option value="Aptitude">Aptitude</option>
                        <option value="Reasoning">Reasoning</option>
                        <option value="Maths">Maths</option>
                        <option value="Verbal">Verbal</option>
                        <option value="Coding">Coding</option>
                        <option value="General">General</option>
                    </select>
                </div>
                <div class="socio-form-group">
                    <label>Content</label>
                    <textarea id="share-note-content" placeholder="Write your notes, tips, or shortcuts..." rows="4" maxlength="500"></textarea>
                </div>
                <div class="socio-profile-actions">
                    <button class="socio-action-secondary" id="share-note-cancel">Cancel</button>
                    <button class="socio-action-primary" id="share-note-save">Share Note</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('share-note-cancel').addEventListener('click', () => modal.remove());
        document.getElementById('share-note-save').addEventListener('click', async () => {
            const title = document.getElementById('share-note-title').value.trim();
            const topic = document.getElementById('share-note-topic').value;
            const content = document.getElementById('share-note-content').value.trim();

            if (!title || !content) { AppUI.notify('Please fill in title and content'); return; }

            const newNote = {
                id: 'n_' + Date.now().toString(36),
                title, topic, content, likes: 1,
                user_id: socioProfile ? socioProfile.user_id : 'me',
                author_name: socioProfile ? socioProfile.display_name : 'Student'
            };
            try {
                const current = JSON.parse(localStorage.getItem('laqutum_socio_shared_notes') || '[]');
                current.unshift(newNote);
                localStorage.setItem('laqutum_socio_shared_notes', JSON.stringify(current));
            } catch (e) {}

            if (window.supabaseClient && socioProfile) {
                try {
                    await window.supabaseClient.from('socio_notes').insert({
                        user_id: socioProfile.user_id,
                        title, topic, content, likes: 0,
                        author_name: socioProfile.display_name
                    });
                } catch (e) {
                    console.warn('Note share failed:', e);
                }
            }
            await awardXP(15, 'note_shared');

            modal.remove();
            renderTabContent();
        });
    }

    // ─── TAB: EARN ───────────────────────────────
    function renderEarn(el) {
        const xp = socioProfile ? (socioProfile.xp_earned || 0) : 0;
        const level = Math.floor(xp / 100) + 1;
        const xpInLevel = xp % 100;

        const challenges = [
            { title: '🤝 Make 3 Study Partners', desc: 'Connect with 3 students', xp: 50, progress: Math.min(connections.filter(c => c.status === 'accepted').length, 3), total: 3 },
            { title: '💬 Send 10 Messages', desc: 'Chat with your study partners', xp: 30, progress: Math.min(Math.floor(xp / 6), 10), total: 10 },
            { title: '📝 Share 2 Notes', desc: 'Help the community with your knowledge', xp: 40, progress: Math.min(Math.floor(xp / 30), 2), total: 2 },
            { title: '🔍 Complete Your Profile', desc: 'Fill out all profile fields', xp: 20, progress: socioProfile ? 1 : 0, total: 1 },
        ];

        el.innerHTML = `
            <div style="text-align:center;margin-bottom:24px;">
                
                <div style="font-size:1.8rem;font-weight:800;color:#866128;">Level ${level}</div>
                <div style="font-size:14px;color:#526179;margin-bottom:12px;">${xp} total XP earned</div>
                <div class="socio-earn-progress" style="max-width:200px;margin:0 auto;">
                    <div class="socio-earn-progress-fill" style="width:${xpInLevel}%;"></div>
                </div>
                <div style="font-size:14px;color:#526179;margin-top:6px;">${xpInLevel}/100 XP to Level ${level + 1}</div>
            </div>

            <div class="socio-section-title"><span class="socio-section-icon">🎯</span> Challenges</div>
            ${challenges.map(c => `
                <div class="socio-earn-card">
                    <h4>${c.title}</h4>
                    <p>${c.desc}</p>
                    <div class="socio-earn-progress">
                        <div class="socio-earn-progress-fill" style="width:${(c.progress / c.total) * 100}%;"></div>
                    </div>
                    <div class="socio-earn-xp">${c.progress}/${c.total} — Reward: +${c.xp} XP</div>
                </div>
            `).join('')}
        `;
    }

    // ─── PROFILE MODAL ───────────────────────────
    function showProfileModal(profile) {
        const existing = document.getElementById('socio-profile-modal-el');
        if (existing) existing.remove();

        const connectionStatus = getConnectionStatus(profile.user_id);
        const isPartner = connectionStatus === 'accepted';

        const modal = document.createElement('div');
        modal.id = 'socio-profile-modal-el';
        modal.className = 'socio-profile-modal';
        modal.innerHTML = `
            <div class="socio-profile-card" style="position:relative;">
                <button class="socio-profile-close" id="socio-close-profile" aria-label="Close profile">×</button>
                <div class="socio-profile-avatar">${profile.avatar_emoji || '🧑‍🎓'}</div>
                <div class="socio-profile-name">${escapeHtml(profile.display_name || 'Student')}${profile.user_id.startsWith('demo') ? ' · Demo' : ''}</div>
                <div class="socio-profile-college">${profile.college || ''} • ${profile.year || ''}</div>
                <div style="font-size:14px;color:#526179;margin-bottom:16px;">${profile.bio || ''}</div>
                <div class="socio-profile-stats">
                    <div class="socio-stat-item">
                        <div class="socio-stat-value">${profile.xp_earned || 0}</div>
                        <div class="socio-stat-label">XP Earned</div>
                    </div>
                    <div class="socio-stat-item">
                        <div class="socio-stat-value">${(profile.interests || []).length}</div>
                        <div class="socio-stat-label">Interests</div>
                    </div>
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-bottom:16px;">
                    ${(profile.interests || []).map(i => `<span class="socio-user-badge socio-badge-college">${i}</span>`).join('')}
                </div>
                <div class="socio-profile-actions">
                    ${isPartner
                        ? `<button class="socio-action-primary" id="socio-modal-chat">Chat</button>`
                        : connectionStatus === 'pending'
                            ? `<button class="socio-action-secondary" disabled>⏳ Request Pending</button>`
                            : `<button class="socio-action-primary" id="socio-modal-connect">🤝 Connect</button>`
                    }
                    <button class="socio-action-secondary" id="socio-modal-close">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Wire close
        const closeModal = () => modal.remove();
        document.getElementById('socio-close-profile').addEventListener('click', closeModal);
        document.getElementById('socio-modal-close').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        // Wire connect
        const connectBtn = document.getElementById('socio-modal-connect');
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                connectBtn.textContent = '⏳ Sending...';
                connectBtn.disabled = true;
                await sendConnectionRequest(profile.user_id);
                connectBtn.textContent = '✓ Request Sent!';
            });
        }

        // Wire chat
        const chatBtn = document.getElementById('socio-modal-chat');
        if (chatBtn) {
            chatBtn.addEventListener('click', () => {
                closeModal();
                openChat(profile);
            });
        }
    }

    // ─── CHAT ────────────────────────────────────
    function openChat(partner) {
        chatPartner = partner;
        const existing = document.getElementById('socio-chat-el');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'socio-chat-el';
        overlay.className = 'socio-chat-overlay';
        overlay.innerHTML = `
            <div class="socio-chat-header">
                <button class="socio-chat-back" id="socio-chat-close" aria-label="Close conversation">Close</button>
                <div class="socio-chat-partner-info">
                    <div class="socio-chat-partner-name">${partner.avatar_emoji || '🧑‍🎓'} ${escapeHtml(partner.display_name || 'Student')}${String(partner.user_id).startsWith('demo') ? ' · Demo' : ''}</div>
                    <div class="socio-chat-partner-status">${String(partner.user_id).startsWith('demo') ? 'Automated demo conversation' : (partner.online ? '● Online' : '○ Offline')}</div>
                </div>
            </div>
            <div class="socio-chat-messages" id="socio-chat-msgs"></div>
            <div class="socio-chat-input-bar">
                <input type="text" class="socio-chat-input" id="socio-chat-input" aria-label="Message" placeholder="Type a message...">
                <button class="socio-chat-send" id="socio-chat-send" aria-label="Send message">Send</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Load messages
        refreshChat();

        // Poll for new messages every 5s
        chatPollInterval = setInterval(refreshChat, 5000);

        // Wire close
        document.getElementById('socio-chat-close').addEventListener('click', () => closeChat());

        // Wire send
        document.getElementById('socio-chat-send').addEventListener('click', () => handleChatSend());
        document.getElementById('socio-chat-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSend();
            }
        });
    }

    function closeChat() {
        if (chatPollInterval) { clearInterval(chatPollInterval); chatPollInterval = null; }
        const el = document.getElementById('socio-chat-el');
        if (el) el.remove();
        chatPartner = null;
        chatMessages = [];
    }

    async function refreshChat() {
        if (!chatPartner) return;
        chatMessages = await loadChatMessages(chatPartner.user_id);
        renderChatMessages();
    }

    function renderChatMessages() {
        const msgContainer = document.getElementById('socio-chat-msgs');
        if (!msgContainer) return;

        const myId = socioProfile ? socioProfile.user_id : '';

        if (chatMessages.length === 0) {
            msgContainer.innerHTML = `
                <div style="text-align:center;padding:40px 20px;color:#526179;">
                    
                    <div>Say hi to ${chatPartner ? chatPartner.display_name : 'your partner'}!</div>
                </div>
            `;
            return;
        }

        msgContainer.innerHTML = chatMessages.map(m => {
            const isSent = m.from_user === myId;
            const time = m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return `
                <div class="socio-msg ${isSent ? 'sent' : 'received'}">
                    ${escapeHtml(m.message)}
                    <div class="socio-msg-time">${time}</div>
                </div>
            `;
        }).join('');

        // Scroll to bottom
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }

    async function handleChatSend() {
        const input = document.getElementById('socio-chat-input');
        if (!input || !chatPartner) return;
        const msg = input.value.trim();
        if (!msg) return;

        input.value = '';

        // Optimistic add
        chatMessages.push({
            from_user: socioProfile ? socioProfile.user_id : 'me',
            to_user: chatPartner.user_id,
            message: msg,
            created_at: new Date().toISOString()
        });
        renderChatMessages();

        await sendChatMessage(chatPartner.user_id, msg);
    }

    // ─── HELPERS ─────────────────────────────────
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ─── PUBLIC API ──────────────────────────────
    return {
        open,
        openChat,
        closeChat
    };
})();

if (typeof window !== 'undefined') {
    window.SocioManager = SocioManager;
}

