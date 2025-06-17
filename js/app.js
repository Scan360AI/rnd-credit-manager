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
        
        // Controlla se manca API key
        if (this.modules.AIManager && !this.modules.AIManager.apiKey) {
            this.showApiKeyPrompt();
        }
    },
    
    showWelcome() {
        // Implementazione welcome modal
        console.log('👋 Primo accesso - mostra welcome');
    },
    
    showApiKeyPrompt() {
        // Implementazione API key prompt
        console.log('🔑 API Key mancante - mostra prompt');
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
                    </div>
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
        this.closeModal();
    },
    
    showSettings() {
        console.log('⚙️ Mostra impostazioni');
        this.closeModal();
    },
    
    exportDashboard() {
        console.log('📊 Esporta dashboard');
        showNotification('Export dashboard in sviluppo', 'info');
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
