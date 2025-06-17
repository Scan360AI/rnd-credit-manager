// js/projects.js - Gestione Progetti R&S

const ProjectsManager = {
    projects: [],
    isLoading: false,
    
    // Configurazione tipi di progetto
    projectTypes: [
        { value: 'ricerca_fondamentale', label: 'Ricerca Fondamentale', rate: 0.12, color: '#9b59b6' },
        { value: 'ricerca_industriale', label: 'Ricerca Industriale', rate: 0.10, color: '#3498db' },
        { value: 'sviluppo_sperimentale', label: 'Sviluppo Sperimentale', rate: 0.10, color: '#e74c3c' },
        { value: 'innovazione_tecnologica', label: 'Innovazione Tecnologica', rate: 0.10, color: '#f39c12' },
        { value: 'innovazione_4.0', label: 'Innovazione 4.0', rate: 0.15, color: '#27ae60' },
        { value: 'innovazione_green', label: 'Innovazione Green', rate: 0.15, color: '#16a085' },
        { value: 'design', label: 'Design e Ideazione Estetica', rate: 0.10, color: '#e91e63' }
    ],
    
    async init() {
        console.log('Inizializzazione Projects Manager...');
        await this.loadProjects();
        this.render();
    },
    
    async loadProjects() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            this.isLoading = true;
            
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // Formatta i dati per compatibilità
            this.projects = data.map(proj => ({
                id: proj.id,
                name: proj.name,
                year: proj.year,
                type: proj.project_type,
                description: proj.description,
                startDate: proj.start_date,
                endDate: proj.end_date,
                status: proj.status,
                teamMembers: proj.team_members || [],
                documents: proj.documents || [],
                assignedInvoices: proj.assigned_invoices || [],
                totalBudget: proj.total_budget || 0,
                creditEstimate: proj.credit_estimate || 0,
                createdAt: proj.created_at,
                updatedAt: proj.updated_at
            }));
            
            console.log(`Caricati ${this.projects.length} progetti`);
            
        } catch (error) {
            console.error('Errore caricamento progetti:', error);
            showNotification('Errore caricamento progetti', 'error');
        } finally {
            this.isLoading = false;
        }
    },
    
    async addProject() {
        const userId = Auth.getUser()?.id;
        if (!userId) {
            showNotification('Devi essere autenticato per creare progetti', 'error');
            return;
        }
        
        try {
            const newProject = {
                user_id: userId,
                name: '',
                year: new Date().getFullYear(),
                project_type: 'ricerca_industriale',
                description: '',
                start_date: null,
                end_date: null,
                status: 'in_corso',
                team_members: [],
                documents: [],
                assigned_invoices: [],
                total_budget: 0,
                credit_estimate: 0,
                is_active: true
            };
            
            const { data, error } = await supabase
                .from('projects')
                .insert([newProject])
                .select()
                .single();
            
            if (error) throw error;
            
            // Aggiungi alla lista locale
            this.projects.unshift({
                id: data.id,
                name: data.name,
                year: data.year,
                type: data.project_type,
                description: data.description,
                startDate: data.start_date,
                endDate: data.end_date,
                status: data.status,
                teamMembers: data.team_members || [],
                documents: data.documents || [],
                assignedInvoices: data.assigned_invoices || [],
                totalBudget: data.total_budget || 0,
                creditEstimate: data.credit_estimate || 0,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            });
            
            this.render();
            
            // Focus sul nome del nuovo progetto
            setTimeout(() => {
                const nameInput = document.querySelector(`#project-${data.id} input[type="text"]`);
                if (nameInput) nameInput.focus();
            }, 100);
            
        } catch (error) {
            console.error('Errore creazione progetto:', error);
            showNotification('Errore creazione progetto', 'error');
        }
    },
    
    async updateProject(id, field, value) {
        const project = this.projects.find(p => p.id === id);
        if (!project) return;
        
        // Validazione date
        if (field === 'startDate' && project.endDate && value > project.endDate) {
            showNotification('La data di inizio non può essere successiva alla data di fine', 'warning');
            return;
        }
        if (field === 'endDate' && project.startDate && value < project.startDate) {
            showNotification('La data di fine non può essere precedente alla data di inizio', 'warning');
            return;
        }
        
        // Mappa i nomi dei campi
        const fieldMap = {
            'name': 'name',
            'year': 'year',
            'type': 'project_type',
            'description': 'description',
            'startDate': 'start_date',
            'endDate': 'end_date',
            'status': 'status'
        };
        
        const dbField = fieldMap[field] || field;
        
        try {
            const updateData = {
                [dbField]: value,
                updated_at: new Date().toISOString()
            };
            
            const { error } = await supabase
                .from('projects')
                .update(updateData)
                .eq('id', id);
            
            if (error) throw error;
            
            // Aggiorna localmente
            project[field] = value;
            
            // Se cambia nome o stato, aggiorna timesheet
            if (field === 'name' || field === 'status') {
                if (window.TimesheetManager) {
                    TimesheetManager.render();
                }
            }
            
            this.updateProjectStats();
            
        } catch (error) {
            console.error('Errore aggiornamento progetto:', error);
            showNotification('Errore aggiornamento progetto', 'error');
        }
    },
    
    async removeProject(id) {
        if (!confirm('Sicuro di voler eliminare questo progetto? Tutte le allocazioni verranno perse.')) {
            return;
        }
        
        try {
            showLoading(true);
            
            // Soft delete
            const { error } = await supabase
                .from('projects')
                .update({ is_active: false })
                .eq('id', id);
            
            if (error) throw error;
            
            // Rimuovi dalla lista locale
            this.projects = this.projects.filter(p => p.id !== id);
            
            this.render();
            
            if (window.TimesheetManager) {
                TimesheetManager.render();
            }
            
            showNotification('Progetto eliminato con successo', 'success');
            
        } catch (error) {
            console.error('Errore eliminazione progetto:', error);
            showNotification('Errore eliminazione progetto', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    async toggleInvoiceAssignment(projectId, invoiceId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        if (!project.assignedInvoices) {
            project.assignedInvoices = [];
        }
        
        const index = project.assignedInvoices.indexOf(invoiceId);
        const isAssigning = index === -1;
        
        try {
            if (isAssigning) {
                // Assegna fattura
                project.assignedInvoices.push(invoiceId);
                
                await supabase
                    .from('project_invoices')
                    .insert({
                        project_id: projectId,
                        invoice_id: invoiceId
                    });
                    
            } else {
                // Rimuovi fattura
                project.assignedInvoices.splice(index, 1);
                
                await supabase
                    .from('project_invoices')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('invoice_id', invoiceId);
            }
            
            // Aggiorna nel database principale
            await supabase
                .from('projects')
                .update({ 
                    assigned_invoices: project.assignedInvoices,
                    updated_at: new Date().toISOString()
                })
                .eq('id', projectId);
            
            this.updateProjectStats();
            
        } catch (error) {
            console.error('Errore assegnazione fattura:', error);
            showNotification('Errore assegnazione fattura', 'error');
            
            // Rollback
            if (isAssigning) {
                project.assignedInvoices.pop();
            } else {
                project.assignedInvoices.splice(index, 0, invoiceId);
            }
        }
    },
    
    render() {
        const container = document.getElementById('projectsList');
        if (!container) return;
        
        if (this.isLoading) {
            container.innerHTML = '<div class="loading">Caricamento progetti...</div>';
            return;
        }
        
        if (this.projects.length === 0) {
            container.innerHTML = `
                <div class="empty-state-projects">
                    <div class="empty-icon">
                        <i class="fas fa-rocket"></i>
                    </div>
                    <h3>Nessun progetto di R&S</h3>
                    <p>Inizia creando il tuo primo progetto di ricerca e sviluppo</p>
                    <button class="btn btn-primary btn-lg" onclick="ProjectsManager.addProject()">
                        <i class="fas fa-plus-circle"></i> Crea Progetto
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="projects-grid">
                ${this.projects.map(project => this.renderProjectCard(project)).join('')}
                
                <div class="add-project-card" onclick="ProjectsManager.addProject()">
                    <i class="fas fa-plus-circle"></i>
                    <span>Aggiungi Progetto</span>
                </div>
            </div>
        `;
        
        setTimeout(() => this.updateProjectStats(), 100);
    },
    
    renderProjectCard(project) {
        const stats = this.calculateProjectStats(project.id);
        const statusColors = {
            'in_corso': '#27ae60',
            'completato': '#3498db',
            'sospeso': '#e74c3c'
        };
        
        return `
            <div class="project-card-new" id="project-${project.id}">
                <div class="project-header-new">
                    <input type="text" 
                           class="project-name-input-new"
                           value="${Utils.escapeHtml(project.name)}" 
                           placeholder="Nome del progetto"
                           onchange="ProjectsManager.updateProject('${project.id}', 'name', this.value)">
                    <button class="btn-delete" onclick="ProjectsManager.removeProject('${project.id}')" title="Elimina progetto">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                
                <div class="project-type-badge" style="background: ${this.getTypeColor(project.type)}">
                    <i class="fas fa-flask"></i>
                    ${this.getProjectTypeLabel(project.type)}
                </div>
                
                <div class="project-details">
                    <div class="detail-row">
                        <label>Tipologia</label>
                        <select class="detail-select" onchange="ProjectsManager.updateProject('${project.id}', 'type', this.value)">
                            ${this.renderTypeOptions(project.type)}
                        </select>
                    </div>
                    
                    <div class="detail-row">
                        <label>Anno</label>
                        <input type="number" 
                               class="detail-input"
                               value="${project.year}" 
                               min="2015"
                               max="${new Date().getFullYear() + 1}"
                               onchange="ProjectsManager.updateProject('${project.id}', 'year', this.value)">
                    </div>
                    
                    <div class="detail-row">
                        <label>Periodo</label>
                        <div class="date-range">
                            <input type="date" 
                                   class="detail-input"
                                   value="${project.startDate || ''}" 
                                   onchange="ProjectsManager.updateProject('${project.id}', 'startDate', this.value)">
                            <span>→</span>
                            <input type="date" 
                                   class="detail-input"
                                   value="${project.endDate || ''}" 
                                   onchange="ProjectsManager.updateProject('${project.id}', 'endDate', this.value)">
                        </div>
                    </div>
                    
                    <div class="detail-row">
                        <label>Stato</label>
                        <select class="status-select" 
                                style="color: ${statusColors[project.status]}"
                                onchange="ProjectsManager.updateProject('${project.id}', 'status', this.value); this.style.color='${statusColors[this.value]}'">
                            <option value="in_corso" ${project.status === 'in_corso' ? 'selected' : ''}>
                                ● In Corso
                            </option>
                            <option value="completato" ${project.status === 'completato' ? 'selected' : ''}>
                                ● Completato
                            </option>
                            <option value="sospeso" ${project.status === 'sospeso' ? 'selected' : ''}>
                                ● Sospeso
                            </option>
                        </select>
                    </div>
                </div>
                
                <div class="project-description">
                    <textarea 
                        placeholder="Descrizione del progetto..."
                        onchange="ProjectsManager.updateProject('${project.id}', 'description', this.value)">${Utils.escapeHtml(project.description)}</textarea>
                </div>
                
                <div class="project-stats-new">
                    <div class="stat-item">
                        <i class="fas fa-users"></i>
                        <div class="stat-content">
                            <span class="stat-value">${stats.teamSize}</span>
                            <span class="stat-label">Team</span>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <i class="fas fa-clock"></i>
                        <div class="stat-content">
                            <span class="stat-value">${stats.hours.toFixed(0)}</span>
                            <span class="stat-label">Ore</span>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <i class="fas fa-euro-sign"></i>
                        <div class="stat-content">
                            <span class="stat-value">${this.formatCurrency(stats.laborCost)}</span>
                            <span class="stat-label">Personale</span>
                        </div>
                    </div>
                    
                    <div class="stat-item">
                        <i class="fas fa-file-invoice"></i>
                        <div class="stat-content">
                            <span class="stat-value">${this.formatCurrency(stats.invoiceCost)}</span>
                            <span class="stat-label">Fatture</span>
                        </div>
                    </div>
                </div>
                
                <div class="project-footer">
                    <div class="budget-total">
                        <span class="budget-label">Budget Totale</span>
                        <span class="budget-value">${this.formatCurrency(stats.totalBudget)}</span>
                    </div>
                    
                    <div class="credit-estimate">
                        <span class="credit-label">Credito R&S (${(this.getCreditRate(project.type) * 100).toFixed(0)}%)</span>
                        <span class="credit-value">${this.formatCurrency(stats.estimatedCredit)}</span>
                    </div>
                </div>
                
                <div class="project-actions">
                    <button class="btn-action" onclick="ProjectsManager.showInvoiceAssignment('${project.id}')" title="Gestisci fatture">
                        <i class="fas fa-file-invoice"></i>
                        <span>Fatture (${project.assignedInvoices?.length || 0})</span>
                    </button>
                    <button class="btn-action" onclick="ProjectsManager.showProjectDetails('${project.id}')" title="Dettagli progetto">
                        <i class="fas fa-chart-line"></i>
                        <span>Dettagli</span>
                    </button>
                </div>
            </div>
        `;
    },
    
    calculateProjectStats(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        
        // Calcola costi personale dal timesheet (se disponibile)
        let laborCost = 0;
        let hours = 0;
        let allocations = [];
        
        if (window.TimesheetManager) {
            laborCost = TimesheetManager.calculateProjectCost(projectId);
            hours = TimesheetManager.calculateProjectHours(projectId);
            allocations = TimesheetManager.getProjectAllocations(projectId);
        }
        
        // Calcola costi fatture
        let invoiceCost = 0;
        if (project.assignedInvoices && window.DocumentsManager) {
            project.assignedInvoices.forEach(invoiceId => {
                const invoice = DocumentsManager.getInvoiceById(invoiceId);
                if (invoice && invoice.ammissibile) {
                    invoiceCost += invoice.importo || 0;
                }
            });
        }
        
        const totalBudget = laborCost + invoiceCost;
        const creditRate = this.getCreditRate(project.type);
        const estimatedCredit = totalBudget * creditRate;
        
        return {
            teamSize: allocations.length,
            hours: hours,
            laborCost: laborCost,
            invoiceCost: invoiceCost,
            totalBudget: totalBudget,
            estimatedCredit: estimatedCredit
        };
    },
    
    showInvoiceAssignment(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        
        const invoices = window.DocumentsManager?.invoices || [];
        const assignedInvoices = project.assignedInvoices || [];
        
        modalBody.innerHTML = `
            <h3>Assegna Fatture - ${Utils.escapeHtml(project.name)}</h3>
            <p class="modal-subtitle">Seleziona le fatture relative a questo progetto</p>
            
            <div class="invoice-assignment-list">
                ${invoices.length === 0 ? 
                    '<p class="empty-state small">Nessuna fattura caricata</p>' :
                    invoices.map(invoice => `
                        <div class="invoice-assignment-item ${!invoice.ammissibile ? 'disabled' : ''}">
                            <label>
                                <input type="checkbox" 
                                       ${assignedInvoices.includes(invoice.id) ? 'checked' : ''}
                                       ${!invoice.ammissibile ? 'disabled' : ''}
                                       onchange="ProjectsManager.toggleInvoiceAssignment('${projectId}', '${invoice.id}')">
                                <div class="invoice-info">
                                    <strong>${Utils.escapeHtml(invoice.fornitore || 'Fornitore N/D')}</strong>
                                    <span>N. ${Utils.escapeHtml(invoice.numero || 'N/D')} - ${invoice.data}</span>
                                    <span class="invoice-amount">€${(invoice.importo || 0).toFixed(2)}</span>
                                    ${!invoice.ammissibile ? '<span class="not-eligible">Non ammissibile</span>' : ''}
                                </div>
                            </label>
                        </div>
                    `).join('')
                }
            </div>
            
            <div class="modal-total">
                <span>Totale fatture assegnate:</span>
                <strong>${Utils.formatCurrency(this.calculateAssignedInvoicesTotal(projectId))}</strong>
            </div>
            
            <div class="form-actions">
                <button class="btn btn-primary" onclick="closeModal(); ProjectsManager.render();">
                    Chiudi
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },
    
    showProjectDetails(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        const stats = this.calculateProjectStats(projectId);
        const allocations = window.TimesheetManager?.getProjectAllocations(projectId) || [];
        
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h3>Dettagli Progetto - ${Utils.escapeHtml(project.name)}</h3>
            
            <div class="project-detail-sections">
                <div class="detail-section">
                    <h4><i class="fas fa-users"></i> Team Assegnato</h4>
                    ${allocations.length === 0 ? 
                        '<p class="empty-state small">Nessun dipendente assegnato</p>' :
                        `<table class="detail-table">
                            <thead>
                                <tr>
                                    <th>Dipendente</th>
                                    <th>Ruolo</th>
                                    <th>%</th>
                                    <th>Ore</th>
                                    <th>Costo</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${allocations.map(alloc => `
                                    <tr>
                                        <td>${Utils.escapeHtml(alloc.employee.nome)}</td>
                                        <td>${Utils.escapeHtml(alloc.employee.qualifica)}</td>
                                        <td>${alloc.percentage}%</td>
                                        <td>${alloc.hours.toFixed(0)}</td>
                                        <td>${Utils.formatCurrency(alloc.cost)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="3"><strong>Totale</strong></td>
                                    <td><strong>${stats.hours.toFixed(0)}</strong></td>
                                    <td><strong>${Utils.formatCurrency(stats.laborCost)}</strong></td>
                                </tr>
                            </tfoot>
                        </table>`
                    }
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-file-invoice"></i> Fatture Associate</h4>
                    ${this.renderAssignedInvoices(project)}
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-chart-pie"></i> Riepilogo Costi</h4>
                    <div class="cost-breakdown">
                        <div class="cost-item">
                            <span>Costo Personale</span>
                            <span>${Utils.formatCurrency(stats.laborCost)}</span>
                        </div>
                        <div class="cost-item">
                            <span>Costo Fatture</span>
                            <span>${Utils.formatCurrency(stats.invoiceCost)}</span>
                        </div>
                        <div class="cost-item total">
                            <span>Totale Progetto</span>
                            <span>${Utils.formatCurrency(stats.totalBudget)}</span>
                        </div>
                        <div class="cost-item credit">
                            <span>Credito R&S (${(this.getCreditRate(project.type) * 100).toFixed(0)}%)</span>
                            <span>${Utils.formatCurrency(stats.estimatedCredit)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-robot"></i> Analisi AI</h4>
                    <button class="btn btn-primary" onclick="ProjectsManager.analyzeProjectWithAI('${projectId}')">
                        <i class="fas fa-magic"></i> Analizza Documenti del Progetto
                    </button>
                    <p class="small mt-20">L'AI analizzerà tutti i documenti caricati per questo progetto</p>
                </div>
            </div>
            
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="closeModal()">
                    Chiudi
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },
    
    async analyzeProjectWithAI(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project) return;
        
        try {
            showNotification('Analisi documenti in corso...', 'info');
            
            const analyses = await AIManager.analyzeProjectDocuments(projectId);
            
            // Genera suggerimenti basati sull'analisi
            const suggestions = await AIManager.generateSuggestions({
                projectType: project.type,
                projectName: project.name,
                analyses: analyses
            });
            
            // Mostra i risultati
            this.showAIAnalysisResults(project, analyses, suggestions);
            
        } catch (error) {
            console.error('Errore analisi AI:', error);
            showNotification('Errore durante l\'analisi AI', 'error');
        }
    },
    
    showAIAnalysisResults(project, analyses, suggestions) {
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h3>Analisi AI - ${Utils.escapeHtml(project.name)}</h3>
            
            <div class="ai-analysis-results">
                <div class="detail-section">
                    <h4><i class="fas fa-file-alt"></i> Documenti Analizzati</h4>
                    ${analyses.length === 0 ? 
                        '<p class="empty-state small">Nessun documento trovato per questo progetto</p>' :
                        analyses.map(analysis => `
                            <div class="analysis-item">
                                <h5>${Utils.escapeHtml(analysis.document)}</h5>
                                <p class="analysis-summary">${Utils.escapeHtml(analysis.summary || analysis.content.substring(0, 200))}...</p>
                            </div>
                        `).join('')
                    }
                </div>
                
                <div class="detail-section">
                    <h4><i class="fas fa-lightbulb"></i> Suggerimenti AI</h4>
                    ${suggestions.length === 0 ? 
                        '<p>Nessun suggerimento disponibile</p>' :
                        '<ul>' + suggestions.map(s => `<li>${Utils.escapeHtml(s)}</li>`).join('') + '</ul>'
                    }
                </div>
            </div>
            
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="ProjectsManager.showProjectDetails('${project.id}')">
                    Torna ai Dettagli
                </button>
            </div>
        `;
    },
    
    renderAssignedInvoices(project) {
        if (!project.assignedInvoices || project.assignedInvoices.length === 0) {
            return '<p class="empty-state small">Nessuna fattura assegnata</p>';
        }
        
        if (!window.DocumentsManager) {
            return '<p class="empty-state small">Modulo fatture non disponibile</p>';
        }
        
        const invoices = project.assignedInvoices.map(invoiceId => {
            return DocumentsManager.getInvoiceById(invoiceId);
        }).filter(Boolean);
        
        if (invoices.length === 0) {
            return '<p class="empty-state small">Nessuna fattura trovata</p>';
        }
        
        return `
            <table class="detail-table">
                <thead>
                    <tr>
                        <th>Fornitore</th>
                        <th>Numero</th>
                        <th>Data</th>
                        <th>Importo</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoices.map(invoice => `
                        <tr>
                            <td>${Utils.escapeHtml(invoice.fornitore || 'N/D')}</td>
                            <td>${Utils.escapeHtml(invoice.numero || 'N/D')}</td>
                            <td>${invoice.data}</td>
                            <td>${Utils.formatCurrency(invoice.importo || 0)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },
    
    calculateAssignedInvoicesTotal(projectId) {
        const project = this.projects.find(p => p.id === projectId);
        if (!project || !project.assignedInvoices || !window.DocumentsManager) return 0;
        
        return project.assignedInvoices.reduce((total, invoiceId) => {
            const invoice = DocumentsManager.getInvoiceById(invoiceId);
            return total + (invoice && invoice.ammissibile ? invoice.importo || 0 : 0);
        }, 0);
    },
    
    renderTypeOptions(currentType) {
        return this.projectTypes.map(type => 
            `<option value="${type.value}" ${currentType === type.value ? 'selected' : ''}>${type.label} (${(type.rate * 100).toFixed(0)}%)</option>`
        ).join('');
    },
    
    getTypeColor(type) {
        const projectType = this.projectTypes.find(t => t.value === type);
        return projectType?.color || '#95a5a6';
    },
    
    getProjectTypeLabel(type) {
        const projectType = this.projectTypes.find(t => t.value === type);
        return projectType?.label || type;
    },
    
    getCreditRate(type) {
        const projectType = this.projectTypes.find(t => t.value === type);
        return projectType?.rate || 0.10;
    },
    
    formatCurrency(amount) {
        if (amount < 1000) {
            return amount.toFixed(0);
        } else if (amount < 1000000) {
            return (amount / 1000).toFixed(1) + 'k';
        } else {
            return (amount / 1000000).toFixed(1) + 'M';
        }
    },
    
    updateProjectStats() {
        // Aggiorna statistiche nei card dei progetti
        this.projects.forEach(project => {
            const stats = this.calculateProjectStats(project.id);
            
            // Aggiorna nel database se necessario
            if (project.totalBudget !== stats.totalBudget || 
                project.creditEstimate !== stats.estimatedCredit) {
                
                supabase
                    .from('projects')
                    .update({
                        total_budget: stats.totalBudget,
                        credit_estimate: stats.estimatedCredit,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', project.id)
                    .then(({ error }) => {
                        if (error) {
                            console.error('Errore aggiornamento statistiche:', error);
                        }
                    });
                
                project.totalBudget = stats.totalBudget;
                project.creditEstimate = stats.estimatedCredit;
            }
        });
    },
    
    // Metodi di accesso pubblici
    getAll() {
        return this.projects;
    },
    
    getById(id) {
        return this.projects.find(p => p.id === id);
    },
    
    getByYear(year) {
        return this.projects.filter(p => p.year === parseInt(year));
    },
    
    getActive() {
        return this.projects.filter(p => p.status === 'in_corso');
    },
    
    getTotalCredit() {
        return this.projects.reduce((total, project) => {
            const stats = this.calculateProjectStats(project.id);
            return total + stats.estimatedCredit;
        }, 0);
    }
};

// Export
window.ProjectsManager = ProjectsManager;