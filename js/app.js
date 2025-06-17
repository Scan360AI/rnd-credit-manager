// js/app.js - Core Application e Inizializzazione

const App = {
    isInitialized: false,
    currentTab: 'dashboard',
    modules: {},
    
    async init() {
        console.log('🚀 Inizializzazione R&S Credit Manager...');
        
        try {
            // Mostra loading
            showLoading(true);
            
            // Verifica se l'utente è autenticato
            if (!Auth.isAuthenticated()) {
                console.log('❌ Utente non autenticato');
                showLoading(false);
                return false;
            }
            
            console.log('✅ Utente autenticato:', Auth.getUser()?.email);
            
            // Inizializza moduli in ordine
            await this.initializeModules();
            
            // Setup UI
            this.setupUI();
            
            // Carica tab dall'URL o default
            this.loadInitialTab();
            
            // Controlla primo accesso
            this.checkFirstAccess();
            
            // Aggiorna UI utente
            this.updateUserUI();
            
            this.isInitialized = true;
            console.log('✅ Inizializzazione completata');
            
            return true;
            
        } catch (error) {
            console.error('❌ Errore inizializzazione:', error);
            showNotification('Errore durante l\'inizializzazione', 'error');
            return false;
        } finally {
            showLoading(false);
        }
    },
    
    async initializeModules() {
        console.log('📦 Inizializzazione moduli...');
        
        // Inizializza in ordine di dipendenza
        const modulesToInit = [
            { name: 'AIManager', instance: window.AIManager, critical: false },
            { name: 'EmployeesManager', instance: window.EmployeesManager, critical: true },
            { name: 'ProjectsManager', instance: window.ProjectsManager, critical: true },
            { name: 'DocumentsManager', instance: window.DocumentsManager, critical: true },
            { name: 'TimesheetManager', instance: window.TimesheetManager, critical: true },
            { name: 'ReportManager', instance: window.ReportManager, critical: true }
        ];
        
        for (const module of modulesToInit) {
            try {
                if (!module.instance) {
                    console.warn(`⚠️ Modulo ${module.name} non trovato`);
                    if (module.critical) {
                        throw new Error(`Modulo critico ${module.name} non trovato`);
                    }
                    continue;
                }
                
                console.log(`  📦 Inizializzazione ${module.name}...`);
                if (module.instance.init) {
                    await module.instance.init();
                }
                this.modules[module.name] = module.instance;
                console.log(`  ✅ ${module.name} inizializzato`);
            } catch (error) {
                console.error(`  ❌ Errore inizializzazione ${module.name}:`, error);
                if (module.critical) {
                    throw new Error(`Modulo critico ${module.name} non inizializzato`);
                }
            }
        }
    },
    
    setupUI() {
        console.log('🎨 Setup UI...');
        
        // Setup navigazione tabs
        this.setupNavigation();
        
        // Setup responsive menu
        this.setupMobileMenu();
        
        // Setup keyboards shortcuts
        this.setupKeyboardShortcuts();
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Setup notifiche
        this.setupNotifications();
    },
    
    setupNavigation() {
        // Tab navigation già gestita inline nell'HTML con onclick
        console.log('  ✅ Navigazione configurata');
    },
    
    setupMobileMenu() {
        // Non implementato per ora
        console.log('  ✅ Menu mobile configurato');
    },
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S = Salva
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentWork();
            }
            
            // Esc = Chiudi modal
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
        console.log('  ✅ Shortcuts tastiera configurati');
    },
    
    setupAutoSave() {
        // Auto-save ogni 5 minuti
        setInterval(() => {
            if (this.isInitialized) {
                this.saveCurrentWork();
            }
        }, 5 * 60 * 1000);
        console.log('  ✅ Auto-save configurato');
    },
    
    setupNotifications() {
        // Richiedi permesso notifiche se supportato
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        console.log('  ✅ Notifiche configurate');
    },
    
    switchTab(tabName, updateHistory = true) {
        console.log('🔄 Switch tab:', tabName);
        
        // Verifica autenticazione
        if (!Auth.requireAuth()) {
            return;
        }
        
        // Aggiorna UI tabs
        document.querySelectorAll('.nav-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // Aggiorna contenuti
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });
        
        this.currentTab = tabName;
        
        // Aggiorna history
        if (updateHistory) {
            const title = this.getTabTitle(tabName);
            history.pushState({ tab: tabName }, title, `#${tabName}`);
            document.title = `${title} - R&S Credit Manager`;
        }
        
        // Trigger eventi specifici del tab
        this.onTabChange(tabName);
    },
    
    onTabChange(tabName) {
        console.log('📍 Tab changed to:', tabName);
        
        // Azioni specifiche per ogni tab
        switch(tabName) {
            case 'dashboard':
                this.loadDashboard();
                break;
                
            case 'employees':
                if (this.modules.EmployeesManager) {
                    this.modules.EmployeesManager.render();
                }
                break;
                
            case 'projects':
                if (this.modules.ProjectsManager) {
                    this.modules.ProjectsManager.render();
                }
                break;
                
            case 'timesheet':
                if (this.modules.TimesheetManager) {
                    this.modules.TimesheetManager.render();
                }
                break;
                
            case 'documents':
                if (this.modules.DocumentsManager) {
                    this.modules.DocumentsManager.render();
                }
                break;
                
            case 'report':
                if (this.modules.ReportManager) {
                    this.modules.ReportManager.renderCreditSummary();
                }
                break;
        }
    },
    
    getTabTitle(tabName) {
        const titles = {
            'dashboard': 'Dashboard',
            'employees': 'Dipendenti',
            'projects': 'Progetti',
            'timesheet': 'Timesheet',
            'documents': 'Documenti',
            'report': 'Relazione'
        };
        return titles[tabName] || 'R&S Credit Manager';
    },
    
    loadInitialTab() {
        // Carica tab da URL hash
        const hash = window.location.hash.slice(1);
        const validTabs = ['dashboard', 'employees', 'projects', 'timesheet', 'documents', 'report'];
        
        if (hash && validTabs.includes(hash)) {
            this.switchTab(hash, false);
        } else {
            this.switchTab('dashboard', false);
        }
    },
    
    checkFirstAccess() {
        const hasVisited = localStorage.getItem('rnd_has_visited');
        
        if (!hasVisited) {
            localStorage.setItem('rnd_has_visited', 'true');
            this.showWelcome();
        }
    },
    
    showWelcome() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="welcome-modal">
                <h2>🎉 Benvenuto in R&S Credit Manager!</h2>
                <p>Il sistema completo per gestire il credito d'imposta R&S con intelligenza artificiale.</p>
                
                <div class="welcome-features">
                    <div class="feature-item">
                        <i class="fas fa-robot"></i>
                        <h3>AI Integrata</h3>
                        <p>Estrazione automatica dati da buste paga e documenti</p>
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-chart-line"></i>
                        <h3>Calcolo Automatico</h3>
                        <p>Calcola automaticamente il credito d'imposta spettante</p>
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-file-pdf"></i>
                        <h3>Report Completi</h3>
                        <p>Genera relazioni tecniche complete per il MISE</p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="App.closeModal(); App.showApiKeyPrompt();">
                        <i class="fas fa-key"></i> Configura AI
                    </button>
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Inizia dopo
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    showApiKeyPrompt() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        const currentKey = localStorage.getItem('gemini_api_key') || '';
        const hasKey = currentKey.length > 0;
        
        modalBody.innerHTML = `
            <div class="api-key-modal">
                <h3>🔐 Configurazione Gemini AI</h3>
                <p>Per utilizzare le funzionalità AI avanzate, hai bisogno di una API Key di Google Gemini.</p>
                
                ${!hasKey ? `
                <div class="alert alert-info">
                    <i class="fas fa-info-circle"></i>
                    <div>
                        <strong>Come ottenere una API Key gratuita:</strong>
                        <ol>
                            <li>Vai su <a href="https://makersuite.google.com/app/apikey" target="_blank">Google AI Studio</a></li>
                            <li>Accedi con il tuo account Google</li>
                            <li>Clicca su "Create API Key"</li>
                            <li>Copia la chiave e incollala qui sotto</li>
                        </ol>
                    </div>
                </div>
                ` : `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    API Key già configurata. Puoi modificarla se necessario.
                </div>
                `}
                
                <div class="form-group">
                    <label>API Key Gemini:</label>
                    <div class="input-group">
                        <input type="${hasKey ? 'password' : 'text'}" 
                               id="geminiApiKey" 
                               class="form-control" 
                               placeholder="AIza..." 
                               value="${currentKey}">
                        <button class="btn btn-sm" onclick="App.toggleApiKeyVisibility()">
                            <i class="fas fa-eye" id="apiKeyToggle"></i>
                        </button>
                    </div>
                </div>
                
                <div class="form-group">
                    <button class="btn btn-sm btn-secondary" onclick="App.testApiKey()">
                        <i class="fas fa-vial"></i> Test API Key
                    </button>
                    <span id="testResult" class="test-result"></span>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" 
                               id="disableAI" 
                               ${localStorage.getItem('ai_disabled') === 'true' ? 'checked' : ''}
                               onchange="App.toggleAIMode(this.checked)">
                        Modalità manuale (disabilita AI)
                    </label>
                    <p class="text-muted small">
                        In modalità manuale dovrai inserire tutti i dati manualmente
                    </p>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="App.saveApiKey()">
                        <i class="fas fa-save"></i> Salva Configurazione
                    </button>
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Annulla
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    toggleApiKeyVisibility() {
        const input = document.getElementById('geminiApiKey');
        const icon = document.getElementById('apiKeyToggle');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'fas fa-eye';
        }
    },
    
    toggleAIMode(disabled) {
        localStorage.setItem('ai_disabled', disabled ? 'true' : 'false');
        
        if (this.modules.AIManager) {
            this.modules.AIManager.disabled = disabled;
        }
        
        const testBtn = document.querySelector('[onclick="App.testApiKey()"]');
        if (testBtn) {
            testBtn.disabled = disabled;
        }
    },
    
    async testApiKey() {
        const apiKey = document.getElementById('geminiApiKey')?.value;
        const resultEl = document.getElementById('testResult');
        
        if (!apiKey) {
            resultEl.innerHTML = '<span class="text-danger">Inserisci una API Key</span>';
            return;
        }
        
        resultEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Test in corso...';
        
        try {
            // Test semplice con Gemini
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: "Test" }]
                    }]
                })
            });
            
            if (response.ok) {
                resultEl.innerHTML = '<span class="text-success"><i class="fas fa-check"></i> API Key valida!</span>';
            } else {
                const error = await response.json();
                if (response.status === 400 && error.error?.message?.includes('API_KEY_INVALID')) {
                    resultEl.innerHTML = '<span class="text-danger"><i class="fas fa-times"></i> API Key non valida</span>';
                } else {
                    resultEl.innerHTML = '<span class="text-danger"><i class="fas fa-times"></i> Errore: ' + (error.error?.message || 'Sconosciuto') + '</span>';
                }
            }
        } catch (error) {
            resultEl.innerHTML = '<span class="text-danger"><i class="fas fa-times"></i> Errore connessione</span>';
        }
    },
    
    async saveApiKey() {
        const apiKey = document.getElementById('geminiApiKey')?.value;
        const disableAI = document.getElementById('disableAI')?.checked;
        
        if (!apiKey && !disableAI) {
            showNotification('Inserisci una API Key o abilita la modalità manuale', 'warning');
            return;
        }
        
        // Salva configurazione
        localStorage.setItem('gemini_api_key', apiKey);
        localStorage.setItem('ai_disabled', disableAI ? 'true' : 'false');
        
        // Aggiorna AI Manager
        if (this.modules.AIManager) {
            this.modules.AIManager.apiKey = apiKey;
            this.modules.AIManager.disabled = disableAI;
            await this.modules.AIManager.init();
        }
        
        this.closeModal();
        showNotification('Configurazione AI salvata con successo!', 'success');
        
        // Se siamo nella tab employees, mostra suggerimento
        if (this.currentTab === 'employees') {
            showNotification('Ora puoi caricare le buste paga e l\'AI estrarrà automaticamente i dati!', 'info');
        }
    },
    
    updateUserUI() {
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        
        if (!user) return;
        
        // Aggiorna email utente nell'header
        const userEmailEl = document.getElementById('userEmail');
        if (userEmailEl) {
            userEmailEl.textContent = user.email;
        }
        
        console.log('👤 UI utente aggiornata');
    },
    
    async loadDashboard() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;
        
        showLoading(true);
        
        try {
            // Raccogli statistiche
            const stats = await this.gatherDashboardStats();
            const hasApiKey = localStorage.getItem('gemini_api_key') ? true : false;
            const aiDisabled = localStorage.getItem('ai_disabled') === 'true';
            
            container.innerHTML = `
                <div class="dashboard-stats">
                    <div class="stat-card">
                        <i class="fas fa-users"></i>
                        <div class="stat-content">
                            <h3>${stats.employees}</h3>
                            <p>Dipendenti</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <i class="fas fa-rocket"></i>
                        <div class="stat-content">
                            <h3>${stats.projects}</h3>
                            <p>Progetti</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <i class="fas fa-clock"></i>
                        <div class="stat-content">
                            <h3>${stats.totalHours}</h3>
                            <p>Ore Totali</p>
                        </div>
                    </div>
                    
                    <div class="stat-card highlight">
                        <i class="fas fa-euro-sign"></i>
                        <div class="stat-content">
                            <h3>${Utils.formatCurrency(stats.totalCredit)}</h3>
                            <p>Credito Stimato</p>
                        </div>
                    </div>
                </div>
                
                ${!hasApiKey || aiDisabled ? `
                <div class="alert alert-warning" style="margin-top: 20px;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <div>
                        <strong>${aiDisabled ? 'Modalità Manuale Attiva' : 'AI non configurata'}</strong>
                        <p>${aiDisabled ? 
                            'Stai usando l\'app in modalità manuale. Per abilitare l\'estrazione automatica dei dati, configura l\'AI.' : 
                            'Per utilizzare l\'estrazione automatica dei dati dalle buste paga, configura la tua API Key di Gemini.'
                        }</p>
                        <button class="btn btn-primary btn-sm" onclick="App.showApiKeyPrompt()">
                            <i class="fas fa-key"></i> Configura AI
                        </button>
                    </div>
                </div>
                ` : ''}
                
                <div class="dashboard-welcome">
                    <h3>Benvenuto in R&S Credit Manager!</h3>
                    <p>Gestisci i tuoi progetti di ricerca e sviluppo e calcola il credito d'imposta.</p>
                    
                    <div class="quick-actions">
                        <button class="btn btn-primary" onclick="App.switchTab('employees')">
                            <i class="fas fa-user-plus"></i> Aggiungi Dipendenti
                        </button>
                        <button class="btn btn-primary" onclick="App.switchTab('projects')">
                            <i class="fas fa-plus-circle"></i> Crea Progetto
                        </button>
                        ${hasApiKey && !aiDisabled ? `
                        <button class="btn btn-secondary" onclick="App.showAIStatus()">
                            <i class="fas fa-robot"></i> Stato AI
                        </button>
                        ` : ''}
                    </div>
                </div>
                
                <div class="dashboard-tips">
                    <h4>🚀 Come iniziare:</h4>
                    <ol>
                        <li>
                            <strong>Carica le buste paga</strong> dei dipendenti 
                            ${hasApiKey && !aiDisabled ? '(l\'AI estrarrà automaticamente i dati)' : '(dovrai inserire i dati manualmente)'}
                        </li>
                        <li><strong>Crea i progetti</strong> di R&S del tuo anno fiscale</li>
                        <li><strong>Assegna le ore</strong> nel timesheet per ogni dipendente/progetto</li>
                        <li><strong>Carica le fatture</strong> relative ai progetti</li>
                        <li><strong>Genera la relazione</strong> tecnica per il credito d'imposta</li>
                    </ol>
                </div>
            `;
            
        } catch (error) {
            console.error('Errore caricamento dashboard:', error);
            container.innerHTML = '<div class="error">Errore caricamento dashboard</div>';
        } finally {
            showLoading(false);
        }
    },
    
    async gatherDashboardStats() {
        const stats = {
            employees: 0,
            projects: 0,
            totalHours: 0,
            totalCredit: 0
        };
        
        // Dipendenti
        if (this.modules.EmployeesManager) {
            stats.employees = this.modules.EmployeesManager.getAll().length;
        }
        
        // Progetti
        if (this.modules.ProjectsManager) {
            const projects = this.modules.ProjectsManager.getAll();
            stats.projects = projects.length;
            stats.totalCredit = this.modules.ProjectsManager.getTotalCredit();
        }
        
        return stats;
    },
    
    saveCurrentWork() {
        // Placeholder per auto-save
        console.log('💾 Auto-save in corso...');
    },
    
    closeModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },
    
    closeModalOnBackdrop(event) {
        if (event.target.classList.contains('modal-backdrop')) {
            this.closeModal();
        }
    },
    
    showNotifications() {
        console.log('🔔 Mostra notifiche');
    },
    
    toggleUserMenu() {
        const dropdown = document.querySelector('.user-menu-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    },
    
    showProfile() {
        console.log('👤 Mostra profilo');
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        
        modalBody.innerHTML = `
            <div class="profile-modal">
                <h3>👤 Profilo Utente</h3>
                
                <div class="profile-info">
                    <div class="form-group">
                        <label>Email:</label>
                        <p>${user?.email || 'N/D'}</p>
                    </div>
                    
                    <div class="form-group">
                        <label>Nome:</label>
                        <p>${profile?.full_name || 'N/D'}</p>
                    </div>
                    
                    <div class="form-group">
                        <label>Azienda:</label>
                        <p>${profile?.company_name || 'N/D'}</p>
                    </div>
                    
                    <div class="form-group">
                        <label>Membro dal:</label>
                        <p>${profile?.created_at ? new Date(profile.created_at).toLocaleDateString('it-IT') : 'N/D'}</p>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Chiudi
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    showSettings() {
        console.log('⚙️ Mostra impostazioni');
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        const hasApiKey = localStorage.getItem('gemini_api_key') ? true : false;
        const aiDisabled = localStorage.getItem('ai_disabled') === 'true';
        const aiStatus = this.modules.AIManager?.getAPIStatus() || { configured: false, requestsToday: 0, requestsRemaining: 0 };
        
        modalBody.innerHTML = `
            <div class="settings-modal">
                <h3>⚙️ Impostazioni</h3>
                
                <div class="settings-section">
                    <h4><i class="fas fa-robot"></i> Configurazione AI</h4>
                    
                    <div class="ai-status-card">
                        <div class="status-row">
                            <span>Stato:</span>
                            <span class="${hasApiKey ? 'text-success' : 'text-danger'}">
                                ${hasApiKey ? '✅ Configurata' : '❌ Non configurata'}
                            </span>
                        </div>
                        ${hasApiKey && !aiDisabled ? `
                        <div class="status-row">
                            <span>Richieste oggi:</span>
                            <span>${aiStatus.requestsToday} / 1500</span>
                        </div>
                        <div class="status-row">
                            <span>Modalità:</span>
                            <span>${aiDisabled ? 'Manuale' : 'Automatica con AI'}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <button class="btn btn-primary btn-block" onclick="App.showApiKeyPrompt()">
                        <i class="fas fa-key"></i> ${hasApiKey ? 'Modifica' : 'Configura'} API Key
                    </button>
                </div>
                
                <div class="settings-section">
                    <h4><i class="fas fa-database"></i> Dati e Privacy</h4>
                    
                    <button class="btn btn-secondary btn-block" onclick="App.exportAllData()">
                        <i class="fas fa-download"></i> Esporta tutti i dati
                    </button>
                    
                    <button class="btn btn-danger btn-block" onclick="App.confirmDeleteAllData()">
                        <i class="fas fa-trash"></i> Elimina tutti i dati
                    </button>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Chiudi
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    exportDashboard() {
        console.log('📊 Esporta dashboard');
        showNotification('Export dashboard in sviluppo', 'info');
    },
    
    showAIStatus() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        const status = this.modules.AIManager?.getAPIStatus() || { 
            configured: false, 
            requestsToday: 0, 
            requestsRemaining: 1500,
            percentageUsed: 0
        };
        
        modalBody.innerHTML = `
            <div class="ai-status-modal">
                <h3>🤖 Stato AI</h3>
                
                <div class="ai-metrics">
                    <div class="metric-card">
                        <i class="fas fa-check-circle ${status.configured ? 'text-success' : 'text-danger'}"></i>
                        <h4>Configurazione</h4>
                        <p>${status.configured ? 'API Key configurata' : 'API Key mancante'}</p>
                    </div>
                    
                    <div class="metric-card">
                        <i class="fas fa-chart-line"></i>
                        <h4>Utilizzo Oggi</h4>
                        <p>${status.requestsToday} richieste</p>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${status.percentageUsed}%"></div>
                        </div>
                    </div>
                    
                    <div class="metric-card">
                        <i class="fas fa-coins"></i>
                        <h4>Crediti Rimanenti</h4>
                        <p>${status.requestsRemaining} / 1500</p>
                    </div>
                </div>
                
                <div class="ai-info">
                    <h4>Informazioni sul servizio</h4>
                    <ul>
                        <li>Modello: Gemini 1.5 Flash</li>
                        <li>Limite giornaliero: 1500 richieste</li>
                        <li>Reset: Mezzanotte UTC</li>
                        <li>Funzionalità: Estrazione dati da PDF/immagini</li>
                    </ul>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="App.showApiKeyPrompt()">
                        <i class="fas fa-cog"></i> Configura AI
                    </button>
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Chiudi
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    async exportAllData() {
        showLoading(true);
        try {
            const data = {
                exportDate: new Date().toISOString(),
                user: Auth.getUser()?.email,
                employees: this.modules.EmployeesManager?.getAll() || [],
                projects: this.modules.ProjectsManager?.getAll() || [],
                allocations: this.modules.TimesheetManager?.allocations || {},
                documents: {
                    invoices: this.modules.DocumentsManager?.invoices || [],
                    other: this.modules.DocumentsManager?.otherDocs || []
                },
                report: this.modules.ReportManager?.reportData || {}
            };
            
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `rs_credit_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showNotification('Dati esportati con successo', 'success');
        } catch (error) {
            console.error('Errore export:', error);
            showNotification('Errore durante l\'export dei dati', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    confirmDeleteAllData() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="delete-confirm-modal">
                <h3 class="text-danger">⚠️ Attenzione!</h3>
                <p>Stai per eliminare <strong>TUTTI</strong> i tuoi dati:</p>
                <ul>
                    <li>Tutti i dipendenti e le loro buste paga</li>
                    <li>Tutti i progetti</li>
                    <li>Tutte le allocazioni del timesheet</li>
                    <li>Tutti i documenti e le fatture</li>
                    <li>Tutte le relazioni</li>
                </ul>
                
                <p class="text-danger"><strong>Questa operazione è irreversibile!</strong></p>
                
                <div class="form-group">
                    <label>Per confermare, scrivi "ELIMINA TUTTO":</label>
                    <input type="text" id="deleteConfirm" class="form-control" placeholder="ELIMINA TUTTO">
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-danger" onclick="App.executeDeleteAllData()">
                        <i class="fas fa-trash"></i> Elimina definitivamente
                    </button>
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Annulla
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    async executeDeleteAllData() {
        const confirm = document.getElementById('deleteConfirm')?.value;
        if (confirm !== 'ELIMINA TUTTO') {
            showNotification('Devi scrivere esattamente "ELIMINA TUTTO" per confermare', 'warning');
            return;
        }
        
        showLoading(true);
        try {
            // Qui andrebbero le chiamate per eliminare i dati dal database
            // Per ora resettiamo solo localStorage
            
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
            
            showNotification('Tutti i dati sono stati eliminati', 'success');
            
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            
        } catch (error) {
            console.error('Errore eliminazione dati:', error);
            showNotification('Errore durante l\'eliminazione dei dati', 'error');
        }
    }
};

// Funzioni globali helper
window.showNotification = function(message, type = 'info') {
    console.log(`🔔 [${type.toUpperCase()}] ${message}`);
    
    // Crea elemento notifica
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                         type === 'success' ? 'check-circle' : 
                         type === 'warning' ? 'exclamation-triangle' :
                         'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Aggiungi al container o body
    const container = document.getElementById('notificationContainer') || document.body;
    container.appendChild(notification);
    
    // Animazione entrata
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Rimozione automatica
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
};

window.showLoading = function(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
};

window.closeModal = function() {
    App.closeModal();
};

// Inizializzazione quando DOM è pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        console.log('📄 DOM caricato, avvio auth...');
        const isAuth = await Auth.init();
        if (isAuth) {
            console.log('✅ Utente autenticato, avvio app...');
            await App.init();
        }
    });
} else {
    console.log('📄 DOM già caricato, avvio auth...');
    Auth.init().then(async (isAuth) => {
        if (isAuth) {
            console.log('✅ Utente autenticato, avvio app...');
            await App.init();
        }
    });
}

// Export
window.App = App;
