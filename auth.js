/**
 * auth.js — User Authentication & Progress Management System for LaquTum
 * Powered by Supabase
 */

const AuthManager = (function () {


    // ─── AUTH METHODS ───────────────────────────────────────────

    async function signUp(name, email, password, aptitudeLevel) {
        const cleanEmail = (email || '').toLowerCase().trim();
        const cleanName = (name || '').trim();

        if (!cleanName || !cleanEmail || !password) {
            throw new Error('Please fill in all fields.');
        }

        const { data, error } = await supabaseClient.auth.signUp({
            email: cleanEmail,
            password: password,
            options: {
                data: { full_name: cleanName }
            }
        });

        if (error) throw new Error(error.message);

        // If email confirmation is required, session will be null
        if (!data.session && data.user) {
            throw new Error("Account created! Please check your email to confirm your account before logging in.");
        }

        // Try to create the progress row. 
        // If it fails (e.g. user already exists but isn't confirmed), that's fine.
        if (data.user) {
            const { error: dbError } = await supabaseClient.from('user_progress').insert({
                user_id: data.user.id,
                has_completed_diagnostic: false,
                xp: 0,
                streak: 1,
                hearts: 5,
                confidence_states: {},
                topic_progress: {}
            });
            if (dbError && dbError.code !== '23505') { // Ignore unique violation
                console.error('Failed to create user progress:', dbError);
            }
        }

        await updateNavbarUI();
        return await getCurrentUser();
    }

    async function signIn(email, password) {
        const cleanEmail = (email || '').toLowerCase().trim();

        if (!cleanEmail || !password) {
            throw new Error('Please enter both email and password.');
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: cleanEmail,
            password: password
        });

        if (error) throw new Error(error.message);

        await updateNavbarUI();
        return await getCurrentUser();
    }

    async function logOut() {
        await supabaseClient.auth.signOut();
        await updateNavbarUI();
        
        // If preview overlay is active, reload
        if (typeof PreviewApp !== 'undefined' && PreviewApp.close) {
            PreviewApp.close();
        }
        window.location.reload();
    }

    // ─── USER PROGRESS METHODS ──────────────────────────────────

    let _currentUserCache = null;

    async function getCurrentUser() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) {
            _currentUserCache = null;
            return null;
        }

        const { data: progress } = await supabaseClient
            .from('user_progress')
            .select('*')
            .eq('user_id', user.id)
            .single();

        if (progress) {
            // Map db columns to JS camelCase
            _currentUserCache = {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || 'Aptitude Student',
                hasCompletedDiagnostic: progress.has_completed_diagnostic,
                surveyKnowledge: progress.survey_knowledge,
                surveyTarget: progress.survey_target,
                quizResults: progress.quiz_results,
                xp: progress.xp,
                streak: progress.streak,
                hearts: progress.hearts,
                confidenceStates: progress.confidence_states || {},
                topicProgress: progress.topic_progress || {},
                isBanned: progress.is_banned || false,
                isAdmin: progress.is_admin || false,
                unlockedTopics: progress.unlocked_topics || []
            };
        } else {
            // Fallback if progress row is missing
            _currentUserCache = {
                id: user.id,
                email: user.email,
                name: user.user_metadata?.full_name || 'Aptitude Student',
                hasCompletedDiagnostic: false,
                confidenceStates: {},
                topicProgress: {},
                isBanned: false,
                isAdmin: false,
                unlockedTopics: []
            };
        }

        return _currentUserCache;
    }

    function getCurrentUserSync() {
        return _currentUserCache;
    }

    async function updateCurrentUser(updates) {
        const user = await getCurrentUser();
        if (!user) return null;

        // Map JS camelCase to db snake_case
        const dbUpdates = {};
        if (updates.hasCompletedDiagnostic !== undefined) dbUpdates.has_completed_diagnostic = updates.hasCompletedDiagnostic;
        if (updates.surveyKnowledge !== undefined) dbUpdates.survey_knowledge = updates.surveyKnowledge;
        if (updates.surveyTarget !== undefined) dbUpdates.survey_target = updates.surveyTarget;
        if (updates.quizResults !== undefined) dbUpdates.quiz_results = updates.quizResults;
        if (updates.xp !== undefined) dbUpdates.xp = updates.xp;
        if (updates.streak !== undefined) dbUpdates.streak = updates.streak;
        if (updates.hearts !== undefined) dbUpdates.hearts = updates.hearts;
        if (updates.confidenceStates !== undefined) dbUpdates.confidence_states = updates.confidenceStates;
        if (updates.topicProgress !== undefined) dbUpdates.topic_progress = updates.topicProgress;
        if (updates.unlockedTopics !== undefined) dbUpdates.unlocked_topics = updates.unlockedTopics;

        if (Object.keys(dbUpdates).length === 0) return user;

        dbUpdates.user_id = user.id;

        const { data, error } = await supabaseClient
            .from('user_progress')
            .upsert(dbUpdates, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) {
            console.error('Failed to save progress to Supabase:', error);
            return user;
        }

        await getCurrentUser(); // refresh cache
        await updateNavbarUI();
        return _currentUserCache;
    }

    // ─── UI METHODS ─────────────────────────────────────────────

    async function updateNavbarUI() {
        const currentUser = await getCurrentUser();
        const navAuthContainer = document.getElementById('navAuthContainer');
        const mobileAuthContainer = document.getElementById('mobileAuthContainer');

        if (!navAuthContainer) return;

        if (currentUser) {
            const statusBadge = currentUser.hasCompletedDiagnostic ? '✓ Diagnostic Done' : '⚡ Diagnostic Pending';
            const userHTML = `
                <div class="user-menu-wrap">
                    <button class="user-profile-badge" id="userProfileBtn" title="View Account">
                        <span class="user-avatar-icon">👤</span>
                        <span class="user-name-text">${escapeHTML(currentUser.name)}</span>
                    </button>
                    <div class="user-dropdown hidden" id="userDropdown">
                        <div class="user-dropdown-header">
                            <div class="user-dropdown-name">${escapeHTML(currentUser.name)}</div>
                            <div class="user-dropdown-email">${escapeHTML(currentUser.email)}</div>
                            <div class="user-dropdown-status">${statusBadge}</div>
                        </div>
                        <div class="user-dropdown-stats">
                            <div>⚡ <strong>${currentUser.xp || 0}</strong> XP</div>
                            <div>🔥 <strong>${currentUser.streak || 1}</strong> Streak</div>
                        </div>
                        <button class="user-dropdown-item logout-btn" id="userLogoutBtn">🚪 Log Out</button>
                    </div>
                </div>
            `;
            navAuthContainer.innerHTML = userHTML;
            if (mobileAuthContainer) mobileAuthContainer.innerHTML = userHTML;

            // Wire dropdown events
            const profileBtn = document.getElementById('userProfileBtn');
            const dropdown = document.getElementById('userDropdown');
            const logoutBtn = document.getElementById('userLogoutBtn');

            if (profileBtn && dropdown) {
                profileBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.classList.toggle('hidden');
                });

                document.addEventListener('click', (e) => {
                    if (!dropdown.contains(e.target) && !profileBtn.contains(e.target)) {
                        dropdown.classList.add('hidden');
                    }
                });
            }

            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => {
                    logOut();
                });
            }
        } else {
            navAuthContainer.innerHTML = '';
            if (mobileAuthContainer) mobileAuthContainer.innerHTML = '';
        }
    }

    function escapeHTML(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── AUTH MODAL ─────────────────────────────────────────────

    let pendingCallback = null;

    function initCustomAptitudeSelect() {
        const wrap = document.getElementById('customAptitudeSelect');
        const trigger = document.getElementById('customSelectTrigger');
        const label = document.getElementById('customSelectLabel');
        const hiddenSelect = document.getElementById('signupAptitudeLevel');
        if (!wrap || !trigger || !label || !hiddenSelect) return;

        const options = wrap.querySelectorAll('.custom-select-option');

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const isOpen = wrap.classList.toggle('open');
            trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        options.forEach(opt => {
            opt.addEventListener('click', () => {
                const val = opt.getAttribute('data-value');
                const titleEl = opt.querySelector('.option-title');
                const title = titleEl ? titleEl.textContent.trim() : opt.textContent.trim();

                options.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');

                label.textContent = title;
                label.classList.add('has-value');

                hiddenSelect.value = val;
                hiddenSelect.dispatchEvent(new Event('change', { bubbles: true }));

                wrap.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            });
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) {
                wrap.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && wrap.classList.contains('open')) {
                wrap.classList.remove('open');
                trigger.setAttribute('aria-expanded', 'false');
                trigger.focus();
            }
        });
    }

    function openAuthModal(onSuccessCallback) {
        pendingCallback = onSuccessCallback || null;
        const overlay = document.getElementById('authModalOverlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            overlay.classList.add('active');
        }
        const wrap = document.getElementById('customAptitudeSelect');
        if (wrap) wrap.classList.remove('open');
    }

    function closeAuthModal() {
        const overlay = document.getElementById('authModalOverlay');
        if (overlay) {
            overlay.classList.remove('active');
            overlay.classList.add('hidden');
        }
        const wrap = document.getElementById('customAptitudeSelect');
        if (wrap) wrap.classList.remove('open');
    }

    async function init() {
        // Fetch current session on load
        await getCurrentUser();
        await updateNavbarUI();
        initCustomAptitudeSelect();

        const closeBtn = document.getElementById('authModalClose');
        if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);

        const switchToSignup = document.getElementById('switchToSignup');
        const switchToSignin = document.getElementById('switchToSignin');
        const formSignup = document.getElementById('formSignup');
        const formSignin = document.getElementById('formSignin');
        const signupError = document.getElementById('signupError');
        const signinError = document.getElementById('signinError');

        if (switchToSignup && switchToSignin && formSignup && formSignin) {
            switchToSignup.addEventListener('click', (e) => {
                e.preventDefault();
                formSignup.classList.remove('hidden');
                formSignin.classList.add('hidden');
            });

            switchToSignin.addEventListener('click', (e) => {
                e.preventDefault();
                formSignin.classList.remove('hidden');
                formSignup.classList.add('hidden');
            });
        }

        if (formSignup) {
            formSignup.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (signupError) signupError.classList.add('hidden');
                const name = document.getElementById('signupName').value;
                const email = document.getElementById('signupEmail').value;
                const password = document.getElementById('signupPassword').value;

                try {
                    const aptLevel = document.getElementById('signupAptitudeLevel') ? document.getElementById('signupAptitudeLevel').value : '';
                    const user = await signUp(name, email, password, aptLevel);
                    alert('Debug Success: Account created!');
                    closeAuthModal();
                    if (pendingCallback) {
                        const cb = pendingCallback;
                        pendingCallback = null;
                        cb(user);
                    }
                } catch (err) {
                    alert('Debug Error: ' + err.message);
                    if (signupError) {
                        signupError.textContent = err.message;
                        signupError.classList.remove('hidden');
                    }
                }
            });
        }

        if (formSignin) {
            formSignin.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (signinError) signinError.classList.add('hidden');
                const email = document.getElementById('signinEmail').value;
                const password = document.getElementById('signinPassword').value;

                try {
                    const user = await signIn(email, password);
                    alert('Debug Success: Logged in!');
                    closeAuthModal();
                    if (pendingCallback) {
                        const cb = pendingCallback;
                        pendingCallback = null;
                        cb(user);
                    }
                } catch (err) {
                    alert('Debug Error: ' + err.message);
                    if (signinError) {
                        signinError.textContent = err.message;
                        signinError.classList.remove('hidden');
                    }
                                }
            });
        }
        
        // Auto-start App
        if (typeof PreviewApp !== 'undefined') {
            PreviewApp.open();
        }
    }

    return {
        init,
        getCurrentUser,
        getCurrentUserSync,
        updateCurrentUser,
        signUp,
        signIn,
        logOut,
        openAuthModal,
        closeAuthModal,
        updateNavbarUI
    };
})();

function initAuth() {
    if (typeof supabaseClient !== 'undefined') {
        AuthManager.init();
    } else {
        console.warn('Supabase client not loaded.');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
} else {
    initAuth();
}
