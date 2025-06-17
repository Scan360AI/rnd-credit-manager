// js/employees.js - Gestione dipendenti con DataExtractor e CostoAziendaCalculator

// Calcolatore Costo Azienda
const CostoAziendaCalculator = {
    // Calcola costo azienda da RAL
    calcolaFromRAL(ral, options = {}) {
        const opts = {
            inps: options.inps || 0.3309,        // 33.09% contributi INPS
            inail: options.inail || 0.01,        // 1% INAIL (varia per settore)
            tfr: options.tfr || 0.0741,          // 7.41% TFR
            altriCosti: options.altriCosti || 0.02, // 2% altri costi
            ...options
        };
        
        const contributiINPS = ral * opts.inps;
        const contributiINAIL = ral * opts.inail;
        const accantonamentoTFR = ral * opts.tfr;
        const altriCosti = ral * opts.altriCosti;
        
        const costoAzienda = ral + contributiINPS + contributiINAIL + accantonamentoTFR + altriCosti;
        
        return {
            ral: ral,
            contributiINPS: contributiINPS,
            contributiINAIL: contributiINAIL,
            tfr: accantonamentoTFR,
            altriCosti: altriCosti,
            costoTotale: costoAzienda,
            moltiplicatore: costoAzienda / ral,
            
            percentuali: {
                inps: (opts.inps * 100).toFixed(2) + '%',
                inail: (opts.inail * 100).toFixed(2) + '%',
                tfr: (opts.tfr * 100).toFixed(2) + '%',
                altri: (opts.altriCosti * 100).toFixed(2) + '%',
                totale: ((costoAzienda / ral - 1) * 100).toFixed(2) + '%'
            }
        };
    },
    
    // Calcolo rapido con moltiplicatore
    calcolaRapido(ral, moltiplicatore = 1.42) {
        return ral * moltiplicatore;
    },
    
    // Ottieni moltiplicatore per settore
    getMoltiplicatoreSettore(settore) {
        const moltiplicatori = {
            'commercio': 1.38,
            'industria': 1.42,
            'edilizia': 1.45,
            'servizi': 1.40,
            'IT': 1.41,
            'consulenza': 1.39,
            'default': 1.42
        };
        
        return moltiplicatori[settore] || moltiplicatori.default;
    }
};

