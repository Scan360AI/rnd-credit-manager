// js/auth.js - Sistema di autenticazione per R&S Credit Manager

const Auth = {
    currentUser: null,
    isInitialized: false,
    redirectUrl: null,

    // Inizializzazione del modulo auth
    async init() {
        console.log('🔐 Auth.init() chiamato');
        
        try {
            // Controlla SUBITO se c'è già una sessione
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
                console.error('Errore verifica sessione:', error);
                this.showAuthScreen();
                return false;
            }

            if (session) {
                console.log('✅ Sessione esistente trovata:', session.user.email);
                this.currentUser = session.user;
                
                // Nascondi SUBITO la schermata di login
                this.hideAuthScreen();
                
                // Carica profilo
                await this.ensureUserProfile();
                
                // Inizializza app
                setTimeout(async () => {
                    if (window.App && !window.App.isInitialized) {
                        console.log('🚀 Inizializzazione App...');
                        await window.App.init();
                    }
                }, 100);
                
                // Setup listener per futuri cambiamenti
                this.setupAuthListener();
                
                return true;
            } else {
                console.log('❌ Nessuna sessione attiva');
                this.showAuthScreen();
                this.setupAuthListener();
                return false;
            }
            
        } catch (error) {
            console.error('Errore in Auth.init:', error);
            this.showAuthScreen();
            return false;
        }
    },

    // Setup listener separato per evitare problemi
    setupAuthListener() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event);
            
            if (event === 'SIGNED_IN' && session) {
                this.currentUser = session.user;
                await this.ensureUserProfile();
                this.hideAuthScreen();
                
                if (window.App && !window.App.isInitialized) {
                    setTimeout(() => window.App.init(), 100);
                }
            } else if (event === 'SIGNED_OUT') {
                this.currentUser = null;
                this.showAuthScreen();
                this.clearLocalData();
            }
        });
    },

    // Assicura che esista un profilo utente
    async ensureUserProfile() {
        if (!this.currentUser) return null;

        try {
            let { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error && error.code === 'PGRST116') {
                // Profilo non esiste, crealo
                const newProfile = {
                    id: this.currentUser.id,
                    email: this.currentUser.email,
                    full_name: this.currentUser.user_metadata?.full_name || '',
                    company_name: this.currentUser.user_metadata?.company_name || '',
                    created_at: new Date().toISOString()
                };

                const { data, error: createError } = await supabase
                    .from('profiles')
                    .insert([newProfile])
                    .select()
                    .single();

                if (createError) {
                    console.error('Errore creazione profilo:', createError);
                    return null;
                }

                profile = data;
            }

            this.currentUser.profile = profile;
            return profile;

        } catch (error) {
            console.error('Errore gestione profilo:', error);
            return null;
        }
    },

    // Login con email e password
    async signIn(email, password) {
        console.log('🔑 Tentativo login:', email);
        
        try {
            if (window.showLoading) showLoading(true);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error('Errore login:', error);
                throw error;
            }

            console.log('✅ Login riuscito');
            return { success: true };

        } catch (error) {
            console.error('❌ Errore login:', error);
            if (window.showNotification) {
                showNotification(error.message || 'Errore durante il login', 'error');
            }
            return { success: false, error: error.message };
        } finally {
            if (window.showLoading) showLoading(false);
        }
    },

    // Registrazione nuovo utente  
    async signUp(email, password, fullName, companyName) {
        console.log('📝 Tentativo registrazione:', email);
        
        try {
            if (window.showLoading) showLoading(true);

            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        company_name: companyName
                    }
                }
            });

            if (error) throw error;

            console.log('✅ Registrazione completata');
            if (window.showNotification) {
                showNotification('Registrazione completata! Controlla la tua email.', 'success');
            }
            
            // Torna al form di login
            this.toggleAuthForm('login');
            
            return { success: true };

        } catch (error) {
            console.error('❌ Errore registrazione:', error);
            if (window.showNotification) {
                showNotification(error.message || 'Errore durante la registrazione', 'error');
            }
            return { success: false, error: error.message };
        } finally {
            if (window.showLoading) showLoading(false);
        }
    },

    // Logout
    async signOut() {
        try {
            if (window.showLoading) showLoading(true);
            
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            console.log('✅ Logout completato');
            return { success: true };

        } catch (error) {
            console.error('❌ Errore logout:', error);
            if (window.showNotification) {
                showNotification('Errore durante il logout', 'error');
            }
            return { success: false };
        } finally {
            if (window.showLoading) showLoading(false);
        }
    },

    // Mostra schermata di autenticazione
    showAuthScreen() {
        console.log('📋 Mostrando schermata auth');
        const authScreen = document.getElementById('authScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (authScreen) {
            authScreen.style.display = 'flex';
            authScreen.classList.remove('hidden');
        }
        
        if (mainApp) {
            mainApp.style.display = 'none';
            mainApp.classList.add('hidden');
        }
        
        // Inizializza form handlers
        setTimeout(() => this.initAuthForms(), 100);
    },

    // Nascondi schermata di autenticazione
    hideAuthScreen() {
        console.log('📋 Nascondendo schermata auth');
        const authScreen = document.getElementById('authScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (authScreen) {
            authScreen.style.display = 'none';
            authScreen.classList.add('hidden');
        }
        
        if (mainApp) {
            mainApp.style.display = 'block';
            mainApp.classList.remove('hidden');
        }
        
        // Aggiorna UI
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl && this.currentUser) {
            userEmailEl.textContent = this.currentUser.email;
        }
    },

    // Inizializza i form di autenticazione
    initAuthForms() {
        console.log('📝 Inizializzazione form auth');
        
        // Login form
        const loginForm = document.getElementById('loginFormElement');
        if (loginForm && !loginForm._hasListener) {
            loginForm._hasListener = true;
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                await this.signIn(email, password);
            });
        }

        // Signup form
        const signupForm = document.getElementById('signupFormElement');
        if (signupForm && !signupForm._hasListener) {
            signupForm._hasListener = true;
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('signupEmail').value;
                const password = document.getElementById('signupPassword').value;
                const fullName = document.getElementById('signupName').value;
                const companyName = document.getElementById('signupCompany').value;
                await this.signUp(email, password, fullName, companyName);
            });
        }

        // Toggle links
        const showSignup = document.getElementById('showSignup');
        if (showSignup && !showSignup._hasListener) {
            showSignup._hasListener = true;
            showSignup.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthForm('signup');
            });
        }

        const showLogin = document.getElementById('showLogin');
        if (showLogin && !showLogin._hasListener) {
            showLogin._hasListener = true;
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthForm('login');
            });
        }
    },

    // Toggle tra i form di autenticazione
    toggleAuthForm(formType) {
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        
        if (formType === 'signup') {
            if (loginForm) loginForm.classList.add('hidden');
            if (signupForm) signupForm.classList.remove('hidden');
        } else {
            if (loginForm) loginForm.classList.remove('hidden');
            if (signupForm) signupForm.classList.add('hidden');
        }
    },

    // Pulisci dati locali
    clearLocalData() {
        const keysToKeep = ['gemini_api_key', 'ai_disabled'];
        const savedData = {};
        
        keysToKeep.forEach(key => {
            const value = localStorage.getItem(key);
            if (value) savedData[key] = value;
        });

        localStorage.clear();

        Object.entries(savedData).forEach(([key, value]) => {
            localStorage.setItem(key, value);
        });
    },

    // Helper methods
    isAuthenticated() {
        return this.currentUser !== null;
    },

    getUser() {
        return this.currentUser;
    },

    getProfile() {
        return this.currentUser?.profile || null;
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            this.showAuthScreen();
            return false;
        }
        return true;
    }
};

// Export
window.Auth = Auth;
