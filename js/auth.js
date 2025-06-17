// js/auth.js - Sistema di autenticazione per R&S Credit Manager

const Auth = {
    currentUser: null,
    isInitialized: false,
    redirectUrl: null,

    // Inizializzazione del modulo auth
    async init() {
        console.log('Inizializzazione sistema autenticazione...');
        
        // Listener per cambio stato autenticazione
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state change:', event);
            
            if (event === 'SIGNED_IN') {
                await this.handleSignIn(session);
            } else if (event === 'SIGNED_OUT') {
                this.handleSignOut();
            }
        });

        // Controlla sessione esistente
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
            console.error('Errore verifica sessione:', error);
            this.showAuthScreen();
            return false;
        }

        if (session) {
            await this.handleSignIn(session);
            return true;
        } else {
            this.showAuthScreen();
            return false;
        }
    },

    // Gestione sign in
    async handleSignIn(session) {
        this.currentUser = session.user;
        
        // Verifica/crea profilo utente
        const profile = await this.ensureUserProfile();
        
        if (profile) {
            this.hideAuthScreen();
            
            showNotification('Accesso effettuato con successo', 'success');
        }
    },

    // Gestione sign out
    handleSignOut() {
        this.currentUser = null;
        this.showAuthScreen();
        
        // Pulisci dati locali
        this.clearLocalData();
        
        showNotification('Disconnessione effettuata', 'info');
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
                    company_name: '',
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
        try {
            showLoading(true);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    throw new Error('Email o password non validi');
                }
                throw error;
            }

            return { success: true };

        } catch (error) {
            console.error('Errore login:', error);
            showNotification(error.message || 'Errore durante il login', 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    },

    // Registrazione nuovo utente
    async signUp(email, password, fullName, companyName) {
        try {
            showLoading(true);

            if (!this.validateEmail(email)) {
                throw new Error('Email non valida');
            }

            if (password.length < 6) {
                throw new Error('La password deve essere di almeno 6 caratteri');
            }

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

            if (error) {
                if (error.message.includes('User already registered')) {
                    throw new Error('Email già registrata');
                }
                throw error;
            }

            showNotification('Registrazione completata! Controlla la tua email per confermare la registrazione', 'success');
            this.toggleAuthForm('login');
            
            return { success: true, emailConfirmationRequired: true };

        } catch (error) {
            console.error('Errore registrazione:', error);
            showNotification(error.message || 'Errore durante la registrazione', 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    },

    // Logout
    async signOut() {
        try {
            showLoading(true);
            
            const { error } = await supabase.auth.signOut();
            
            if (error) throw error;
            
            return { success: true };

        } catch (error) {
            console.error('Errore logout:', error);
            showNotification('Errore durante il logout', 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    },

    // Reset password
    async resetPassword(email) {
        try {
            showLoading(true);

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/#reset-password`
            });

            if (error) throw error;

            showNotification('Email di reset password inviata', 'success');
            return { success: true };

        } catch (error) {
            console.error('Errore reset password:', error);
            showNotification('Errore invio email reset password', 'error');
            return { success: false, error: error.message };
        } finally {
            showLoading(false);
        }
    },

    // Mostra schermata di autenticazione
    showAuthScreen() {
        const authScreen = document.getElementById('authScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (authScreen) authScreen.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
        
        // Inizializza form handlers
        this.initAuthForms();
    },

    // Nascondi schermata di autenticazione
    hideAuthScreen() {
        const authScreen = document.getElementById('authScreen');
        const mainApp = document.getElementById('mainApp');
        
        if (authScreen) authScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
    },

    // Inizializza i form di autenticazione
    initAuthForms() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm && !loginForm.hasListener) {
            loginForm.hasListener = true;
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value;
                const password = document.getElementById('loginPassword').value;
                await this.signIn(email, password);
            });
        }

        // Signup form
        const signupForm = document.getElementById('signupForm');
        if (signupForm && !signupForm.hasListener) {
            signupForm.hasListener = true;
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('signupEmail').value;
                const password = document.getElementById('signupPassword').value;
                const fullName = document.getElementById('signupName').value;
                const companyName = document.getElementById('signupCompany').value;
                await this.signUp(email, password, fullName, companyName);
            });
        }

        // Toggle forms
        const showSignup = document.getElementById('showSignup');
        const showLogin = document.getElementById('showLogin');

        if (showSignup) {
            showSignup.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthForm('signup');
            });
        }

        if (showLogin) {
            showLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleAuthForm('login');
            });
        }
    },

    // Toggle tra i form di autenticazione
    toggleAuthForm(formType) {
        const forms = {
            login: document.querySelector('.login-form'),
            signup: document.querySelector('.signup-form'),
            reset: document.querySelector('.reset-form')
        };

        Object.entries(forms).forEach(([type, form]) => {
            if (form) {
                form.style.display = type === formType ? 'block' : 'none';
            }
        });
    },

    // Validazione email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Pulisci dati locali
    clearLocalData() {
        const keysToKeep = ['gemini_api_key', 'ai_disabled', 'theme'];
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

    // Verifica se l'utente è autenticato
    isAuthenticated() {
        return this.currentUser !== null;
    },

    // Ottieni utente corrente
    getUser() {
        return this.currentUser;
    },

    // Ottieni profilo utente
    getProfile() {
        return this.currentUser?.profile || null;
    },

    // Richiedi autenticazione per accedere a una risorsa
    requireAuth(redirectTo = null) {
        if (!this.isAuthenticated()) {
            this.redirectUrl = redirectTo || window.location.hash;
            this.showAuthScreen();
            return false;
        }
        return true;
    }
};

// Export
window.Auth = Auth;