// Data Extractor per l'analisi dei documenti
const DataExtractor = {
    showProgress(text) {
        const progressEl = document.getElementById('uploadProgress');
        if (!progressEl) return;
        
        const progressText = progressEl.querySelector('.progress-text');
        const progressFill = progressEl.querySelector('.progress-fill');
        
        progressEl.classList.remove('hidden');
        if (progressText) progressText.textContent = text;
        if (progressFill) progressFill.style.width = '50%';
    },
    
    hideProgress() {
        const progressEl = document.getElementById('uploadProgress');
        if (progressEl) {
            progressEl.classList.add('hidden');
        }
    },
    
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    },
    
    async extractFromPayslip(file) {
        try {
            this.showProgress('Analisi documento in corso...');
            
            const base64 = await this.fileToBase64(file);
            const mimeType = file.type || 'image/jpeg';
            
      // Controlla se AI è disponibile
if (!AIManager.isAvailable()) {
    console.log('AI non disponibile, modalità manuale');
    return [this.getManualTemplate(file.name)];
}
            
            // Analizza con AI
            if (mimeType === 'application/pdf') {
                return await this.extractFromPDFMultiPage(base64, file.name);
            } else {
                const data = await AIManager.extractPayslipData(base64, mimeType);
                return [this.processPayslipData(data, file.name)];
            }
            
        } catch (error) {
            this.hideProgress();
            console.error('Errore estrazione:', error);
            
            if (error.message === 'QUOTA_EXCEEDED' || error.message === 'DAILY_QUOTA_EXCEEDED') {
                showNotification('Quota API esaurita. Modalità manuale attivata.', 'warning');
                return [this.getManualTemplate(file.name)];
            }
            
            showNotification(`Errore nell'analisi di ${file.name}`, 'error');
            throw error;
        }
    },
    
    async extractFromPDFMultiPage(base64, fileName) {
        try {
            const data = await AIManager.extractPayslipData(base64, 'application/pdf');
            
            // Se l'AI restituisce un array di buste paga
            if (Array.isArray(data)) {
                return data.map(busta => 
                    this.processPayslipData(busta, `${fileName} - ${busta.mese}`)
                );
            } else {
                // Singola busta paga
                return [this.processPayslipData(data, fileName)];
            }
            
        } catch (error) {
            console.error('Errore analisi PDF:', error);
            throw error;
        }
    },
    
    processPayslipData(data, fileName) {
        const oreMensili = parseFloat(data?.ore_mensili) || 160;
        const retribuzioneLorda = parseFloat(data?.retribuzione_lorda) || 0;
        
        let costoAzienda = parseFloat(data?.costo_azienda) || 0;
        let costoCalcolato = false;
        
        // Se non c'è il costo azienda, calcolalo
        if (!costoAzienda && retribuzioneLorda > 0) {
            const ralAnnuale = retribuzioneLorda * 13; // Assumiamo 13 mensilità
            const calcolo = CostoAziendaCalculator.calcolaFromRAL(ralAnnuale);
            costoAzienda = calcolo.costoTotale / 13;
            costoCalcolato = true;
        }
        
        const costoOrario = oreMensili > 0 ? costoAzienda / oreMensili : 0;
        
        return {
            id: Utils.generateId('pay'),
            nome: data?.nome_completo || 'Nome non trovato',
            codiceFiscale: data?.codice_fiscale || '',
            qualifica: data?.qualifica || 'Dipendente',
            oreMensili: oreMensili,
            costoOrario: Math.round(costoOrario * 100) / 100,
            costoMensile: costoAzienda,
            retribuzioneLorda: retribuzioneLorda,
            costoCalcolato: costoCalcolato,
            mese: data?.mese || Utils.formatDate(new Date(), 'month'),
            fileName: fileName,
            dataCaricamento: new Date().toISOString()
        };
    },
    
    getManualTemplate(fileName) {
        return {
            id: Utils.generateId('pay'),
            nome: '',
            codiceFiscale: '',
            qualifica: '',
            oreMensili: 160,
            costoOrario: 0,
            costoMensile: 0,
            retribuzioneLorda: 0,
            mese: Utils.formatDate(new Date(), 'month'),
            fileName: fileName,
            dataCaricamento: new Date().toISOString(),
            manualMode: true
        };
    },
    
    async extractFromMultipleFiles(files) {
        const allPayslips = [];
        const errors = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            this.showProgress(`Analisi file ${i + 1} di ${files.length}: ${file.name}`);
            
            try {
                this.validatePayslipFile(file);
                
                const payslips = await this.extractFromPayslip(file);
                allPayslips.push(...payslips);
                
                // Delay tra richieste AI
                if (i < files.length - 1 && !document.getElementById('disableAI')?.checked) {
                    await Utils.sleep(4500);
                }
                
            } catch (error) {
                errors.push({
                    file: file.name,
                    error: error.message
                });
                
                if (error.message === 'QUOTA_EXCEEDED') {
                    document.getElementById('disableAI').checked = true;
                    const template = this.getManualTemplate(file.name);
                    allPayslips.push(template);
                }
            }
        }
        
        this.hideProgress();
        
        // Raggruppa per dipendente
        const groupedData = this.groupByEmployeeWithHistory(allPayslips);
        
        return {
            employees: groupedData,
            errors: errors
        };
    },
    
    groupByEmployeeWithHistory(payslips) {
        const grouped = {};
        
        payslips.forEach(payslip => {
            const key = payslip.codiceFiscale || payslip.nome;
            
            if (!grouped[key]) {
                grouped[key] = {
                    id: Utils.generateId('emp'),
                    nome: payslip.nome,
                    codiceFiscale: payslip.codiceFiscale,
                    qualifica: payslip.qualifica,
                    costoCalcolato: payslip.costoCalcolato || false,
                    storicoMensile: {},
                    oreMensiliMedia: 0,
                    oreAnnualiTotali: 0,
                    costoOrarioMedio: 0,
                    costoAnnuale: 0,
                    primoMese: payslip.mese,
                    ultimoMese: payslip.mese,
                    numeroMensilita: 0
                };
            }
            
            // Aggiungi al storico mensile
            grouped[key].storicoMensile[payslip.mese] = {
                ore: payslip.oreMensili,
                costoOrario: payslip.costoOrario,
                costoMensile: payslip.costoMensile,
                retribuzioneLorda: payslip.retribuzioneLorda,
                fileName: payslip.fileName
            };
            
            // Aggiorna dati
            if (payslip.qualifica) grouped[key].qualifica = payslip.qualifica;
            if (payslip.costoCalcolato) grouped[key].costoCalcolato = true;
            grouped[key].ultimoMese = payslip.mese;
        });
        
        // Calcola medie e totali
        Object.values(grouped).forEach(employee => {
            const mesi = Object.values(employee.storicoMensile);
            employee.numeroMensilita = mesi.length;
            
            let totaleOre = 0;
            let totaleCosto = 0;
            let sommaCostoOrario = 0;
            
            mesi.forEach(mese => {
                totaleOre += mese.ore;
                totaleCosto += mese.costoMensile;
                sommaCostoOrario += mese.costoOrario;
            });
            
            employee.oreAnnualiTotali = totaleOre;
            employee.oreMensiliMedia = Math.round(totaleOre / mesi.length);
            employee.costoOrarioMedio = Math.round((sommaCostoOrario / mesi.length) * 100) / 100;
            employee.costoAnnuale = totaleCosto;
            
            // Campi per compatibilità
            employee.oreAnnuali = employee.oreAnnualiTotali;
            employee.costoOrario = employee.costoOrarioMedio;
            employee.oreMensili = employee.oreMensiliMedia;
        });
        
        return Object.values(grouped);
    },
    
    validatePayslipFile(file) {
        const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const maxSize = 10 * 1024 * 1024; // 10MB
        
        if (!Utils.validateFileType(file, validTypes)) {
            throw new Error(`Formato file non supportato: ${file.type}`);
        }
        
        if (file.size > maxSize) {
            throw new Error('File troppo grande (max 10MB)');
        }
        
        return true;
    }
};

