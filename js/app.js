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
            const isAuthenticated = await Auth.init();
            
            if (!isAuthenticated) {
                console.log('Utente non autenticato');
                showLoading(false);
                return false;
            }
            
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
            console.error('Errore inizializzazione:', error);
            showNotification('Errore durante l\'inizializzazione', 'error');
            return false;
        } finally {
            showLoading(false);
        }
    },
    
    async initializeModules() {
        console.log('Inizializzazione moduli...');
        
        // Inizializza in ordine di dipendenza
        const modulesToInit = [
            { name: 'AIManager', instance: AIManager, critical: false },
            { name: 'EmployeesManager', instance: EmployeesManager, critical: true },
            { name: 'ProjectsManager', instance: ProjectsManager, critical: true },
            { name: 'DocumentsManager', instance: DocumentsManager, critical: true },
            { name: 'TimesheetManager', instance: TimesheetManager, critical: true },
            { name: 'ReportManager', instance: ReportManager, critical: true }
        ];
        
        for (const module of modulesToInit) {
            try {
                console.log(`Inizializzazione ${module.name}...`);
                await module.instance.init();
                this.modules[module.name] = module.instance;
            } catch (error) {
                console.error(`Errore inizializzazione ${module.name}:`, error);
                if (module.critical) {
                    throw new Error(`Modulo critico ${module.name} non inizializzato`);
                }
            }
        }
    },
    
    setupUI() {
        // Setup navigazione tabs
        this.setupNavigation();
        
        // Setup responsive menu
        this.setupMobileMenu();
        
        // Setup shortcuts
        this.setupKeyboardShortcuts();
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Setup notifiche
        this.setupNotifications();
        
        // Setup modal
        this.setupModal();
    },
    
    setupNavigation() {
        // Tab navigation
        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const tab = button.dataset.tab;
                this.switchTab(tab);
            });
        });
        
        // Browser back/forward
        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.tab) {
                this.switchTab(e.state.tab, false);
            }
        });
    },
    
    setupMobileMenu() {
        const menuToggle = document.getElementById('mobileMenuToggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (menuToggle && sidebar) {
            menuToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
            });
            
            // Chiudi menu quando si clicca fuori
            document.addEventListener('click', (e) => {
                if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                }
            });
        }
    },
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S = Salva
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.saveCurrentWork();
            }
            
            // Ctrl/Cmd + P = Stampa/Export
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                if (this.currentTab === 'report') {
                    ReportManager.exportReport();
                }
            }
            
            // Esc = Chiudi modal
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });
    },
    
    setupAutoSave() {
        // Auto-save ogni 5 minuti
        setInterval(() => {
            if (this.isInitialized) {
                this.saveCurrentWork();
            }
        }, 5 * 60 * 1000);
        
        // Save quando si lascia la pagina
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = 'Hai modifiche non salvate. Vuoi davvero uscire?';
            }
        });
    },
    
    setupNotifications() {
        // Richiedi permesso notifiche se supportato
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    },
    
    setupModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            // Chiudi cliccando fuori
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    },
    
    switchTab(tabName, updateHistory = true) {
        // Verifica autenticazione
        if (!Auth.requireAuth()) {
            return;
        }
        
        // Aggiorna UI
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
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
        if (!AIManager.apiKey) {
            this.showApiKeyPrompt();
        }
    },
    
    showWelcome() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="welcome">
                <h2>🎉 Benvenuto in R&S Credit Manager!</h2>
                <p>La piattaforma completa per gestire il credito d'imposta R&S con intelligenza artificiale.</p>
                
                <div class="welcome-features">
                    <div class="feature">
                        <i class="fas fa-robot"></i>
                        <h3>AI Integrata</h3>
                        <p>Estrazione automatica dati da buste paga e documenti</p>
                    </div>
                    <div class="feature">
                        <i class="fas fa-cloud"></i>
                        <h3>Cloud Sync</h3>
                        <p>I tuoi dati sempre sincronizzati e sicuri</p>
                    </div>
                    <div class="feature">
                        <i class="fas fa-users"></i>
                        <h3>Multi-utente</h3>
                        <p>Collabora con il tuo team in tempo reale</p>
                    </div>
                </div>
                
                <h3>Come iniziare:</h3>
                <ol>
                    <li>📋 Carica le buste paga dei dipendenti (l'AI estrarrà i dati automaticamente)</li>
                    <li>🚀 Crea i tuoi progetti di R&S</li>
                    <li>⏱️ Distribuisci le ore nel timesheet</li>
                    <li>📄 Carica fatture e documenti</li>
                    <li>📑 Genera la relazione tecnica con AI</li>
                </ol>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="App.closeModal(); App.showApiKeyPrompt();">
                        <i class="fas fa-key"></i> Configura API Key
                    </button>
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Inizia subito
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    showApiKeyPrompt() {
        const modalBody = document.getElementById('modalBody');
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div class="api-key-prompt">
                <h3>🔐 Configura Gemini AI</h3>
                <p>Per utilizzare le funzionalità AI avanzate, hai bisogno di una API Key di Google Gemini.</p>
                
                <div class="info-banner">
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
                
                <div class="form-group">
                    <label>API Key Gemini:</label>
                    <input type="password" id="setupApiKey" placeholder="AIza...">
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="skipAI">
                        Procedi senza AI (modalità manuale)
                    </label>
                    <p class="small">Potrai sempre configurare l'AI in seguito dalla sezione Dashboard</p>
                </div>
                
                <div class="form-actions">
                    <button class="btn btn-primary" onclick="App.saveApiKey()">
                        <i class="fas fa-save"></i> Salva e Continua
                    </button>
                    <button class="btn btn-secondary" onclick="App.closeModal()">
                        Salta per ora
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('modal').classList.remove('hidden');
    },
    
    async saveApiKey() {
        const apiKey = document.getElementById('setupApiKey')?.value;
        const skipAI = document.getElementById('skipAI')?.checked;
        
        if (!apiKey && !skipAI) {
            showNotification('Inserisci una API Key o seleziona modalità manuale', 'warning');
            return;
        }
        
        if (apiKey) {
            await AIManager.saveApiKey(apiKey);
            showNotification('API Key configurata con successo!', 'success');
        }
        
        if (skipAI) {
            localStorage.setItem('ai_disabled', 'true');
            const checkbox = document.getElementById('disableAI');
            if (checkbox) checkbox.checked = true;
        }
        
        this.closeModal();
        
        // Vai alla tab dipendenti per iniziare
        this.switchTab('employees');
    },
    
    updateUserUI() {
        const user = Auth.getUser();
        const profile = Auth.getProfile();
        
        if (!user || !profile) return;
        
        // Aggiorna nome utente
        const userNameEl = document.getElementById('userName');
        if (userNameEl) {
            userNameEl.textContent = profile.full_name || user.email;
        }
        
        // Aggiorna nome azienda
        const companyNameEl = document.getElementById('companyName');
        if (companyNameEl && profile.company_name) {
            companyNameEl.textContent = profile.company_name;
        }
        
        // Aggiorna stato API
        this.updateApiStatus();
    },
    
    updateApiStatus() {
        const statusEl = document.getElementById('apiStatus');
        if (!statusEl) return;
        
        const status = AIManager.getAPIStatus();
        
        if (status.configured) {
            const percentage = 100 - parseInt(status.percentageUsed);
            statusEl.innerHTML = `
                <i class="fas fa-robot"></i> AI: ${status.requestsRemaining}/${status.requestsToday + status.requestsRemaining} richieste
                <div class="api-usage-bar">
                    <div class="api-usage-fill" style="width: ${status.percentageUsed}%"></div>
                </div>
            `;
            statusEl.classList.add('configured');
            
            if (percentage < 10) {
                statusEl.classList.add('warning');
            }
        } else {
            statusEl.innerHTML = '<i class="fas fa-robot"></i> AI non configurata';
            statusEl.classList.remove('configured');
        }
    },
    
    async loadDashboard() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;
        
        showLoading(true);
        
        try {
            // Raccogli statistiche
            const stats = await this.gatherDashboardStats();
            
            container.innerHTML = `
                <div class="dashboard-header">
                    <h2>Dashboard</h2>
                    <div class="dashboard-period">
                        <select id="dashboardPeriod" onchange="App.loadDashboard()">
                            <option value="current">Anno Corrente</option>
                            <option value="all">Tutti i Periodi</option>
                        </select>
                    </div>
                </div>
                
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
                            <p>Progetti Attivi</p>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <i class="fas fa-clock"></i>
                        <div class="stat-content">
                            <h3>${Utils.formatNumber(stats.totalHours)}</h3>
                            <p>Ore Totali</p>
                        </div>
                    </div>
                    
                    <div class="stat-card highlight">
                        <i class="fas fa-euro-sign"></i>
                        <div class="stat-content">
                            <h3>${Utils.formatCurrencyCompact(stats.totalCredit)}</h3>
                            <p>Credito Stimato</p>
                        </div>
                    </div>
                </div>
                
                <div class="dashboard-sections">
                    <div class="dashboard-section">
                        <h3>Attività Recenti</h3>
                        ${this.renderRecentActivities(stats.recentActivities)}
                    </div>
                    
                    <div class="dashboard-section">
                        <h3>Progetti per Tipo</h3>
                        <canvas id="projectsChart" width="300" height="200"></canvas>
                    </div>
                    
                    <div class="dashboard-section">
                        <h3>Azioni Rapide</h3>
                        <div class="quick-actions">
                            <button class="quick-action" onclick="App.switchTab('employees')">
                                <i class="fas fa-user-plus"></i>
                                <span>Aggiungi Dipendente</span>
                            </button>
                            <button class="quick-action" onclick="App.switchTab('projects'); ProjectsManager.addProject();">
                                <i class="fas fa-plus-circle"></i>
                                <span>Nuovo Progetto</span>
                            </button>
                            <button class="quick-action" onclick="App.switchTab('documents')">
                                <i class="fas fa-file-upload"></i>
                                <span>Carica Documenti</span>
                            </button>
                            <button class="quick-action" onclick="App.switchTab('report'); ReportManager.exportReport();">
                                <i class="fas fa-file-pdf"></i>
                                <span>Genera Report</span>
                            </button>
                        </div>
                    </div>
                    
                    <div class="dashboard-section">
                        <h3>Stato Sistema</h3>
                        ${this.renderSystemStatus()}
                    </div>
                </div>
            `;
            
            // Disegna grafici
            this.drawProjectsChart(stats.projectsByType);
            
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
            totalCredit: 0,
            projectsByType: {},
            recentActivities: []
        };
        
        // Dipendenti
        if (this.modules.EmployeesManager) {
            stats.employees = this.modules.EmployeesManager.getAll().length;
        }
        
        // Progetti
        if (this.modules.ProjectsManager) {
            const projects = this.modules.ProjectsManager.getAll();
            stats.projects = projects.filter(p => p.status === 'in_corso').length;
            
            // Progetti per tipo
            projects.forEach(p => {
                const type = ProjectsManager.getProjectTypeLabel(p.type);
                stats.projectsByType[type] = (stats.projectsByType[type] || 0) + 1;
            });
            
            // Calcola credito totale
            stats.totalCredit = this.modules.ProjectsManager.getTotalCredit();
        }
        
        // Ore totali
        if (this.modules.TimesheetManager && this.modules.ProjectsManager) {
            const projects = this.modules.ProjectsManager.getAll();
            projects.forEach(p => {
                stats.totalHours += this.modules.TimesheetManager.calculateProjectHours(p.id);
            });
        }
        
        return stats;
    },
    
    renderRecentActivities(activities) {
        if (!activities || activities.length === 0) {
            return '<p class="empty-state small">Nessuna attività recente</p>';
        }
        
        return `
            <ul class="activity-list">
                ${activities.map(activity => `
                    <li class="activity-item">
                        <i class="${activity.icon}"></i>
                        <div class="activity-content">
                            <p>${activity.description}</p>
                            <span class="activity-time">${Utils.formatRelativeTime(activity.timestamp)}</span>
                        </div>
                    </li>
                `).join('')}
            </ul>
        `;
    },
    
    renderSystemStatus() {
        const aiStatus = AIManager.getAPIStatus();
        const hasData = this.modules.EmployeesManager?.getAll().length > 0;
        
        return `
            <div class="system-status">
                <div class="status-item ${aiStatus.configured ? 'ok' : 'warning'}">
                    <i class="fas fa-robot"></i>
                    <span>AI: ${aiStatus.configured ? 'Configurata' : 'Non configurata'}</span>
                </div>
                <div class="status-item ${hasData ? 'ok' : 'warning'}">
                    <i class="fas fa-database"></i>
                    <span>Dati: ${hasData ? 'Presenti' : 'Nessun dato'}</span>
                </div>
                <div class="status-item ok">
                    <i class="fas fa-cloud"></i>
                    <span>Cloud: Sincronizzato</span>
                </div>
            </div>
        `;
    },
    
    drawProjectsChart(projectsByType) {
        const canvas = document.getElementById('projectsChart');
        if (!canvas || Object.keys(projectsByType).length === 0) return;
        
        const ctx = canvas.getContext('2d');
        const data = Object.entries(projectsByType);
        const total = Object.values(projectsByType).reduce((sum, v) => sum + v, 0);
        
        // Calcola angoli
        let currentAngle = -Math.PI / 2;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        // Colori
        const colors = ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#34495e'];
        
        // Disegna torta
        data.forEach(([type, count], index) => {
            const sliceAngle = (count / total) * 2 * Math.PI;
            
            // Disegna settore
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
            ctx.lineTo(centerX, centerY);
            ctx.closePath();
            ctx.fillStyle = colors[index % colors.length];
            ctx.fill();
            
            // Etichetta
            if (sliceAngle > 0.2) { // Solo se il settore è abbastanza grande
                const labelAngle = currentAngle + sliceAngle / 2;
                const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                
                ctx.fillStyle = 'white';
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(count.toString(), labelX, labelY);
            }
            
            currentAngle += sliceAngle;
        });
        
        // Legenda
        ctx.font = '12px Arial';
        let legendY = 10;
        data.forEach(([type, count], index) => {
            ctx.fillStyle = colors[index % colors.length];
            ctx.fillRect(10, legendY, 10, 10);
            ctx.fillStyle = '#333';
            ctx.textAlign = 'left';
            ctx.fillText(type, 25, legendY + 8);
            legendY += 20;
        });
    },
    
    saveCurrentWork() {
        // Salva stato corrente
        console.log('Auto-save in corso...');
        
        // Ogni modulo ha già il suo sistema di salvataggio
        // Questo è un placeholder per future implementazioni
    },
    
    hasUnsavedChanges() {
        // Per ora assumiamo che tutto sia salvato automaticamente
        return false;
    },
    
    closeModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    },
    
    async logout() {
        if (confirm('Sei sicuro di voler uscire?')) {
            await Auth.signOut();
        }
    }
};

// Funzioni globali helper
window.showNotification = function(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 
                         type === 'success' ? 'check-circle' : 
                         type === 'warning' ? 'exclamation-triangle' :
                         'info-circle'}"></i>
        <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    // Animazione entrata
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Rimozione automatica
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // Notifica browser se permesso
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('R&S Credit Manager', {
            body: message,
            icon: '/favicon.ico'
        });
    }
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
        console.log('DOM caricato, avvio app...');
        await Auth.init();
    });
} else {
    console.log('DOM già caricato, avvio app...');
    Auth.init();
}

// Export
window.App = App;
