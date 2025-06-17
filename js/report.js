// js/report.js - Generazione Relazioni Tecniche con AI

const ReportManager = {
    reportData: {
        descrizione: '',
        incertezze: '',
        innovazione: '',
        risultati: ''
    },
    isLoading: false,
    
    async init() {
        console.log('Inizializzazione Report Manager...');
        await this.loadReportData();
        this.setupEventListeners();
        this.renderCreditSummary();
    },
    
    setupEventListeners() {
        const fields = ['descrizione', 'incertezze', 'innovazione', 'risultati'];
        
        fields.forEach(field => {
            const textarea = document.getElementById(`report${field.charAt(0).toUpperCase() + field.slice(1)}`);
            if (textarea) {
                textarea.value = this.reportData[field];
                textarea.addEventListener('input', Utils.debounce(async (e) => {
                    this.reportData[field] = e.target.value;
                    await this.saveReportData();
                }, 1000));
            }
        });
    },
    
    async loadReportData() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            this.isLoading = true;
            
            const { data, error } = await supabase
                .from('report_sections')
                .select('*')
                .eq('user_id', userId);
            
            if (error) throw error;
            
            // Ricostruisci reportData dalle sezioni salvate
            data.forEach(section => {
                if (this.reportData.hasOwnProperty(section.section_name)) {
                    this.reportData[section.section_name] = section.content;
                }
            });
            
            console.log('Dati relazione caricati');
            
        } catch (error) {
            console.error('Errore caricamento dati relazione:', error);
        } finally {
            this.isLoading = false;
        }
    },
    
    async saveReportData() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            // Salva ogni sezione
            for (const [section, content] of Object.entries(this.reportData)) {
                const { error } = await supabase
                    .from('report_sections')
                    .upsert({
                        user_id: userId,
                        section_name: section,
                        content: content,
                        updated_at: new Date().toISOString()
                    });
                
                if (error) throw error;
            }
            
        } catch (error) {
            console.error('Errore salvataggio dati relazione:', error);
        }
    },
    
    async generateAIContent(section) {
        try {
            if (!AIManager.apiKey) {
                showNotification('Configura prima la API Key di Gemini nella sezione Setup', 'error');
                return;
            }
            
            const projects = ProjectsManager.getAll();
            if (projects.length === 0) {
                showNotification('Aggiungi almeno un progetto prima di generare contenuti', 'warning');
                return;
            }
            
            // Usa il primo progetto attivo come riferimento
            const project = projects.find(p => p.status === 'in_corso') || projects[0];
            
            const button = event.target;
            const originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generazione...';
            button.disabled = true;
            
            // Raccogli contesto dal progetto
            const projectContext = await this.gatherProjectContext(project);
            
            // Genera contenuto con AI
            const content = await AIManager.generateReportContent(section, {
                ...project,
                context: projectContext
            });
            
            // Aggiorna textarea
            const textarea = document.getElementById(`report${section.charAt(0).toUpperCase() + section.slice(1)}`);
            if (textarea) {
                textarea.value = content;
                this.reportData[section] = content;
                await this.saveReportData();
                
                // Effetto highlight
                textarea.classList.add('highlight');
                setTimeout(() => textarea.classList.remove('highlight'), 1000);
            }
            
            button.innerHTML = originalText;
            button.disabled = false;
            
            showNotification('Contenuto generato con successo', 'success');
            
        } catch (error) {
            console.error('Errore generazione contenuto:', error);
            showNotification('Errore nella generazione del contenuto: ' + error.message, 'error');
            
            event.target.innerHTML = '<i class="fas fa-magic"></i> Genera con AI';
            event.target.disabled = false;
        }
    },
    
    async gatherProjectContext(project) {
        const context = {
            projectName: project.name,
            projectType: project.type,
            projectYear: project.year,
            description: project.description,
            team: [],
            documents: [],
            invoices: [],
            totalHours: 0,
            totalCost: 0
        };
        
        // Raccogli informazioni sul team
        if (window.TimesheetManager) {
            const allocations = TimesheetManager.getProjectAllocations(project.id);
            context.team = allocations.map(a => ({
                nome: a.employee.nome,
                ruolo: a.employee.qualifica,
                ore: a.hours,
                percentuale: a.percentage
            }));
            context.totalHours = TimesheetManager.calculateProjectHours(project.id);
            context.totalCost = TimesheetManager.calculateProjectCost(project.id);
        }
        
        // Raccogli documenti
        if (window.DocumentsManager) {
            context.documents = DocumentsManager.getDocumentsForProject(project.id);
            context.invoices = DocumentsManager.getInvoicesForProject(project.id);
        }
        
        return context;
    },
    
    renderCreditSummary() {
        const container = document.getElementById('creditSummary');
        if (!container) return;
        
        const projects = ProjectsManager.getAll();
        const employees = EmployeesManager.getAll();
        
        if (projects.length === 0 || employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state small">
                    <p>Aggiungi progetti e dipendenti per vedere il riepilogo</p>
                </div>
            `;
            return;
        }
        
        let totalCredit = 0;
        let totalCost = 0;
        let totalHours = 0;
        
        const summaryHTML = projects.map(project => {
            const cost = TimesheetManager.calculateProjectCost(project.id);
            const hours = TimesheetManager.calculateProjectHours(project.id);
            const creditRate = ProjectsManager.getCreditRate(project.type);
            const credit = cost * creditRate;
            const allocations = TimesheetManager.getProjectAllocations(project.id);
            
            totalCost += cost;
            totalCredit += credit;
            totalHours += hours;
            
            return `
                <div class="credit-card">
                    <h4>${Utils.escapeHtml(project.name) || 'Progetto'}</h4>
                    <div class="credit-details">
                        <div class="detail-row">
                            <span>Tipologia:</span>
                            <span>${ProjectsManager.getProjectTypeLabel(project.type)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Anno:</span>
                            <span>${project.year}</span>
                        </div>
                        <div class="detail-row">
                            <span>Stato:</span>
                            <span>${this.getStatusLabel(project.status)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Personale coinvolto:</span>
                            <span>${allocations.length} dipendenti</span>
                        </div>
                        <div class="detail-row">
                            <span>Ore totali:</span>
                            <span>${hours.toFixed(0)}h</span>
                        </div>
                        <div class="detail-row">
                            <span>Costo personale:</span>
                            <span>${Utils.formatCurrency(cost)}</span>
                        </div>
                        <div class="detail-row">
                            <span>Aliquota:</span>
                            <span>${(creditRate * 100).toFixed(0)}%</span>
                        </div>
                        <div class="detail-row highlight">
                            <span>Credito d'imposta:</span>
                            <span>${Utils.formatCurrency(credit)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Aggiungi fatture al totale
        const invoicesTotal = DocumentsManager.getTotalInvoicesAmount();
        totalCost += invoicesTotal;
        
        const totalHTML = `
            <div class="credit-card total">
                <h4>Totale Generale</h4>
                <div class="credit-details">
                    <div class="detail-row">
                        <span>Progetti:</span>
                        <span>${projects.length}</span>
                    </div>
                    <div class="detail-row">
                        <span>Dipendenti:</span>
                        <span>${employees.length}</span>
                    </div>
                    <div class="detail-row">
                        <span>Ore totali:</span>
                        <span>${totalHours.toFixed(0)}h</span>
                    </div>
                    <div class="detail-row">
                        <span>Costo personale:</span>
                        <span>${Utils.formatCurrency(totalCost - invoicesTotal)}</span>
                    </div>
                    <div class="detail-row">
                        <span>Costo fatture:</span>
                        <span>${Utils.formatCurrency(invoicesTotal)}</span>
                    </div>
                    <div class="detail-row">
                        <span>Costo totale:</span>
                        <span>${Utils.formatCurrency(totalCost)}</span>
                    </div>
                    <div class="detail-row highlight large">
                        <span>Credito totale stimato:</span>
                        <span>${Utils.formatCurrency(totalCredit)}</span>
                    </div>
                </div>
                
                <div class="warning-box mt-20">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Questo è un calcolo stimato. Consulta sempre un commercialista qualificato per la determinazione precisa del credito R&S.</p>
                </div>
            </div>
        `;
        
        container.innerHTML = summaryHTML + totalHTML;
    },
    
    getStatusLabel(status) {
        const labels = {
            'in_corso': 'In Corso',
            'completato': 'Completato',
            'sospeso': 'Sospeso'
        };
        return labels[status] || status;
    },
    
    async exportReport() {
        try {
            showLoading(true);
            showNotification('Generazione report in corso...', 'info');
            
            // Verifica dati
            if (!this.validateReportData()) {
                return;
            }
            
            const reportContent = await this.generateReportHTML();
            
            // Crea finestra di stampa
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Relazione Tecnica R&S</title>
                    <style>
                        ${this.getPrintStyles()}
                    </style>
                </head>
                <body>
                    ${reportContent}
                    <div class="no-print" style="text-align: center; margin-top: 40px;">
                        <button onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
                            📄 Stampa / Salva PDF
                        </button>
                        <button onclick="window.close()" style="padding: 10px 20px; font-size: 16px; cursor: pointer; margin-left: 10px;">
                            ❌ Chiudi
                        </button>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            
            showNotification('Report generato con successo', 'success');
            
        } catch (error) {
            console.error('Errore export:', error);
            showNotification('Errore durante l\'export: ' + error.message, 'error');
        } finally {
            showLoading(false);
        }
    },
    
    validateReportData() {
        const errors = [];
        
        if (!this.reportData.descrizione || this.reportData.descrizione.length < 50) {
            errors.push('La descrizione del progetto è troppo breve');
        }
        
        if (!this.reportData.incertezze || this.reportData.incertezze.length < 50) {
            errors.push('Le incertezze tecnologiche non sono sufficientemente descritte');
        }
        
        if (!this.reportData.innovazione || this.reportData.innovazione.length < 50) {
            errors.push('Gli elementi di innovazione non sono sufficientemente descritti');
        }
        
        if (!this.reportData.risultati || this.reportData.risultati.length < 50) {
            errors.push('I risultati ottenuti non sono sufficientemente descritti');
        }
        
        if (errors.length > 0) {
            showNotification('Completa tutti i campi della relazione:\n' + errors.join('\n'), 'warning');
            return false;
        }
        
        return true;
    },
    
    async generateReportHTML() {
        const profile = Auth.getProfile();
        const company = {
            name: profile?.company_name || 'Nome Azienda SRL',
            address: profile?.address || 'Via Example, 123',
            piva: profile?.vat_number || '12345678901'
        };
        
        const projects = ProjectsManager.getAll();
        const employees = EmployeesManager.getAll();
        
        let html = `
            <div class="header">
                <h1>RELAZIONE TECNICA</h1>
                <h2>Attività di Ricerca e Sviluppo</h2>
                <p>Art. 3 D.L. 145/2013 - Credito d'imposta R&S</p>
                <br>
                <p><strong>${Utils.escapeHtml(company.name)}</strong></p>
                <p>${Utils.escapeHtml(company.address)}</p>
                <p>P.IVA: ${Utils.escapeHtml(company.piva)}</p>
                <p>Anno di riferimento: ${new Date().getFullYear()}</p>
            </div>
            
            <div class="section">
                <h2>1. DESCRIZIONE DEI PROGETTI</h2>
                <p>${this.formatTextForReport(this.reportData.descrizione)}</p>
            </div>
            
            <div class="section">
                <h2>2. INCERTEZZE SCIENTIFICHE E TECNOLOGICHE</h2>
                <p>${this.formatTextForReport(this.reportData.incertezze)}</p>
            </div>
            
            <div class="section">
                <h2>3. ELEMENTI DI INNOVAZIONE</h2>
                <p>${this.formatTextForReport(this.reportData.innovazione)}</p>
            </div>
            
            <div class="section">
                <h2>4. RISULTATI OTTENUTI</h2>
                <p>${this.formatTextForReport(this.reportData.risultati)}</p>
            </div>
            
            <div class="section">
                <h2>5. PROGETTI DI RICERCA E SVILUPPO</h2>
                ${this.generateProjectsTable(projects)}
            </div>
            
            <div class="section">
                <h2>6. PERSONALE COINVOLTO</h2>
                ${this.generateEmployeesTable(employees)}
            </div>
            
            <div class="section">
                <h2>7. DETTAGLIO ALLOCAZIONI</h2>
                ${this.generateAllocationsDetail(projects, employees)}
            </div>
            
            <div class="section">
                <h2>8. RIEPILOGO SPESE</h2>
                ${this.generateExpensesSummary(projects)}
            </div>
            
            <div class="footer">
                <p>Data: ${new Date().toLocaleDateString('it-IT')}</p>
                <br><br>
                <div class="signature-box">
                    <p>_______________________________</p>
                    <p>Il Responsabile del Progetto</p>
                </div>
                <br><br>
                <div class="signature-box">
                    <p>_______________________________</p>
                    <p>Il Legale Rappresentante</p>
                </div>
            </div>
        `;
        
        return html;
    },
    
    formatTextForReport(text) {
        if (!text) return 'Da completare';
        
        // Preserva paragrafi
        return text
            .split('\n\n')
            .map(para => `<p>${Utils.escapeHtml(para)}</p>`)
            .join('');
    },
    
    generateProjectsTable(projects) {
        let totalHours = 0;
        let totalCost = 0;
        let totalCredit = 0;
        
        const rows = projects.map(project => {
            const hours = TimesheetManager.calculateProjectHours(project.id);
            const cost = TimesheetManager.calculateProjectCost(project.id);
            const creditRate = ProjectsManager.getCreditRate(project.type);
            const credit = cost * creditRate;
            
            totalHours += hours;
            totalCost += cost;
            totalCredit += credit;
            
            return `
                <tr>
                    <td>${Utils.escapeHtml(project.name)}</td>
                    <td>${ProjectsManager.getProjectTypeLabel(project.type)}</td>
                    <td>${project.year}</td>
                    <td>${hours.toFixed(0)}</td>
                    <td>€${cost.toFixed(2)}</td>
                    <td>${(creditRate * 100).toFixed(0)}%</td>
                    <td>€${credit.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
        
        return `
            <table>
                <thead>
                    <tr>
                        <th>Progetto</th>
                        <th>Tipologia</th>
                        <th>Anno</th>
                        <th>Ore</th>
                        <th>Costo Personale</th>
                        <th>Aliquota</th>
                        <th>Credito R&S</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="3">TOTALE</th>
                        <th>${totalHours.toFixed(0)}</th>
                        <th>€${totalCost.toFixed(2)}</th>
                        <th>-</th>
                        <th>€${totalCredit.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        `;
    },
    
    generateEmployeesTable(employees) {
        const rows = employees.map(emp => `
            <tr>
                <td>${Utils.escapeHtml(emp.nome)}</td>
                <td>${Utils.escapeHtml(emp.qualifica)}</td>
                <td>${emp.codiceFiscale || 'N/D'}</td>
                <td>${emp.oreAnnuali || 0}</td>
                <td>€${emp.costoOrario || 0}</td>
                <td>€${emp.costoAnnuale || 0}</td>
            </tr>
        `).join('');
        
        const totalCost = employees.reduce((sum, emp) => sum + (emp.costoAnnuale || 0), 0);
        
        return `
            <table>
                <thead>
                    <tr>
                        <th>Nome</th>
                        <th>Qualifica</th>
                        <th>Codice Fiscale</th>
                        <th>Ore Annuali</th>
                        <th>Costo Orario</th>
                        <th>Costo Annuale</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
                <tfoot>
                    <tr>
                        <th colspan="5">TOTALE COSTO PERSONALE</th>
                        <th>€${totalCost.toFixed(2)}</th>
                    </tr>
                </tfoot>
            </table>
        `;
    },
    
    generateAllocationsDetail(projects, employees) {
        let html = '';
        
        projects.forEach(project => {
            const allocations = TimesheetManager.getProjectAllocations(project.id);
            
            if (allocations.length > 0) {
                html += `
                    <h3>${Utils.escapeHtml(project.name)}</h3>
                    <table class="small-table">
                        <thead>
                            <tr>
                                <th>Dipendente</th>
                                <th>Ruolo</th>
                                <th>% Allocazione</th>
                                <th>Ore</th>
                                <th>Costo</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                allocations.forEach(alloc => {
                    html += `
                        <tr>
                            <td>${Utils.escapeHtml(alloc.employee.nome)}</td>
                            <td>${Utils.escapeHtml(alloc.employee.qualifica)}</td>
                            <td>${alloc.percentage}%</td>
                            <td>${alloc.hours.toFixed(0)}</td>
                            <td>€${alloc.cost.toFixed(2)}</td>
                        </tr>
                    `;
                });
                
                html += `
                        </tbody>
                    </table>
                `;
            }
        });
        
        return html || '<p>Nessuna allocazione definita</p>';
    },
    
    generateExpensesSummary(projects) {
        const invoicesTotal = DocumentsManager.getTotalInvoicesAmount();
        let laborTotal = 0;
        let creditTotal = 0;
        
        projects.forEach(project => {
            const cost = TimesheetManager.calculateProjectCost(project.id);
            const creditRate = ProjectsManager.getCreditRate(project.type);
            laborTotal += cost;
            creditTotal += cost * creditRate;
        });
        
        const grandTotal = laborTotal + invoicesTotal;
        
        return `
            <table>
                <tbody>
                    <tr>
                        <td>Costo del personale impiegato</td>
                        <td class="text-right">€${laborTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Spese per contratti di ricerca</td>
                        <td class="text-right">€0,00</td>
                    </tr>
                    <tr>
                        <td>Quote di ammortamento</td>
                        <td class="text-right">€0,00</td>
                    </tr>
                    <tr>
                        <td>Spese tecniche e altri costi</td>
                        <td class="text-right">€${invoicesTotal.toFixed(2)}</td>
                    </tr>
                    <tr class="total-row">
                        <td><strong>TOTALE SPESE R&S</strong></td>
                        <td class="text-right"><strong>€${grandTotal.toFixed(2)}</strong></td>
                    </tr>
                    <tr class="highlight-row">
                        <td><strong>CREDITO D'IMPOSTA STIMATO</strong></td>
                        <td class="text-right"><strong>€${creditTotal.toFixed(2)}</strong></td>
                    </tr>
                </tbody>
            </table>
        `;
    },
    
    getPrintStyles() {
        return `
            body { 
                font-family: Arial, sans-serif; 
                line-height: 1.6; 
                margin: 40px; 
                color: #333;
            }
            h1, h2, h3 { 
                color: #2c3e50; 
                margin-top: 20px;
            }
            h1 { 
                font-size: 24px; 
                text-align: center;
                margin-bottom: 10px;
            }
            h2 { 
                font-size: 18px; 
                border-bottom: 2px solid #3498db;
                padding-bottom: 5px;
            }
            h3 { 
                font-size: 16px; 
            }
            .header { 
                text-align: center; 
                margin-bottom: 40px;
                border-bottom: 3px double #333;
                padding-bottom: 20px;
            }
            .section { 
                margin-bottom: 30px; 
                page-break-inside: avoid; 
            }
            .footer { 
                text-align: center; 
                margin-top: 60px; 
                page-break-inside: avoid;
            }
            .signature-box {
                display: inline-block;
                margin: 0 40px;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 20px 0;
                font-size: 14px;
            }
            th, td { 
                border: 1px solid #ddd; 
                padding: 8px; 
                text-align: left; 
            }
            th { 
                background-color: #f5f5f5; 
                font-weight: bold;
            }
            .text-right { 
                text-align: right; 
            }
            .total-row td {
                border-top: 2px solid #333;
                font-weight: bold;
            }
            .highlight-row td {
                background-color: #e8f5e9;
                font-size: 16px;
            }
            .small-table {
                font-size: 12px;
                margin-bottom: 20px;
            }
            .warning-box {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                padding: 10px;
                margin: 20px 0;
                border-radius: 4px;
            }
            @media print { 
                .no-print { display: none; }
                body { margin: 20px; }
                .section { page-break-inside: avoid; }
                .header { page-break-after: avoid; }
                .footer { page-break-before: avoid; }
            }
        `;
    },
    
    async generateMISE() {
        showNotification('Generazione modello MISE in sviluppo. Sarà disponibile nella prossima versione.', 'info');
        
        // TODO: Implementare generazione modello ministeriale
        // - Form F&S
        // - Allegati richiesti
        // - Validazione secondo circolari ministeriali
    }
};

// Helper function globale
window.generateAIContent = (section) => ReportManager.generateAIContent(section);
window.exportReport = () => ReportManager.exportReport();
window.generateMISE = () => ReportManager.generateMISE();

// Export
window.ReportManager = ReportManager;