// Manager principale dipendenti
const EmployeesManager = {
    employees: [],
    isLoading: false,
    
    async init() {
        console.log('Inizializzazione Employees Manager...');
        await this.loadEmployees();
        this.setupEventListeners();
        this.render();
    },
    
    setupEventListeners() {
        const payslipInput = document.getElementById('payslipInput');
        if (payslipInput) {
            payslipInput.addEventListener('change', (e) => this.handlePayslipUpload(e));
        }
        
        const uploadArea = document.getElementById('payslipUpload');
        if (uploadArea) {
            uploadArea.addEventListener('click', () => {
                payslipInput.click();
            });
            
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = Array.from(e.dataTransfer.files);
                this.processPayslips(files);
            });
        }
    },
    
    async loadEmployees() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            this.isLoading = true;
            
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('full_name');
            
            if (error) throw error;
            
            // Formatta i dati per compatibilità
            this.employees = data.map(emp => ({
                id: emp.id,
                nome: emp.full_name,
                codiceFiscale: emp.fiscal_code,
                qualifica: emp.role,
                oreMensili: emp.monthly_hours,
                oreAnnuali: emp.annual_hours,
                costoOrario: emp.hourly_cost,
                costoAnnuale: emp.annual_cost,
                costoCalcolato: emp.cost_calculated,
                storicoMensile: emp.monthly_history || {},
                oreMensiliMedia: emp.average_monthly_hours || emp.monthly_hours,
                oreAnnualiTotali: emp.total_annual_hours || emp.annual_hours,
                costoOrarioMedio: emp.average_hourly_cost || emp.hourly_cost,
                numeroMensilita: emp.payslips_count || 0,
                primoMese: emp.first_month,
                ultimoMese: emp.last_month
            }));
            
            console.log(`Caricati ${this.employees.length} dipendenti`);
            
        } catch (error) {
            console.error('Errore caricamento dipendenti:', error);
            showNotification('Errore caricamento dipendenti', 'error');
        } finally {
            this.isLoading = false;
        }
    },
    
    async handlePayslipUpload(event) {
        const files = Array.from(event.target.files);
        await this.processPayslips(files);
        event.target.value = '';
    },
    
    async processPayslips(files) {
        try {
            const result = await DataExtractor.extractFromMultipleFiles(files);
            
            // Salva dipendenti nel database
            for (const emp of result.employees) {
                await this.addOrUpdateEmployee(emp);
            }
            
            if (result.errors.length > 0) {
                this.showErrors(result.errors);
            }
            
            await this.loadEmployees();
            this.render();
            
            // Aggiorna timesheet se esiste
            if (window.TimesheetManager) {
                TimesheetManager.render();
            }
            
            const totalPayslips = result.employees.reduce((sum, emp) => 
                sum + (emp.numeroMensilita || 1), 0
            );
            
            showNotification(`${result.employees.length} dipendenti elaborati (${totalPayslips} buste paga)!`, 'success');
            
        } catch (error) {
            console.error('Errore elaborazione:', error);
            showNotification('Errore: ' + error.message, 'error');
        }
    },
    
    async addOrUpdateEmployee(employeeData) {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            // Controlla se esiste già
            const { data: existing } = await supabase
                .from('employees')
                .select('id')
                .eq('user_id', userId)
                .eq('fiscal_code', employeeData.codiceFiscale)
                .single();
            
            const dbEmployee = {
                user_id: userId,
                full_name: employeeData.nome,
                fiscal_code: employeeData.codiceFiscale,
                role: employeeData.qualifica,
                monthly_hours: employeeData.oreMensiliMedia || employeeData.oreMensili,
                annual_hours: employeeData.oreAnnualiTotali || employeeData.oreAnnuali,
                hourly_cost: employeeData.costoOrarioMedio || employeeData.costoOrario,
                annual_cost: employeeData.costoAnnuale,
                cost_calculated: employeeData.costoCalcolato || false,
                monthly_history: employeeData.storicoMensile || {},
                average_monthly_hours: employeeData.oreMensiliMedia,
                total_annual_hours: employeeData.oreAnnualiTotali,
                average_hourly_cost: employeeData.costoOrarioMedio,
                payslips_count: employeeData.numeroMensilita || 1,
                first_month: employeeData.primoMese,
                last_month: employeeData.ultimoMese,
                is_active: true
            };
            
            if (existing) {
                // Aggiorna
                const { error } = await supabase
                    .from('employees')
                    .update(dbEmployee)
                    .eq('id', existing.id);
                
                if (error) throw error;
            } else {
                // Inserisci nuovo
                const { error } = await supabase
                    .from('employees')
                    .insert([dbEmployee]);
                
                if (error) throw error;
            }
            
        } catch (error) {
            console.error('Errore salvataggio dipendente:', error);
            throw error;
        }
    },
    
    async removeEmployee(id) {
        if (!confirm('Sicuro di voler rimuovere questo dipendente e tutto il suo storico?')) {
            return;
        }
        
        try {
            showLoading(true);
            
            // Soft delete
            const { error } = await supabase
                .from('employees')
                .update({ is_active: false })
                .eq('id', id);
            
            if (error) throw error;
            
            await this.loadEmployees();
            this.render();
            
            if (window.TimesheetManager) {
                TimesheetManager.render();
            }
            
            showNotification('Dipendente rimosso con successo', 'success');
            
        } catch (error) {
            console.error('Errore rimozione dipendente:', error);
            showNotification('Errore rimozione dipendente', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    async editEmployee(id) {
        const employee = this.employees.find(e => e.id === id);
        if (!employee) return;
        
        const modalBody = document.getElementById('modalBody');
        
        let modalContent = `
            <h3>Modifica Dipendente</h3>
            <div class="form-group">
                <label>Nome Completo</label>
                <input type="text" id="editNome" value="${Utils.escapeHtml(employee.nome)}">
            </div>
            <div class="form-group">
                <label>Codice Fiscale</label>
                <input type="text" id="editCF" value="${employee.codiceFiscale || ''}" maxlength="16">
            </div>
            <div class="form-group">
                <label>Qualifica</label>
                <input type="text" id="editQualifica" value="${Utils.escapeHtml(employee.qualifica)}">
            </div>
        `;
        
        // Se ha storico mensile
        if (employee.storicoMensile && Object.keys(employee.storicoMensile).length > 0) {
            modalContent += `
                <h4>Storico Mensile</h4>
                <div class="monthly-data-editor">
                    <table class="edit-monthly-table">
                        <thead>
                            <tr>
                                <th>Mese</th>
                                <th>Ore</th>
                                <th>Costo Orario</th>
                                <th>Costo Mensile</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            Object.entries(employee.storicoMensile).sort().forEach(([mese, dati]) => {
                modalContent += `
                    <tr data-month="${mese}">
                        <td>${mese}</td>
                        <td>
                            <input type="number" class="edit-ore" value="${dati.ore}" min="0" max="300">
                        </td>
                        <td>
                            <input type="number" class="edit-costo-orario" value="${dati.costoOrario}" 
                                   min="0" step="0.01">
                        </td>
                        <td>
                            <input type="number" class="edit-costo-mensile" value="${dati.costoMensile}" 
                                   min="0" step="0.01">
                        </td>
                        <td>
                            <button class="btn-icon" onclick="EmployeesManager.removeMonth('${id}', '${mese}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            modalContent += `
                        </tbody>
                    </table>
                    <button class="btn btn-secondary btn-sm" onclick="EmployeesManager.addMonth('${id}')">
                        <i class="fas fa-plus"></i> Aggiungi Mese
                    </button>
                </div>
            `;
        } else {
            modalContent += `
                <div class="form-group">
                    <label>Ore Mensili</label>
                    <input type="number" id="editOre" value="${employee.oreMensili || 160}">
                </div>
                <div class="form-group">
                    <label>Costo Orario (€)</label>
                    <input type="number" id="editCosto" value="${employee.costoOrario}" step="0.01">
                </div>
            `;
        }
        
        modalContent += `
            <div class="form-actions">
                <button class="btn btn-primary" onclick="EmployeesManager.saveEdit('${id}')">
                    <i class="fas fa-save"></i> Salva Modifiche
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">
                    Annulla
                </button>
            </div>
        `;
        
        modalBody.innerHTML = modalContent;
        document.getElementById('modal').classList.remove('hidden');
    },
    
    async saveEdit(id) {
        const employee = this.employees.find(e => e.id === id);
        if (!employee) return;
        
        try {
            showLoading(true);
            
            // Raccogli dati dal form
            employee.nome = document.getElementById('editNome').value;
            employee.codiceFiscale = document.getElementById('editCF')?.value || '';
            employee.qualifica = document.getElementById('editQualifica').value;
            
            // Se ha storico mensile
            if (employee.storicoMensile && Object.keys(employee.storicoMensile).length > 0) {
                document.querySelectorAll('.edit-monthly-table tbody tr').forEach(row => {
                    const mese = row.dataset.month;
                    if (mese && employee.storicoMensile[mese]) {
                        employee.storicoMensile[mese].ore = 
                            parseFloat(row.querySelector('.edit-ore').value) || 0;
                        employee.storicoMensile[mese].costoOrario = 
                            parseFloat(row.querySelector('.edit-costo-orario').value) || 0;
                        employee.storicoMensile[mese].costoMensile = 
                            parseFloat(row.querySelector('.edit-costo-mensile').value) || 0;
                    }
                });
                
                this.recalculateEmployeeAverages(employee);
            } else {
                employee.oreMensili = parseFloat(document.getElementById('editOre')?.value) || 160;
                employee.costoOrario = parseFloat(document.getElementById('editCosto')?.value) || 0;
                
                employee.oreAnnuali = employee.oreMensili * 12;
                employee.costoMensile = employee.oreMensili * employee.costoOrario;
                employee.costoAnnuale = employee.costoMensile * 12;
            }
            
            // Salva nel database
            await this.addOrUpdateEmployee(employee);
            await this.loadEmployees();
            this.render();
            
            if (window.TimesheetManager) {
                TimesheetManager.render();
            }
            
            closeModal();
            showNotification('Dipendente aggiornato con successo', 'success');
            
        } catch (error) {
            console.error('Errore salvataggio modifiche:', error);
            showNotification('Errore salvataggio modifiche', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    recalculateEmployeeAverages(employee) {
        const mesi = Object.values(employee.storicoMensile);
        employee.numeroMensilita = mesi.length;
        
        let totaleOre = 0;
        let totaleCosto = 0;
        let sommaCostoOrario = 0;
        
        mesi.forEach(mese => {
            totaleOre += mese.ore;
            totaleCosto += mese.costoMensile;
            sommaCostoOrario += mese.costoOrario;
        });
        
        employee.oreAnnualiTotali = totaleOre;
        employee.oreMensiliMedia = Math.round(totaleOre / mesi.length);
        employee.costoOrarioMedio = Math.round((sommaCostoOrario / mesi.length) * 100) / 100;
        employee.costoAnnuale = totaleCosto;
        
        // Campi per compatibilità
        employee.oreAnnuali = employee.oreAnnualiTotali;
        employee.costoOrario = employee.costoOrarioMedio;
        employee.oreMensili = employee.oreMensiliMedia;
    },
    
    removeMonth(employeeId, month) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee || !employee.storicoMensile) return;
        
        if (Object.keys(employee.storicoMensile).length <= 1) {
            showNotification('Non puoi rimuovere l\'ultimo mese. Rimuovi invece l\'intero dipendente.', 'warning');
            return;
        }
        
        delete employee.storicoMensile[month];
        this.recalculateEmployeeAverages(employee);
        
        this.editEmployee(employeeId);
    },
    
    addMonth(employeeId) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee || !employee.storicoMensile) return;
        
        const mesi = Object.keys(employee.storicoMensile).sort();
        const ultimoMese = mesi[mesi.length - 1];
        const [mm, yyyy] = ultimoMese.split('/');
        
        let nuovoMese = parseInt(mm) + 1;
        let nuovoAnno = parseInt(yyyy);
        
        if (nuovoMese > 12) {
            nuovoMese = 1;
            nuovoAnno++;
        }
        
        const nuovoMeseStr = `${nuovoMese.toString().padStart(2, '0')}/${nuovoAnno}`;
        
        const ultimiDati = employee.storicoMensile[ultimoMese];
        employee.storicoMensile[nuovoMeseStr] = {
            ore: ultimiDati.ore,
            costoOrario: ultimiDati.costoOrario,
            costoMensile: ultimiDati.costoMensile,
            retribuzioneLorda: ultimiDati.retribuzioneLorda || 0
        };
        
        this.recalculateEmployeeAverages(employee);
        
        this.editEmployee(employeeId);
    },
    
    showCostCalculator(employeeId) {
        const employee = this.employees.find(e => e.id === employeeId);
        if (!employee) return;
        
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h3>Calcolatore Costo Azienda - ${Utils.escapeHtml(employee.nome)}</h3>
            
            <div class="info-banner" style="margin-bottom: 20px;">
                <i class="fas fa-info-circle"></i>
                <div>
                    <strong>Formula Costo Azienda in Italia (2024)</strong><br>
                    Costo Azienda = RAL + Contributi INPS (33.09%) + INAIL (0.5-4%) + TFR (7.41%) + Altri costi<br>
                    <span class="small">Il moltiplicatore standard è circa 1.40-1.45 x RAL</span>
                </div>
            </div>
            
            <div class="calculator-form">
                <div class="form-group">
                    <label>RAL Annuale (€)</label>
                    <input type="number" id="calcRAL" placeholder="35000" step="1000">
                </div>
                
                <div class="form-group">
                    <label>Settore</label>
                    <select id="calcSettore" onchange="updateCalcolo()">
                        <option value="default">Standard</option>
                        <option value="commercio">Commercio</option>
                        <option value="industria">Industria</option>
                        <option value="edilizia">Edilizia</option>
                        <option value="servizi">Servizi</option>
                        <option value="IT">IT/Software</option>
                        <option value="consulenza">Consulenza</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="calcCustom" onchange="toggleCustomRates()">
                        Personalizza aliquote
                    </label>
                </div>
                
                <div id="customRates" style="display:none;">
                    <div class="form-group">
                        <label>INPS (%)</label>
                        <input type="number" id="calcINPS" value="33.09" step="0.01" onchange="updateCalcolo()">
                    </div>
                    <div class="form-group">
                        <label>INAIL (%)</label>
                        <input type="number" id="calcINAIL" value="1.00" step="0.01" onchange="updateCalcolo()">
                    </div>
                    <div class="form-group">
                        <label>TFR (%)</label>
                        <input type="number" id="calcTFR" value="7.41" step="0.01" onchange="updateCalcolo()">
                    </div>
                    <div class="form-group">
                        <label>Altri costi (%)</label>
                        <input type="number" id="calcAltri" value="2.00" step="0.01" onchange="updateCalcolo()">
                    </div>
                </div>
                
                <div id="calcoloRisultato" class="calculation-result">
                    <p>Inserisci la RAL per vedere il calcolo</p>
                </div>
            </div>
            
            <div class="form-actions">
                <button class="btn btn-primary" onclick="applyCostoCalcolato('${employeeId}')">
                    Applica Costo Calcolato
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">
                    Chiudi
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
        
        document.getElementById('calcRAL').addEventListener('input', updateCalcolo);
    },
    
    showHistory(id) {
        const employee = this.employees.find(e => e.id === id);
        if (!employee || !employee.storicoMensile) return;
        
        const modalBody = document.getElementById('modalBody');
        
        let html = `
            <h3>Storico ${Utils.escapeHtml(employee.nome)}</h3>
            <div class="history-chart">
                <canvas id="historyChart" width="600" height="300"></canvas>
            </div>
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Mese</th>
                        <th>Ore</th>
                        <th>Costo Orario</th>
                        <th>Costo Mensile</th>
                        <th>Retribuzione Lorda</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        const mesi = Object.entries(employee.storicoMensile).sort();
        mesi.forEach(([mese, dati]) => {
            html += `
                <tr>
                    <td>${mese}</td>
                    <td>${dati.ore}h</td>
                    <td>€${dati.costoOrario.toFixed(2)}</td>
                    <td>€${dati.costoMensile.toFixed(2)}</td>
                    <td>€${(dati.retribuzioneLorda || 0).toFixed(2)}</td>
                </tr>
            `;
        });
        
        html += `
                </tbody>
            </table>
            <div class="form-actions">
                <button class="btn btn-secondary" onclick="closeModal()">Chiudi</button>
            </div>
        `;
        
        modalBody.innerHTML = html;
        document.getElementById('modal').classList.remove('hidden');
        
        setTimeout(() => this.drawHistoryChart(employee), 100);
    },
    
    drawHistoryChart(employee) {
        const canvas = document.getElementById('historyChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const mesi = Object.entries(employee.storicoMensile).sort();
        
        const padding = 40;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;
        
        const oreValues = mesi.map(m => m[1].ore);
        const maxOre = Math.max(...oreValues);
        const minOre = Math.min(...oreValues);
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Assi
        ctx.strokeStyle = '#ddd';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Linea dati
        ctx.strokeStyle = '#3498db';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        mesi.forEach((m, i) => {
            const x = padding + (i / (mesi.length - 1)) * width;
            const y = canvas.height - padding - ((m[1].ore - minOre) / (maxOre - minOre)) * height;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            
            // Punto
            ctx.fillStyle = '#3498db';
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
            
            // Label mese
            ctx.fillStyle = '#666';
            ctx.font = '10px Arial';
            ctx.save();
            ctx.translate(x, canvas.height - padding + 15);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(m[0], 0, 0);
            ctx.restore();
        });
        
        ctx.stroke();
        
        // Titolo
        ctx.fillStyle = '#333';
        ctx.font = '14px Arial';
        ctx.fillText('Ore mensili', padding + 10, padding - 10);
    },
    
    render() {
        const container = document.getElementById('employeesList');
        if (!container) return;
        
        if (this.isLoading) {
            container.innerHTML = '<div class="loading">Caricamento dipendenti...</div>';
            return;
        }
        
        if (this.employees.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>Nessun dipendente registrato</p>
                    <p class="small">Carica le buste paga per iniziare</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.employees.map(emp => {
            const hasHistory = emp.storicoMensile && Object.keys(emp.storicoMensile).length > 0;
            
            return `
                <div class="employee-card ${hasHistory ? 'has-history' : ''}">
                    <div class="employee-header">
                        <h4>${Utils.escapeHtml(emp.nome)}</h4>
                        <div class="employee-actions">
                            <button class="btn-icon" onclick="EmployeesManager.editEmployee('${emp.id}')" 
                                    title="Modifica">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${hasHistory ? `
                            <button class="btn-icon" onclick="EmployeesManager.showHistory('${emp.id}')" 
                                    title="Visualizza storico">
                                <i class="fas fa-history"></i>
                            </button>
                            ` : ''}
                            <button class="btn-icon" onclick="EmployeesManager.removeEmployee('${emp.id}')" 
                                    title="Rimuovi">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    <div class="employee-info">
                        <p><strong>Qualifica:</strong> ${Utils.escapeHtml(emp.qualifica)}</p>
                        <p><strong>CF:</strong> ${emp.codiceFiscale || 'N/D'}</p>
                        ${hasHistory ? `
                            <p><strong>Periodo:</strong> ${emp.primoMese} - ${emp.ultimoMese}</p>
                            <p><strong>Mensilità:</strong> ${emp.numeroMensilita}</p>
                            <p><strong>Ore totali:</strong> ${emp.oreAnnualiTotali}h 
                               (media ${emp.oreMensiliMedia}h/mese)</p>
                            <p><strong>Costo orario medio:</strong> €${emp.costoOrarioMedio} 
                           <span class="small">(costo azienda)</span></p>
                        ` : `
                            <p><strong>Ore/mese:</strong> ${emp.oreMensili}h</p>
                            <p><strong>Costo orario:</strong> €${emp.costoOrario} 
                               <span class="small">(costo azienda)</span></p>
                        `}
                        <p><strong>Costo azienda annuale:</strong> ${Utils.formatCurrency(emp.costoAnnuale || 0)}
                           ${emp.costoCalcolato ? '<span class="small" style="color: #f39c12;"> (stimato)</span>' : ''}
                           <button class="cost-calculator-btn" onclick="EmployeesManager.showCostCalculator('${emp.id}')" 
                                   title="Calcola costo azienda">
                               <i class="fas fa-calculator"></i>
                           </button>
                        </p>
                    </div>
                    ${hasHistory ? `
                    <div class="employee-badge">
                        <i class="fas fa-chart-line"></i>
                        ${emp.numeroMensilita} mesi di storico
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    },
    
    showErrors(errors) {
        const errorMsg = errors.map(e => `${e.file}: ${e.error}`).join('\n');
        showNotification('Errori durante l\'elaborazione:\n' + errorMsg, 'error');
    },
    
    // Metodi di accesso pubblici
    getAll() {
        return this.employees;
    },
    
    getById(id) {
        return this.employees.find(e => e.id === id);
    },
    
    getTotalAnnualCost() {
        return this.employees.reduce((sum, emp) => sum + (emp.costoAnnuale || 0), 0);
    }
};

// Helper functions globali per il calcolatore
window.updateCalcolo = function() {
    const ral = parseFloat(document.getElementById('calcRAL').value) || 0;
    if (ral <= 0) {
        document.getElementById('calcoloRisultato').innerHTML = '<p>Inserisci la RAL per vedere il calcolo</p>';
        return;
    }
    
    let options = {};
    
    if (document.getElementById('calcCustom').checked) {
        options.inps = parseFloat(document.getElementById('calcINPS').value) / 100;
        options.inail = parseFloat(document.getElementById('calcINAIL').value) / 100;
        options.tfr = parseFloat(document.getElementById('calcTFR').value) / 100;
        options.altriCosti = parseFloat(document.getElementById('calcAltri').value) / 100;
    } else {
        const settore = document.getElementById('calcSettore').value;
        const moltiplicatore = CostoAziendaCalculator.getMoltiplicatoreSettore(settore);
        options.inps = 0.3309;
        options.inail = settore === 'edilizia' ? 0.04 : 0.01;
    }
    
    const calcolo = CostoAziendaCalculator.calcolaFromRAL(ral, options);
    
    document.getElementById('calcoloRisultato').innerHTML = `
        <h4>Risultato Calcolo</h4>
        <table class="calc-table">
            <tr>
                <td>RAL:</td>
                <td class="text-right">€${ral.toFixed(2)}</td>
            </tr>
            <tr>
                <td>Contributi INPS (${calcolo.percentuali.inps}):</td>
                <td class="text-right">€${calcolo.contributiINPS.toFixed(2)}</td>
            </tr>
            <tr>
                <td>Contributi INAIL (${calcolo.percentuali.inail}):</td>
                <td class="text-right">€${calcolo.contributiINAIL.toFixed(2)}</td>
            </tr>
            <tr>
                <td>TFR (${calcolo.percentuali.tfr}):</td>
                <td class="text-right">€${calcolo.tfr.toFixed(2)}</td>
            </tr>
            <tr>
                <td>Altri costi (${calcolo.percentuali.altri}):</td>
                <td class="text-right">€${calcolo.altriCosti.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
                <td><strong>COSTO AZIENDA:</strong></td>
                <td class="text-right"><strong>€${calcolo.costoTotale.toFixed(2)}</strong></td>
            </tr>
            <tr>
                <td>Moltiplicatore:</td>
                <td class="text-right">${calcolo.moltiplicatore.toFixed(3)}</td>
            </tr>
        </table>
        
        <div class="monthly-calc">
            <p><strong>Costo mensile (su 13 mensilità):</strong> €${(calcolo.costoTotale / 13).toFixed(2)}</p>
            <p><strong>Costo orario (1720h/anno):</strong> €${(calcolo.costoTotale / 1720).toFixed(2)}</p>
        </div>
    `;
};

window.toggleCustomRates = function() {
    const customDiv = document.getElementById('customRates');
    customDiv.style.display = document.getElementById('calcCustom').checked ? 'block' : 'none';
    updateCalcolo();
};

window.applyCostoCalcolato = async function(employeeId) {
    const ral = parseFloat(document.getElementById('calcRAL').value) || 0;
    if (ral <= 0) {
        showNotification('Inserisci prima la RAL', 'warning');
        return;
    }
    
    let options = {};
    if (document.getElementById('calcCustom').checked) {
        options.inps = parseFloat(document.getElementById('calcINPS').value) / 100;
        options.inail = parseFloat(document.getElementById('calcINAIL').value) / 100;
        options.tfr = parseFloat(document.getElementById('calcTFR').value) / 100;
        options.altriCosti = parseFloat(document.getElementById('calcAltri').value) / 100;
    }
    
    const calcolo = CostoAziendaCalculator.calcolaFromRAL(ral, options);
    const costoMensile = calcolo.costoTotale / 13;
    const costoOrario = calcolo.costoTotale / 1720;
    
    const employee = EmployeesManager.employees.find(e => e.id === employeeId);
    if (employee) {
        employee.costoOrario = Math.round(costoOrario * 100) / 100;
        employee.costoAnnuale = calcolo.costoTotale;
        employee.costoCalcolato = false;
        
        if (employee.storicoMensile) {
            Object.keys(employee.storicoMensile).forEach(mese => {
                employee.storicoMensile[mese].costoOrario = employee.costoOrario;
                employee.storicoMensile[mese].costoMensile = costoMensile;
            });
        }
        
        await EmployeesManager.addOrUpdateEmployee(employee);
        await EmployeesManager.loadEmployees();
        EmployeesManager.render();
        
        if (window.TimesheetManager) {
            TimesheetManager.render();
        }
        
        closeModal();
        showNotification('Costo azienda aggiornato con successo!', 'success');
    }
};

// Export
window.EmployeesManager = EmployeesManager;
window.DataExtractor = DataExtractor;
window.CostoAziendaCalculator = CostoAziendaCalculator;
