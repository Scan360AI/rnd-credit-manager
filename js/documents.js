// js/documents.js - Gestione Documenti e Fatture

const DocumentsManager = {
    invoices: [],
    otherDocs: [],
    isLoading: false,
    
    async init() {
        console.log('Inizializzazione Documents Manager...');
        this.setupEventListeners();
        await this.loadDocuments();
        this.render();
    },
    
    setupEventListeners() {
        // Invoice upload
        const invoiceInput = document.getElementById('invoiceInput');
        const invoiceUpload = document.getElementById('invoiceUpload');
        
        if (invoiceInput) {
            invoiceInput.addEventListener('change', (e) => {
                this.handleInvoiceUpload(e.target.files);
            });
        }
        
        if (invoiceUpload) {
            invoiceUpload.addEventListener('click', () => {
                invoiceInput.click();
            });
            
            invoiceUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                invoiceUpload.classList.add('dragover');
            });
            
            invoiceUpload.addEventListener('dragleave', () => {
                invoiceUpload.classList.remove('dragover');
            });
            
            invoiceUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                invoiceUpload.classList.remove('dragover');
                this.handleInvoiceUpload(e.dataTransfer.files);
            });
        }
        
        // Other documents upload
        const otherDocsInput = document.getElementById('otherDocsInput');
        const otherDocsUpload = document.getElementById('otherDocsUpload');
        
        if (otherDocsInput) {
            otherDocsInput.addEventListener('change', (e) => {
                this.handleOtherDocsUpload(e.target.files);
            });
        }
        
        if (otherDocsUpload) {
            otherDocsUpload.addEventListener('click', () => {
                otherDocsInput.click();
            });
            
            otherDocsUpload.addEventListener('dragover', (e) => {
                e.preventDefault();
                otherDocsUpload.classList.add('dragover');
            });
            
            otherDocsUpload.addEventListener('dragleave', () => {
                otherDocsUpload.classList.remove('dragover');
            });
            
            otherDocsUpload.addEventListener('drop', (e) => {
                e.preventDefault();
                otherDocsUpload.classList.remove('dragover');
                this.handleOtherDocsUpload(e.dataTransfer.files);
            });
        }
    },
    
    async loadDocuments() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;
        
        try {
            this.isLoading = true;
            
            // Carica fatture
            const { data: invoicesData, error: invoicesError } = await supabase
                .from('invoices')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('date', { ascending: false });
            
            if (invoicesError) throw invoicesError;
            
            this.invoices = invoicesData.map(inv => ({
                id: inv.id,
                fileName: inv.file_name,
                numero: inv.invoice_number,
                data: inv.date,
                fornitore: inv.supplier,
                importo: inv.amount,
                descrizione: inv.description,
                ammissibile: inv.is_eligible,
                motivazione: inv.eligibility_reason,
                fileUrl: inv.file_url,
                uploadDate: inv.uploaded_at,
                projectId: inv.project_id
            }));
            
            // Carica altri documenti
            const { data: docsData, error: docsError } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('uploaded_at', { ascending: false });
            
            if (docsError) throw docsError;
            
            this.otherDocs = docsData.filter(doc => doc.document_type !== 'invoice').map(doc => ({
                id: doc.id,
                fileName: doc.file_name,
                fileSize: doc.file_size,
                type: doc.document_type,
                fileUrl: doc.file_url,
                uploadDate: doc.uploaded_at,
                projectId: doc.project_id
            }));
            
            console.log(`Caricati ${this.invoices.length} fatture e ${this.otherDocs.length} documenti`);
            
        } catch (error) {
            console.error('Errore caricamento documenti:', error);
            showNotification('Errore caricamento documenti', 'error');
        } finally {
            this.isLoading = false;
        }
    },
    
    async handleInvoiceUpload(files) {
        const fileArray = Array.from(files);
        const processedInvoices = [];
        
        for (const file of fileArray) {
            try {
                if (!this.validateFile(file, 'invoice')) {
                    continue;
                }
                
                showLoading(true);
                showNotification(`Caricamento ${file.name}...`, 'info');
                
                // Upload su Supabase Storage
                const fileUrl = await this.uploadToStorage(file, 'invoices');
                
                // Analizza con AI se disponibile
                let invoiceData = {
                    numero: '',
                    data: new Date().toISOString().split('T')[0],
                    fornitore: '',
                    importo: 0,
                    descrizione: '',
                    ammissibile: false,
                    motivazione: 'Da verificare manualmente'
                };
                
                if (AIManager.apiKey && !document.getElementById('disableAI')?.checked) {
                    try {
                        const base64 = await Utils.blobToBase64(file);
                        const analysis = await AIManager.analyzeDocument(
                            base64.split(',')[1], 
                            file.type, 
                            'invoice'
                        );
                        
                        // Estrai dati strutturati dall'analisi
                        invoiceData = this.parseInvoiceAnalysis(analysis, invoiceData);
                    } catch (error) {
                        console.error('Errore analisi AI:', error);
                    }
                }
                
                // Salva nel database
                const savedInvoice = await this.saveInvoice({
                    ...invoiceData,
                    fileName: file.name,
                    fileUrl: fileUrl
                });
                
                if (savedInvoice) {
                    processedInvoices.push(savedInvoice);
                }
                
            } catch (error) {
                console.error('Errore processamento fattura:', error);
                showNotification(`Errore con ${file.name}: ${error.message}`, 'error');
            } finally {
                showLoading(false);
            }
        }
        
        if (processedInvoices.length > 0) {
            await this.loadDocuments();
            this.render();
            showNotification(`${processedInvoices.length} fatture caricate`, 'success');
        }
    },
    
    async handleOtherDocsUpload(files) {
        const fileArray = Array.from(files);
        const newDocs = [];
        
        for (const file of fileArray) {
            if (this.validateFile(file, 'document')) {
                try {
                    showLoading(true);
                    showNotification(`Caricamento ${file.name}...`, 'info');
                    
                    // Upload su Supabase Storage
                    const fileUrl = await this.uploadToStorage(file, 'documents');
                    
                    // Salva nel database
                    const savedDoc = await this.saveDocument({
                        fileName: file.name,
                        fileSize: file.size,
                        type: this.getDocumentType(file),
                        fileUrl: fileUrl
                    });
                    
                    if (savedDoc) {
                        newDocs.push(savedDoc);
                        
                        // Analizza contenuto in background se AI disponibile
                        if (AIManager.apiKey && !document.getElementById('disableAI')?.checked) {
                            this.analyzeDocumentInBackground(savedDoc.id, file);
                        }
                    }
                    
                } catch (error) {
                    console.error('Errore caricamento documento:', error);
                    showNotification(`Errore con ${file.name}`, 'error');
                } finally {
                    showLoading(false);
                }
            }
        }
        
        if (newDocs.length > 0) {
            await this.loadDocuments();
            this.render();
            showNotification(`${newDocs.length} documenti caricati`, 'success');
        }
    },
    
    async uploadToStorage(file, bucket) {
        const userId = Auth.getUser()?.id;
        if (!userId) throw new Error('Utente non autenticato');
        
        // Genera nome file univoco
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        // Upload su Supabase Storage
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });
        
        if (error) throw error;
        
        // Ottieni URL pubblico
        const { data: { publicUrl } } = supabase.storage
            .from(bucket)
            .getPublicUrl(fileName);
        
        return publicUrl;
    },
    
    async saveInvoice(invoiceData) {
        const userId = Auth.getUser()?.id;
        if (!userId) return null;
        
        try {
            const { data, error } = await supabase
                .from('invoices')
                .insert({
                    user_id: userId,
                    file_name: invoiceData.fileName,
                    file_url: invoiceData.fileUrl,
                    invoice_number: invoiceData.numero,
                    date: invoiceData.data,
                    supplier: invoiceData.fornitore,
                    amount: invoiceData.importo,
                    description: invoiceData.descrizione,
                    is_eligible: invoiceData.ammissibile,
                    eligibility_reason: invoiceData.motivazione,
                    is_active: true
                })
                .select()
                .single();
            
            if (error) throw error;
            
            return {
                id: data.id,
                fileName: data.file_name,
                numero: data.invoice_number,
                data: data.date,
                fornitore: data.supplier,
                importo: data.amount,
                descrizione: data.description,
                ammissibile: data.is_eligible,
                motivazione: data.eligibility_reason,
                fileUrl: data.file_url,
                uploadDate: data.uploaded_at
            };
            
        } catch (error) {
            console.error('Errore salvataggio fattura:', error);
            throw error;
        }
    },
    
    async saveDocument(docData) {
        const userId = Auth.getUser()?.id;
        if (!userId) return null;
        
        try {
            const { data, error } = await supabase
                .from('documents')
                .insert({
                    user_id: userId,
                    file_name: docData.fileName,
                    file_url: docData.fileUrl,
                    file_size: docData.fileSize,
                    mime_type: docData.mimeType,
                    document_type: docData.type,
                    is_active: true
                })
                .select()
                .single();
            
            if (error) throw error;
            
            return {
                id: data.id,
                fileName: data.file_name,
                fileSize: data.file_size,
                type: data.document_type,
                fileUrl: data.file_url,
                uploadDate: data.uploaded_at
            };
            
        } catch (error) {
            console.error('Errore salvataggio documento:', error);
            throw error;
        }
    },
    
    async analyzeDocumentInBackground(documentId, file) {
        try {
            const base64 = await Utils.blobToBase64(file);
            const analysis = await AIManager.analyzeDocument(
                base64.split(',')[1],
                file.type,
                'generic'
            );
            
            // Salva l'analisi
            await AIManager.saveDocumentAnalysis(documentId, analysis);
            
        } catch (error) {
            console.error('Errore analisi documento in background:', error);
        }
    },
    
    parseInvoiceAnalysis(analysis, defaults) {
        // Cerca pattern comuni nei documenti fiscali italiani
        const patterns = {
            numero: /(?:fattura|invoice|documento)\s*n[°.]?\s*(\S+)/i,
            data: /(?:data|date)\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            fornitore: /(?:fornitore|supplier|ragione sociale)\s*:?\s*([^\n]+)/i,
            importo: /(?:totale|total|importo)\s*€?\s*([\d.,]+)/i
        };
        
        const result = { ...defaults };
        
        // Estrai numero fattura
        const numeroMatch = analysis.match(patterns.numero);
        if (numeroMatch) result.numero = numeroMatch[1];
        
        // Estrai data
        const dataMatch = analysis.match(patterns.data);
        if (dataMatch) {
            const date = this.parseDate(dataMatch[1]);
            if (date) result.data = date;
        }
        
        // Estrai fornitore
        const fornitoreMatch = analysis.match(patterns.fornitore);
        if (fornitoreMatch) result.fornitore = fornitoreMatch[1].trim();
        
        // Estrai importo
        const importoMatch = analysis.match(patterns.importo);
        if (importoMatch) {
            const importo = parseFloat(importoMatch[1].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(importo)) result.importo = importo;
        }
        
        // Determina ammissibilità base su keywords
        const eligibleKeywords = ['ricerca', 'sviluppo', 'r&s', 'innovazione', 'consulenza tecnica', 'prototipo'];
        const isEligible = eligibleKeywords.some(keyword => 
            analysis.toLowerCase().includes(keyword)
        );
        
        if (isEligible) {
            result.ammissibile = true;
            result.motivazione = 'Rilevate keywords R&S nel documento';
        }
        
        return result;
    },
    
    parseDate(dateStr) {
        // Prova diversi formati di data
        const formats = [
            /(\d{2})\/(\d{2})\/(\d{4})/,  // DD/MM/YYYY
            /(\d{2})-(\d{2})-(\d{4})/,    // DD-MM-YYYY
            /(\d{4})-(\d{2})-(\d{2})/     // YYYY-MM-DD
        ];
        
        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                if (match[1].length === 4) {
                    // YYYY-MM-DD
                    return `${match[1]}-${match[2]}-${match[3]}`;
                } else {
                    // DD/MM/YYYY o DD-MM-YYYY
                    return `${match[3]}-${match[2]}-${match[1]}`;
                }
            }
        }
        
        return null;
    },
    
    validateFile(file, type) {
        const formats = type === 'invoice' ? 
            ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'] :
            ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 
             'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        
        if (!Utils.validateFileType(file, formats)) {
            showNotification(`Formato non supportato: ${file.name}`, 'error');
            return false;
        }
        
        if (file.size > 10 * 1024 * 1024) {
            showNotification(`File troppo grande: ${file.name} (max 10MB)`, 'error');
            return false;
        }
        
        return true;
    },
    
    renderInvoices() {
        const container = document.getElementById('invoicesList');
        if (!container) return;
        
        if (this.isLoading) {
            container.innerHTML = '<div class="loading">Caricamento fatture...</div>';
            return;
        }
        
        if (this.invoices.length === 0) {
            container.innerHTML = '<p class="empty-state small">Nessuna fattura caricata</p>';
            return;
        }
        
        const ammissibili = this.invoices.filter(i => i.ammissibile);
        const nonAmmissibili = this.invoices.filter(i => !i.ammissibile);
        
        let html = '';
        
        if (ammissibili.length > 0) {
            html += '<h4 class="doc-category">Fatture Ammissibili</h4>';
            html += ammissibili.map(inv => this.renderInvoiceCard(inv, true)).join('');
        }
        
        if (nonAmmissibili.length > 0) {
            html += '<h4 class="doc-category">Fatture Non Ammissibili / Da Verificare</h4>';
            html += nonAmmissibili.map(inv => this.renderInvoiceCard(inv, false)).join('');
        }
        
        const totaleAmmissibile = ammissibili.reduce((sum, inv) => sum + (inv.importo || 0), 0);
        html += `
            <div class="invoice-total">
                <strong>Totale Ammissibile: ${Utils.formatCurrency(totaleAmmissibile)}</strong>
            </div>
        `;
        
        container.innerHTML = html;
    },
    
    renderInvoiceCard(invoice, isAmmissibile) {
        return `
            <div class="document-item ${isAmmissibile ? 'ammissibile' : 'non-ammissibile'}">
                <div class="doc-icon">
                    <i class="fas fa-file-invoice"></i>
                </div>
                <div class="doc-info">
                    <div class="doc-title">${Utils.escapeHtml(invoice.fileName)}</div>
                    <div class="doc-details">
                        ${invoice.numero ? `N. ${Utils.escapeHtml(invoice.numero)} - ` : ''}
                        ${Utils.escapeHtml(invoice.fornitore || 'Fornitore N/D')} - 
                        ${Utils.formatCurrency(invoice.importo || 0)}
                    </div>
                    <div class="doc-meta">
                        ${Utils.formatDate(invoice.data)} - 
                        <span class="${isAmmissibile ? 'text-success' : 'text-danger'}">
                            ${isAmmissibile ? '✅ Ammissibile' : '❌ Non ammissibile'}
                        </span>
                        ${invoice.motivazione ? ` - ${Utils.escapeHtml(invoice.motivazione)}` : ''}
                    </div>
                </div>
                <div class="doc-actions">
                    <button class="btn-icon" onclick="DocumentsManager.editInvoice('${invoice.id}')" title="Modifica">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon" onclick="DocumentsManager.downloadDocument('${invoice.fileUrl}', '${invoice.fileName}')" title="Scarica">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="DocumentsManager.removeInvoice('${invoice.id}')" title="Rimuovi">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    renderOtherDocs() {
        const container = document.getElementById('otherDocsList');
        if (!container) return;
        
        if (this.isLoading) {
            container.innerHTML = '<div class="loading">Caricamento documenti...</div>';
            return;
        }
        
        if (this.otherDocs.length === 0) {
            container.innerHTML = '<p class="empty-state small">Nessun documento caricato</p>';
            return;
        }
        
        const grouped = this.groupDocsByType();
        
        let html = '';
        Object.entries(grouped).forEach(([type, docs]) => {
            html += `<h4 class="doc-category">${this.getTypeLabel(type)}</h4>`;
            html += docs.map(doc => this.renderDocumentCard(doc)).join('');
        });
        
        container.innerHTML = html;
    },
    
    renderDocumentCard(doc) {
        return `
            <div class="document-item">
                <div class="doc-icon">
                    ${this.getDocIcon(doc.type)}
                </div>
                <div class="doc-info">
                    <div class="doc-title">${Utils.escapeHtml(doc.fileName)}</div>
                    <div class="doc-meta">
                        ${Utils.formatFileSize(doc.fileSize)} - ${Utils.formatDate(doc.uploadDate)}
                    </div>
                </div>
                <div class="doc-actions">
                    <button class="btn-icon" onclick="DocumentsManager.downloadDocument('${doc.fileUrl}', '${doc.fileName}')" title="Scarica">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn-icon" onclick="DocumentsManager.removeDoc('${doc.id}')" title="Rimuovi">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },
    
    render() {
        this.renderInvoices();
        this.renderOtherDocs();
    },
    
    async editInvoice(id) {
        const invoice = this.invoices.find(i => i.id === id);
        if (!invoice) return;
        
        const modal = document.getElementById('modal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h3>Modifica Fattura</h3>
            <div class="form-group">
                <label>Numero Fattura</label>
                <input type="text" id="editNumero" value="${invoice.numero || ''}">
            </div>
            <div class="form-group">
                <label>Fornitore</label>
                <input type="text" id="editFornitore" value="${invoice.fornitore || ''}">
            </div>
            <div class="form-group">
                <label>Data</label>
                <input type="date" id="editData" value="${invoice.data || ''}">
            </div>
            <div class="form-group">
                <label>Importo (€)</label>
                <input type="number" id="editImporto" value="${invoice.importo || 0}" step="0.01">
            </div>
            <div class="form-group">
                <label>Descrizione</label>
                <textarea id="editDescrizione" rows="3">${invoice.descrizione || ''}</textarea>
            </div>
            <div class="form-group">
                <label>
                    <input type="checkbox" id="editAmmissibile" ${invoice.ammissibile ? 'checked' : ''}>
                    Ammissibile per credito R&S
                </label>
            </div>
            <div class="form-group">
                <label>Motivazione</label>
                <input type="text" id="editMotivazione" value="${invoice.motivazione || ''}">
            </div>
            <div class="form-actions">
                <button class="btn btn-primary" onclick="DocumentsManager.saveInvoiceEdit('${id}')">
                    Salva
                </button>
                <button class="btn btn-secondary" onclick="closeModal()">
                    Annulla
                </button>
            </div>
        `;
        
        modal.classList.remove('hidden');
    },
    
    async saveInvoiceEdit(id) {
        const invoice = this.invoices.find(i => i.id === id);
        if (!invoice) return;
        
        try {
            showLoading(true);
            
            const updates = {
                invoice_number: document.getElementById('editNumero').value,
                supplier: document.getElementById('editFornitore').value,
                date: document.getElementById('editData').value,
                amount: parseFloat(document.getElementById('editImporto').value) || 0,
                description: document.getElementById('editDescrizione').value,
                is_eligible: document.getElementById('editAmmissibile').checked,
                eligibility_reason: document.getElementById('editMotivazione').value,
                updated_at: new Date().toISOString()
            };
            
            const { error } = await supabase
                .from('invoices')
                .update(updates)
                .eq('id', id);
            
            if (error) throw error;
            
            await this.loadDocuments();
            this.render();
            closeModal();
            
            showNotification('Fattura aggiornata', 'success');
            
        } catch (error) {
            console.error('Errore aggiornamento fattura:', error);
            showNotification('Errore aggiornamento fattura', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    async downloadDocument(fileUrl, fileName) {
        try {
            // Apri in nuova scheda
            window.open(fileUrl, '_blank');
        } catch (error) {
            console.error('Errore download:', error);
            showNotification('Errore download documento', 'error');
        }
    },
    
    async removeInvoice(id) {
        if (!confirm('Rimuovere questa fattura?')) return;
        
        try {
            showLoading(true);
            
            // Soft delete
            const { error } = await supabase
                .from('invoices')
                .update({ is_active: false })
                .eq('id', id);
            
            if (error) throw error;
            
            await this.loadDocuments();
            this.render();
            
            showNotification('Fattura rimossa', 'success');
            
        } catch (error) {
            console.error('Errore rimozione fattura:', error);
            showNotification('Errore rimozione fattura', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    async removeDoc(id) {
        if (!confirm('Rimuovere questo documento?')) return;
        
        try {
            showLoading(true);
            
            // Soft delete
            const { error } = await supabase
                .from('documents')
                .update({ is_active: false })
                .eq('id', id);
            
            if (error) throw error;
            
            await this.loadDocuments();
            this.render();
            
            showNotification('Documento rimosso', 'success');
            
        } catch (error) {
            console.error('Errore rimozione documento:', error);
            showNotification('Errore rimozione documento', 'error');
        } finally {
            showLoading(false);
        }
    },
    
    groupDocsByType() {
        const grouped = {};
        this.otherDocs.forEach(doc => {
            if (!grouped[doc.type]) {
                grouped[doc.type] = [];
            }
            grouped[doc.type].push(doc);
        });
        return grouped;
    },
    
    getDocumentType(file) {
        const ext = Utils.getFileExtension(file.name);
        const typeMap = {
            'pdf': 'contratto',
            'doc': 'relazione',
            'docx': 'relazione',
            'jpg': 'brevetto',
            'jpeg': 'brevetto',
            'png': 'brevetto'
        };
        return typeMap[ext] || 'generico';
    },
    
    getTypeLabel(type) {
        const labels = {
            'contratto': 'Contratti e Accordi',
            'brevetto': 'Brevetti e Certificazioni',
            'relazione': 'Relazioni Tecniche',
            'generico': 'Altri Documenti'
        };
        return labels[type] || 'Documenti';
    },
    
    getDocIcon(type) {
        const icons = {
            'contratto': '<i class="fas fa-file-contract"></i>',
            'brevetto': '<i class="fas fa-certificate"></i>',
            'relazione': '<i class="fas fa-file-alt"></i>',
            'generico': '<i class="fas fa-file"></i>'
        };
        return icons[type] || '<i class="fas fa-file"></i>';
    },
    
    // Metodi pubblici per altri moduli
    getTotalInvoicesAmount() {
        return this.invoices
            .filter(i => i.ammissibile)
            .reduce((sum, i) => sum + (i.importo || 0), 0);
    },
    
    getInvoicesForProject(projectId) {
        if (!projectId) {
            return this.invoices.filter(i => i.ammissibile);
        }
        return this.invoices.filter(i => i.ammissibile && i.projectId === projectId);
    },
    
    getInvoiceById(id) {
        return this.invoices.find(i => i.id === id);
    },
    
    getDocumentsForProject(projectId) {
        if (!projectId) return this.otherDocs;
        return this.otherDocs.filter(d => d.projectId === projectId);
    },
    
    async assignDocumentToProject(documentId, projectId, documentType = 'document') {
        try {
            const table = documentType === 'invoice' ? 'invoices' : 'documents';
            
            const { error } = await supabase
                .from(table)
                .update({ 
                    project_id: projectId,
                    updated_at: new Date().toISOString()
                })
                .eq('id', documentId);
            
            if (error) throw error;
            
            await this.loadDocuments();
            
        } catch (error) {
            console.error('Errore assegnazione documento:', error);
            throw error;
        }
    }
};

// Export
window.DocumentsManager = DocumentsManager;