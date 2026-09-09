/**
 * Green House Hostel - Unified Client Authentication & User Portal System
 * Provides global modal authentication, role-based redirection,
 * navbar user badges, and resident auto-fill across all pages.
 * Features interactive embossed UI, show/hide password toggles,
 * animated focus lines, and floating warning tooltips.
 */

(function () {
    const AUTH_TOKEN_KEY = 'ghh_auth_token';
    const AUTH_USER_KEY = 'ghh_auth_user';
    const USERS_STORAGE_KEY = 'ghh_registered_users_v2';
    const ADMIN_EMAIL = 'greenhouse5014@gmail.com';
    const ADMIN_INITIAL_PASS = '957995xvi16';
    const SALT = 'GHH_SECURE_SALT_v2_2026';
    const ADMIN_PASS_HASH = '19f10bfeea8e23f5260c860c5eb0824df0869bff7c17e55c35cdd62b0a8653ef';

    async function computePasswordHash(email, pass) {
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPass = String(pass || '');
        const raw = `${SALT}:${cleanEmail}:${cleanPass}`;
        if (window.crypto && window.crypto.subtle) {
            try {
                const buffer = new TextEncoder().encode(raw);
                const digest = await window.crypto.subtle.digest('SHA-256', buffer);
                return Array.from(new Uint8Array(digest))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
            } catch (e) {}
        }
        return raw;
    }

    function getStoredUsers() {
        let users = [];
        try {
            const raw = localStorage.getItem(USERS_STORAGE_KEY);
            if (raw) users = JSON.parse(raw);
        } catch (e) {}

        if (!Array.isArray(users) || users.length === 0) {
            users = [
                {
                    id: 'usr_admin_1',
                    name: 'Green House Administrator',
                    email: ADMIN_EMAIL,
                    phone: '+880 1703-585853',
                    passwordHash: ADMIN_PASS_HASH,
                    role: 'admin',
                    createdAt: '2026-08-16 20:35:39',
                    lastLoginAt: new Date().toISOString()
                },
                {
                    id: 'usr_449960',
                    name: 'Tanvir Hasan',
                    email: 'tanvir.student@gmail.com',
                    phone: '+880 1711-223344',
                    passwordHash: '8b044971056aaf17594c1464772bccfa122210f94e88137a35bcd4f731d6f5f4',
                    role: 'member',
                    createdAt: '2026-08-16 20:37:22',
                    lastLoginAt: '2026-08-16 20:37:22'
                }
            ];
            saveStoredUsers(users);
        } else {
            // Always ensure Admin user is present and has the updated password hash
            const idx = users.findIndex(u => (u.email || '').toLowerCase() === ADMIN_EMAIL);
            if (idx >= 0) {
                if (users[idx].passwordHash !== ADMIN_PASS_HASH) {
                    users[idx].passwordHash = ADMIN_PASS_HASH;
                    saveStoredUsers(users);
                }
            } else {
                users.unshift({
                    id: 'usr_admin_1',
                    name: 'Green House Administrator',
                    email: ADMIN_EMAIL,
                    phone: '+880 1703-585853',
                    passwordHash: ADMIN_PASS_HASH,
                    role: 'admin',
                    createdAt: '2026-08-16 20:35:39',
                    lastLoginAt: new Date().toISOString()
                });
                saveStoredUsers(users);
            }
        }
        return users;
    }

    function saveStoredUsers(users) {
        try {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        } catch (e) {}
    }

    window.GHH_AUTH = {
        getToken() {
            return sessionStorage.getItem(AUTH_TOKEN_KEY) || localStorage.getItem(AUTH_TOKEN_KEY);
        },

        getUser() {
            const raw = sessionStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(AUTH_USER_KEY);
            if (!raw) return null;
            try { return JSON.parse(raw); } catch(e) { return null; }
        },

        isLoggedIn() {
            return !!this.getToken() && !!this.getUser();
        },

        isAdmin() {
            const u = this.getUser();
            return u && (u.role === 'admin' || u.email === ADMIN_EMAIL);
        },

        async clientLogin(email, pass) {
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPass = String(pass || '');
            if (!cleanEmail || !cleanPass) {
                return { success: false, message: 'Please enter both email and password.' };
            }

            const users = getStoredUsers();
            const user = users.find(u => (u.email || '').toLowerCase() === cleanEmail);

            if (!user) {
                return { success: false, message: 'Invalid email or password.' };
            }

            const hash = await computePasswordHash(cleanEmail, cleanPass);
            const isPasswordValid = (user.passwordHash && user.passwordHash === hash) ||
                (cleanEmail === ADMIN_EMAIL && cleanPass === ADMIN_INITIAL_PASS);

            if (!isPasswordValid) {
                return { success: false, message: 'Invalid email or password.' };
            }

            user.lastLoginAt = new Date().toISOString();
            saveStoredUsers(users);

            const token = 'ghh_tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            const safeUser = {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone || '',
                role: user.role || 'member'
            };

            return {
                success: true,
                token: token,
                user: safeUser
            };
        },

        async clientRegister({ name, email, phone, password }) {
            const cleanName = (name || '').trim();
            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPhone = (phone || '').trim();
            const cleanPass = String(password || '');

            if (!cleanName || !cleanEmail || !cleanPass) {
                return { success: false, message: 'Please fill in all required fields.' };
            }

            const users = getStoredUsers();
            if (users.some(u => (u.email || '').toLowerCase() === cleanEmail)) {
                return { success: false, message: 'An account with this email address already exists.' };
            }

            const hash = await computePasswordHash(cleanEmail, cleanPass);
            const newUser = {
                id: 'usr_' + Math.random().toString(36).substring(2, 8),
                name: cleanName,
                email: cleanEmail,
                phone: cleanPhone,
                passwordHash: hash,
                role: cleanEmail === ADMIN_EMAIL ? 'admin' : 'member',
                createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
                lastLoginAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
            };

            users.push(newUser);
            saveStoredUsers(users);

            const token = 'ghh_tok_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            const safeUser = {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                phone: newUser.phone,
                role: newUser.role
            };

            return {
                success: true,
                token: token,
                user: safeUser
            };
        },

        clientGetUsers() {
            const users = getStoredUsers();
            const safeUsers = users.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                phone: u.phone || 'N/A',
                role: u.role || 'member',
                createdAt: u.createdAt || 'Recent',
                lastLoginAt: u.lastLoginAt || 'Recent'
            }));
            return {
                success: true,
                total: safeUsers.length,
                activeSessions: Math.max(1, safeUsers.length),
                users: safeUsers
            };
        },

        setSession(token, user) {
            sessionStorage.setItem(AUTH_TOKEN_KEY, token);
            sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            localStorage.setItem(AUTH_TOKEN_KEY, token);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            this.updateNavbar();
        },

        logout() {
            sessionStorage.removeItem(AUTH_TOKEN_KEY);
            sessionStorage.removeItem(AUTH_USER_KEY);
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
            this.updateNavbar();

            if (window.location.pathname.includes('admin.html')) {
                window.location.href = 'index.html';
            } else {
                window.location.reload();
            }
        },

        playClickSound(type = 'switch') {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                const ctx = new AudioCtx();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                const now = ctx.currentTime;
                if (type === 'cord') {
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(360, now);
                    osc.frequency.exponentialRampToValueAtTime(140, now + 0.07);
                    gain.gain.setValueAtTime(0.22, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.07);
                    osc.start(now);
                    osc.stop(now + 0.07);
                } else if (type === 'toggle') {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(740, now);
                    osc.frequency.exponentialRampToValueAtTime(420, now + 0.04);
                    gain.gain.setValueAtTime(0.15, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
                    osc.start(now);
                    osc.stop(now + 0.04);
                } else {
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(580, now);
                    osc.frequency.exponentialRampToValueAtTime(200, now + 0.05);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                    osc.start(now);
                    osc.stop(now + 0.05);
                }
            } catch(e) {}
        },

        toggleLampModal(initialTab = 'login') {
            const stage = document.getElementById('ghh-lamp-stage');
            if (stage && stage.classList.contains('active')) {
                this.closeModal();
            } else {
                this.openModal(initialTab);
            }
        },

        openModal(initialTab = 'login') {
            const stage = document.getElementById('ghh-lamp-stage');
            const navSwitch = document.getElementById('ghh-lamp-switch');
            if (!stage) return;

            this.clearWarnings();
            this.playClickSound('switch');

            if (navSwitch) {
                navSwitch.classList.add('ghh-lamp-active');
                navSwitch.setAttribute('aria-checked', 'true');
            }

            stage.classList.add('active');
            this.switchTab(initialTab);

            setTimeout(() => {
                if (stage.classList.contains('active')) {
                    stage.classList.add('lamp-lit');
                }
            }, 140);
        },

        closeModal() {
            const stage = document.getElementById('ghh-lamp-stage');
            const navSwitch = document.getElementById('ghh-lamp-switch');
            if (!stage) return;

            this.clearWarnings();
            this.playClickSound('switch');

            if (navSwitch) {
                navSwitch.classList.remove('ghh-lamp-active');
                navSwitch.setAttribute('aria-checked', 'false');
            }

            stage.classList.remove('lamp-lit');
            setTimeout(() => {
                stage.classList.remove('active');
            }, 200);
        },

        pullCordToggle() {
            this.playClickSound('cord');
            const stage = document.getElementById('ghh-lamp-stage');
            if (!stage) return;

            if (stage.classList.contains('lamp-lit')) {
                stage.classList.remove('lamp-lit');
                const navSwitch = document.getElementById('ghh-lamp-switch');
                if (navSwitch) {
                    navSwitch.classList.remove('ghh-lamp-active');
                    navSwitch.setAttribute('aria-checked', 'false');
                }
                setTimeout(() => {
                    stage.classList.remove('active');
                }, 250);
            } else {
                stage.classList.add('lamp-lit');
                const navSwitch = document.getElementById('ghh-lamp-switch');
                if (navSwitch) {
                    navSwitch.classList.add('ghh-lamp-active');
                    navSwitch.setAttribute('aria-checked', 'true');
                }
            }
        },

        switchTab(tab) {
            this.clearWarnings();
            const loginTabBtn = document.getElementById('ghh-tab-login-btn');
            const regTabBtn = document.getElementById('ghh-tab-reg-btn');
            const loginForm = document.getElementById('ghh-login-form-view');
            const regForm = document.getElementById('ghh-reg-form-view');
            const headerTitle = document.getElementById('ghh-auth-header-title');
            const headerSub = document.getElementById('ghh-auth-header-sub');
            const alertEl = document.getElementById('ghh-auth-alert');

            if (alertEl) alertEl.classList.add('hidden');

            if (tab === 'login') {
                if (loginTabBtn) {
                    loginTabBtn.className = 'ghh-spotlight-tab-btn flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gold text-forest shadow-md transition-all';
                }
                if (regTabBtn) {
                    regTabBtn.className = 'ghh-spotlight-tab-btn flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-sand/70 hover:text-sand hover:bg-white/5 transition-all';
                }
                if (headerTitle) headerTitle.textContent = "Welcome";
                if (headerSub) headerSub.textContent = "Login to continue your journey";
                if (loginForm) loginForm.classList.remove('hidden');
                if (regForm) regForm.classList.add('hidden');
            } else {
                if (regTabBtn) {
                    regTabBtn.className = 'ghh-spotlight-tab-btn flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gold text-forest shadow-md transition-all';
                }
                if (loginTabBtn) {
                    loginTabBtn.className = 'ghh-spotlight-tab-btn flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-sand/70 hover:text-sand hover:bg-white/5 transition-all';
                }
                if (headerTitle) headerTitle.textContent = "Create Account";
                if (headerSub) headerSub.textContent = "Start your journey with us";
                if (regForm) regForm.classList.remove('hidden');
                if (loginForm) loginForm.classList.add('hidden');
            }
            if (window.lucide) lucide.createIcons();
        },

        // Password Show/Hide Toggle
        togglePassword(inputId, btn) {
            this.playClickSound('toggle');
            const input = document.getElementById(inputId);
            if (!input) return;

            const isPassword = (input.type === 'password');
            input.type = isPassword ? 'text' : 'password';

            const iconName = isPassword ? 'eye-off' : 'eye';
            btn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 pointer-events-none"></i>`;
            btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
            btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');

            if (window.lucide) lucide.createIcons();
            input.focus();
        },

        // Floating Warning Tooltip (Matching Video Reference)
        showFieldWarning(inputEl, message) {
            this.clearWarnings();
            if (!inputEl) return;

            const fieldWrapper = inputEl.closest('.ghh-embossed-field') || inputEl.parentElement;
            if (!fieldWrapper) return;

            fieldWrapper.classList.add('ghh-field-error');

            const tooltip = document.createElement('div');
            tooltip.className = 'ghh-input-tooltip';
            tooltip.setAttribute('role', 'alert');
            tooltip.innerHTML = `
                <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-600 shrink-0 pointer-events-none"></i>
                <span class="truncate">${message}</span>
            `;

            fieldWrapper.appendChild(tooltip);
            if (window.lucide) lucide.createIcons();

            inputEl.focus();

            // Clear warning immediately upon user typing
            const clearHandler = () => {
                this.clearWarnings();
                inputEl.removeEventListener('input', clearHandler);
            };
            inputEl.addEventListener('input', clearHandler);

            // Auto dismiss after 4.5 seconds
            setTimeout(() => {
                if (tooltip && tooltip.parentElement) {
                    tooltip.remove();
                    fieldWrapper.classList.remove('ghh-field-error');
                }
            }, 4500);
        },

        clearWarnings() {
            document.querySelectorAll('.ghh-input-tooltip').forEach(el => el.remove());
            document.querySelectorAll('.ghh-field-error').forEach(el => el.classList.remove('ghh-field-error'));
        },

        showAlert(msg, isSuccess = false) {
            const alertEl = document.getElementById('ghh-auth-alert');
            const alertText = document.getElementById('ghh-auth-alert-text');
            if (alertEl && alertText) {
                alertText.textContent = msg;
                if (isSuccess) {
                    alertEl.className = 'bg-emerald-950/80 text-emerald-300 text-xs p-3 rounded-xl border border-emerald-500/40 flex items-center gap-2 mb-4';
                } else {
                    alertEl.className = 'bg-rose-950/80 text-rose-200 text-xs p-3 rounded-xl border border-rose-500/40 flex items-center gap-2 mb-4';
                }
                alertEl.classList.remove('hidden');
            }
        },

        updateNavbar() {
            const container = document.getElementById('auth-nav-slot');
            if (!container) return;

            const user = this.getUser();

            if (!user) {
                container.innerHTML = `
                    <button id="ghh-lamp-switch" onclick="window.GHH_AUTH.toggleLampModal('login')" 
                        class="ghh-navbar-switch relative inline-flex items-center gap-2.5 px-3.5 sm:px-4 py-2 min-h-[44px] rounded-full transition-all duration-300 group"
                        aria-label="Sign In Toggle Switch" role="switch" aria-checked="false">
                        <span class="text-xs font-extrabold uppercase tracking-wider text-gold group-hover:text-gold-light transition-colors select-none">
                            Sign In
                        </span>
                        <div class="ghh-switch-track relative w-9 h-5 rounded-full p-0.5 flex items-center transition-all duration-300">
                            <div class="ghh-switch-thumb w-3.5 h-3.5 rounded-full bg-sand/90 flex items-center justify-center shadow-sm">
                                <span class="w-1.5 h-1.5 rounded-full bg-forest/90"></span>
                            </div>
                        </div>
                    </button>
                `;
            } else if (user.role === 'admin' || user.email === ADMIN_EMAIL) {
                container.innerHTML = `
                    <div class="relative inline-flex items-center gap-2">
                        <a href="admin.html" class="bg-gold text-forest font-bold px-3.5 sm:px-4 py-2 min-h-[44px] rounded-full text-xs uppercase tracking-wider hover:bg-white transition-all shadow-md inline-flex items-center gap-1.5">
                            <i data-lucide="shield" class="w-3.5 h-3.5 text-forest"></i> Admin Portal
                        </a>
                        <button onclick="window.GHH_AUTH.logout()" title="Sign Out (${user.email})" class="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/10 text-offwhite hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center" aria-label="Log Out">
                            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                `;
            } else {
                const firstName = user.name ? user.name.split(' ')[0] : 'Member';
                container.innerHTML = `
                    <div class="relative inline-flex items-center gap-2">
                        <span class="bg-forest text-gold border border-gold/30 px-3.5 py-2 min-h-[44px] rounded-full text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 shadow-sm">
                            <i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-400"></i>
                            <span>Hi, ${firstName}</span>
                        </span>
                        <button onclick="window.GHH_AUTH.logout()" title="Sign Out (${user.email})" class="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-white/10 text-offwhite hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center" aria-label="Log Out">
                            <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                `;
            }

            if (window.lucide) lucide.createIcons();
        },

        injectModal() {
            if (document.getElementById('ghh-lamp-stage')) return;

            const modalHtml = `
            <div id="ghh-lamp-stage" role="dialog" aria-modal="true" aria-label="Authentication Lamp Modal">
                
                <!-- 1. Hanging Pendant Lamp Assembly -->
                <div class="ghh-pendant-assembly">
                    <div class="ghh-lamp-cap"></div>
                    <div class="ghh-lamp-wire"></div>
                    <div class="ghh-lamp-fixture">
                        <div class="ghh-lamp-shade"></div>
                        <div class="ghh-lamp-bulb"></div>
                        
                        <!-- Interactive Pull-Cord -->
                        <div class="ghh-lamp-pull-cord" onclick="window.GHH_AUTH.pullCordToggle()" title="Pull cord to toggle light">
                            <div class="ghh-pull-string"></div>
                            <div class="ghh-pull-bead"></div>
                        </div>
                    </div>

                    <!-- Glowing Light Cone -->
                    <div class="ghh-light-cone"></div>
                    <div class="ghh-light-pool"></div>
                </div>

                <!-- 2. Illuminated Spotlight Auth Card (Embossed & Tactile) -->
                <div class="ghh-spotlight-card-wrapper">
                    <div class="ghh-spotlight-card">
                        
                        <!-- Close Button -->
                        <button onclick="window.GHH_AUTH.closeModal()" class="ghh-lamp-close-btn" aria-label="Close Auth Modal" title="Close">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>

                        <!-- Embossed 3D Padlock Emblem & Brand Title (Reference Video Style) -->
                        <div class="flex flex-col items-center text-center mb-6">
                            <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/25 via-forest/80 to-black/60 border border-gold/40 flex items-center justify-center shadow-[0_8px_20px_rgba(0,0,0,0.5)] mb-3">
                                <i data-lucide="lock" class="w-7 h-7 text-gold"></i>
                            </div>
                            <h3 id="ghh-auth-header-title" class="font-serif text-2xl sm:text-3xl font-bold text-gold leading-tight tracking-wide">Welcome</h3>
                            <p id="ghh-auth-header-sub" class="text-xs text-sand/70 mt-1 font-medium">Login to continue your journey</p>
                        </div>

                        <!-- Switcher Tabs -->
                        <div class="flex bg-black/40 p-1.5 rounded-2xl mb-6 border border-gold/25">
                            <button id="ghh-tab-login-btn" onclick="window.GHH_AUTH.switchTab('login')" class="ghh-spotlight-tab-btn flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gold text-forest shadow-md transition-all">
                                Sign In
                            </button>
                            <button id="ghh-tab-reg-btn" onclick="window.GHH_AUTH.switchTab('register')" class="ghh-spotlight-tab-btn flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-sand/70 hover:text-sand hover:bg-white/5 transition-all">
                                Register
                            </button>
                        </div>

                        <!-- Notification / Error Box -->
                        <div id="ghh-auth-alert" class="hidden text-xs p-3 rounded-xl border flex items-center gap-2 mb-4">
                            <i data-lucide="info" class="w-4 h-4 shrink-0"></i>
                            <span id="ghh-auth-alert-text"></span>
                        </div>

                        <!-- 1. Sign In Form (Embossed Neumorphic Inputs) -->
                        <form id="ghh-login-form-view" class="space-y-4" novalidate>
                            <div>
                                <label for="ghh-login-email" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Email Address</label>
                                <div class="ghh-embossed-field">
                                    <input type="email" id="ghh-login-email" placeholder="Email Address" class="ghh-spotlight-input px-4 py-3 min-h-[46px] text-sm">
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>
                            <div>
                                <label for="ghh-login-pass" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Password</label>
                                <div class="ghh-embossed-field">
                                    <input type="password" id="ghh-login-pass" placeholder="Password" class="ghh-spotlight-input pl-4 pr-11 py-3 min-h-[46px] text-sm">
                                    <button type="button" class="ghh-eye-toggle" onclick="window.GHH_AUTH.togglePassword('ghh-login-pass', this)" aria-label="Toggle password visibility">
                                        <i data-lucide="eye" class="w-4 h-4"></i>
                                    </button>
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>

                            <!-- Remember me & Forgot Password -->
                            <div class="flex items-center justify-between text-xs text-sand/70 pt-1">
                                <label class="inline-flex items-center gap-2 cursor-pointer select-none">
                                    <input type="checkbox" id="ghh-login-remember" class="ghh-embossed-checkbox">
                                    <span>Remember me</span>
                                </label>
                                <a href="https://wa.me/8801703585853?text=Hello%20Green%20House%20Hostel%2C%20I%20need%20help%20resetting%20my%20account%20password." target="_blank" rel="noopener noreferrer" class="text-gold hover:underline">
                                    Forgot Password?
                                </a>
                            </div>

                            <button type="submit" id="ghh-login-btn" class="w-full bg-gold text-forest font-bold py-3.5 min-h-[48px] rounded-xl uppercase tracking-wider text-xs hover:bg-white hover:text-forest transition-all shadow-lg mt-3 flex items-center justify-center gap-2">
                                <i data-lucide="log-in" class="w-4 h-4"></i> <span id="ghh-login-btn-label">Login</span>
                            </button>

                            <!-- Tactile Switcher Row: "Don't have an account? (+)" -->
                            <div class="flex items-center justify-center gap-2.5 pt-4 text-xs text-sand/70 border-t border-gold/15 mt-5">
                                <span>Don't have an account?</span>
                                <button type="button" onclick="window.GHH_AUTH.switchTab('register')" class="ghh-round-switcher-btn" aria-label="Switch to Register" title="Create Account">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </form>

                        <!-- 2. Register Form (Embossed Neumorphic Inputs) -->
                        <form id="ghh-reg-form-view" class="space-y-3.5 hidden" novalidate>
                            <div>
                                <label for="ghh-reg-name" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Full Name</label>
                                <div class="ghh-embossed-field">
                                    <input type="text" id="ghh-reg-name" placeholder="Full Name" class="ghh-spotlight-input px-4 py-3 min-h-[46px] text-sm">
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>
                            <div>
                                <label for="ghh-reg-email" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Email Address</label>
                                <div class="ghh-embossed-field">
                                    <input type="email" id="ghh-reg-email" placeholder="Email Address" class="ghh-spotlight-input px-4 py-3 min-h-[46px] text-sm">
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>
                            <div>
                                <label for="ghh-reg-phone" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Phone / WhatsApp Number</label>
                                <div class="ghh-embossed-field">
                                    <input type="tel" id="ghh-reg-phone" placeholder="+880 17XXXXXXXX" class="ghh-spotlight-input px-4 py-3 min-h-[46px] text-sm">
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>
                            <div>
                                <label for="ghh-reg-pass" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Password</label>
                                <div class="ghh-embossed-field">
                                    <input type="password" id="ghh-reg-pass" placeholder="Password (Minimum 6 chars)" class="ghh-spotlight-input pl-4 pr-11 py-3 min-h-[46px] text-sm">
                                    <button type="button" class="ghh-eye-toggle" onclick="window.GHH_AUTH.togglePassword('ghh-reg-pass', this)" aria-label="Toggle password visibility">
                                        <i data-lucide="eye" class="w-4 h-4"></i>
                                    </button>
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>
                            <div>
                                <label for="ghh-reg-confirm-pass" class="block text-xs font-bold uppercase tracking-wider text-sand/80 mb-1.5">Confirm Password</label>
                                <div class="ghh-embossed-field">
                                    <input type="password" id="ghh-reg-confirm-pass" placeholder="Confirm Password" class="ghh-spotlight-input pl-4 pr-11 py-3 min-h-[46px] text-sm">
                                    <button type="button" class="ghh-eye-toggle" onclick="window.GHH_AUTH.togglePassword('ghh-reg-confirm-pass', this)" aria-label="Toggle password visibility">
                                        <i data-lucide="eye" class="w-4 h-4"></i>
                                    </button>
                                    <div class="ghh-focus-line"></div>
                                </div>
                            </div>

                            <button type="submit" id="ghh-reg-btn" class="w-full bg-gold text-forest font-bold py-3.5 min-h-[48px] rounded-xl uppercase tracking-wider text-xs hover:bg-white hover:text-forest transition-all shadow-lg mt-3 flex items-center justify-center gap-2">
                                <i data-lucide="user-plus" class="w-4 h-4"></i> <span id="ghh-reg-btn-label">Create Account</span>
                            </button>

                            <!-- Tactile Switcher Row: "Already have an account? (<-)" -->
                            <div class="flex items-center justify-center gap-2.5 pt-4 text-xs text-sand/70 border-t border-gold/15 mt-5">
                                <span>Already have an account?</span>
                                <button type="button" onclick="window.GHH_AUTH.switchTab('login')" class="ghh-round-switcher-btn" aria-label="Switch to Login" title="Sign In">
                                    <i data-lucide="arrow-left" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </form>

                        <div class="mt-5 text-center">
                            <p class="text-[11px] text-sand/60">
                                💡 Need room booking assistance? Call or WhatsApp our 24/7 helpdesk.
                            </p>
                        </div>

                    </div>
                </div>

            </div>
            `;

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            this.attachModalEvents();
        },

        attachModalEvents() {
            // Close when clicking outside card or pressing Escape
            const stage = document.getElementById('ghh-lamp-stage');
            if (stage) {
                stage.addEventListener('click', (e) => {
                    if (e.target === stage || e.target.classList.contains('ghh-spotlight-card-wrapper')) {
                        this.closeModal();
                    }
                });
            }

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    const s = document.getElementById('ghh-lamp-stage');
                    if (s && s.classList.contains('active')) {
                        this.closeModal();
                    }
                }
            });

            // Login Form Submission with Video-Style Warnings & Animations
            const loginForm = document.getElementById('ghh-login-form-view');
            if (loginForm) {
                loginForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    window.GHH_AUTH.clearWarnings();

                    const emailInput = document.getElementById('ghh-login-email');
                    const passInput = document.getElementById('ghh-login-pass');
                    const email = emailInput.value.trim().toLowerCase();
                    const pass = passInput.value;
                    const btn = document.getElementById('ghh-login-btn');
                    const label = document.getElementById('ghh-login-btn-label');

                    // Interactive Warnings from Reference Video
                    if (!email) {
                        window.GHH_AUTH.showFieldWarning(emailInput, 'Please fill in this field.');
                        return;
                    }
                    if (!email.includes('@')) {
                        window.GHH_AUTH.showFieldWarning(emailInput, `Please include an '@' in the email address.`);
                        return;
                    }
                    if (!pass) {
                        window.GHH_AUTH.showFieldWarning(passInput, 'Please fill in this field.');
                        return;
                    }

                    btn.disabled = true;
                    label.textContent = "Authenticating...";

                    let authResult = null;

                    // 1. Try Live Server API first
                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3500);
                        const resp = await fetch('/api/auth/login', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ email, password: pass }),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);

                        const contentType = resp.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            const data = await resp.json();
                            if (resp.ok && data.success) {
                                authResult = data;
                            } else if (resp.status === 400 || resp.status === 401 || resp.status === 403 || resp.status === 429) {
                                const clientFallback = await window.GHH_AUTH.clientLogin(email, pass);
                                if (clientFallback.success) {
                                    authResult = clientFallback;
                                } else {
                                    window.GHH_AUTH.showAlert(data.message || 'Invalid email or password.');
                                    btn.disabled = false;
                                    label.textContent = "Login";
                                    return;
                                }
                            }
                        }
                    } catch (netErr) {
                        // Network error, 404, or Cloudflare static deployment
                    }

                    // 2. Resilient Client-Side Fallback (for Cloudflare Pages / Static Hosting)
                    if (!authResult) {
                        authResult = await window.GHH_AUTH.clientLogin(email, pass);
                    }

                    if (authResult && authResult.success) {
                        // Trigger Button Success Transition
                        btn.classList.add('ghh-btn-success');
                        label.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> SUCCESS`;
                        if (window.lucide) lucide.createIcons();

                        window.GHH_AUTH.setSession(authResult.token, authResult.user);

                        setTimeout(() => {
                            window.GHH_AUTH.closeModal();
                            if (authResult.user.role === 'admin' || authResult.user.email === ADMIN_EMAIL) {
                                window.location.href = 'admin.html';
                            } else {
                                if (window.location.pathname.includes('admin.html')) {
                                    window.location.href = 'index.html';
                                } else {
                                    window.GHH_AUTH.updateNavbar();
                                    window.location.reload();
                                }
                            }
                        }, 700);
                        return;
                    } else {
                        window.GHH_AUTH.showAlert((authResult && authResult.message) || 'Invalid email or password.');
                        btn.disabled = false;
                        btn.classList.remove('ghh-btn-success');
                        label.textContent = "Login";
                    }
                });
            }

            // Register Form Submission with Video-Style Warnings & Animations
            const regForm = document.getElementById('ghh-reg-form-view');
            if (regForm) {
                regForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    window.GHH_AUTH.clearWarnings();

                    const nameInput = document.getElementById('ghh-reg-name');
                    const emailInput = document.getElementById('ghh-reg-email');
                    const phoneInput = document.getElementById('ghh-reg-phone');
                    const passInput = document.getElementById('ghh-reg-pass');
                    const confirmPassInput = document.getElementById('ghh-reg-confirm-pass');

                    const name = nameInput.value.trim();
                    const email = emailInput.value.trim().toLowerCase();
                    const phone = phoneInput.value.trim();
                    const pass = passInput.value;
                    const confirmPass = confirmPassInput.value;
                    const btn = document.getElementById('ghh-reg-btn');
                    const label = document.getElementById('ghh-reg-btn-label');

                    // Interactive Warnings from Reference Video
                    if (!name) {
                        window.GHH_AUTH.showFieldWarning(nameInput, 'Please fill in this field.');
                        return;
                    }
                    if (!email) {
                        window.GHH_AUTH.showFieldWarning(emailInput, 'Please fill in this field.');
                        return;
                    }
                    if (!email.includes('@')) {
                        window.GHH_AUTH.showFieldWarning(emailInput, `Please include an '@' in the email address.`);
                        return;
                    }
                    if (!pass) {
                        window.GHH_AUTH.showFieldWarning(passInput, 'Please fill in this field.');
                        return;
                    }
                    if (pass.length < 6) {
                        window.GHH_AUTH.showFieldWarning(passInput, 'Password must be at least 6 characters long.');
                        return;
                    }
                    if (!confirmPass) {
                        window.GHH_AUTH.showFieldWarning(confirmPassInput, 'Please confirm your password.');
                        return;
                    }
                    if (pass !== confirmPass) {
                        window.GHH_AUTH.showFieldWarning(confirmPassInput, 'Passwords do not match.');
                        return;
                    }

                    btn.disabled = true;
                    label.textContent = "Creating Account...";

                    let regResult = null;

                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 3500);
                        const resp = await fetch('/api/auth/register', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ name, email, phone, password: pass }),
                            signal: controller.signal
                        });
                        clearTimeout(timeoutId);

                        const contentType = resp.headers.get('content-type') || '';
                        if (contentType.includes('application/json')) {
                            const data = await resp.json();
                            if (resp.ok && data.success) {
                                regResult = data;
                            } else if (resp.status === 400 || resp.status === 409) {
                                window.GHH_AUTH.showAlert(data.message || 'Registration failed.');
                                btn.disabled = false;
                                label.textContent = "Create Account";
                                return;
                            }
                        }
                    } catch (netErr) {}

                    // Resilient fallback for Cloudflare / static hosting
                    if (!regResult) {
                        regResult = await window.GHH_AUTH.clientRegister({ name, email, phone, password: pass });
                    }

                    if (regResult && regResult.success) {
                        // Trigger Button Success Transition
                        btn.classList.add('ghh-btn-success');
                        label.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> SUCCESS`;
                        if (window.lucide) lucide.createIcons();

                        window.GHH_AUTH.setSession(regResult.token, regResult.user);

                        setTimeout(() => {
                            window.GHH_AUTH.closeModal();
                            if (regResult.user.role === 'admin' || regResult.user.email === ADMIN_EMAIL) {
                                window.location.href = 'admin.html';
                            } else {
                                if (window.location.pathname.includes('admin.html')) {
                                    window.location.href = 'index.html';
                                } else {
                                    window.GHH_AUTH.updateNavbar();
                                    window.location.reload();
                                }
                            }
                        }, 700);
                        return;
                    } else {
                        window.GHH_AUTH.showAlert((regResult && regResult.message) || 'Registration failed.');
                        btn.disabled = false;
                        btn.classList.remove('ghh-btn-success');
                        label.textContent = "Create Account";
                    }
                });
            }
        }
    };

    // Auto-initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', () => {
        window.GHH_AUTH.injectModal();
        window.GHH_AUTH.updateNavbar();
    });

})();
