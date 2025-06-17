// js/ai-manager.js - Gestione Gemini AI e Knowledge Base

const AIManager = {
    apiKey: null,
    models: {
        flash: 'gemini-1.5-flash',
        vision: 'gemini-1.5-flash'
    },
    endpoints: {
        generateContent: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        embedContent: 'https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent'
    },
    
    // Rate limiting
    lastRequestTime: 0,
    minRequestInterval: 4500, // 4.5 secondi tra richieste
    requestsThisMinute: 0,
    requestsToday: 0,
    lastMinuteReset: Date.now(),
    
    // Limiti
    limits: {
        requestsPerMinute: 15,
        requestsPerDay: 1500,
        tokensPerMinute: 1000000
    },
    
    // Cache
    knowledgeCache: new Map(),
    promptsCache: new Map(),
    embeddingsCache: new Map(),

    // Inizializzazione
    async init() {
        console.log('Inizializzazione AI Manager...');
        
        // Carica API key
        await this.loadApiKey();
        
        // Carica knowledge base e prompts
        await this.loadKnowledgeBase();
        await this.loadPrompts();
        
        // Reset contatori se nuovo giorno
        this.checkDailyReset();
        
        return this.apiKey !== null;
    },

    // Carica API key
    async loadApiKey() {
        const userId = Auth.getUser()?.id;
        if (!userId) return;

        try {
            // Prima controlla nel database
            const { data, error } = await supabase
                .from('api_keys')
                .select('key_encrypted')
                .eq('user_id', userId)
                .eq('provider', 'gemini')
                .eq('is_active', true)
                .single();

            if (data && data.key_encrypted) {
                // In produzione dovresti decrittare la chiave
                this.apiKey = data.key_encrypted;
            } else {
                // Fallback su localStorage per retrocompatibilità
                this.apiKey = localStorage.getItem('gemini_api_key');
            }
        } catch (error) {
            console.error('Errore caricamento API key:', error);
            this.apiKey = localStorage.getItem('gemini_api_key');
        }
    },

    // Salva API key
    async saveApiKey(apiKey) {
        const userId = Auth.getUser()?.id;
        if (!userId) {
            localStorage.setItem('gemini_api_key', apiKey);
            this.apiKey = apiKey;
            return;
        }

        try {
            // Disattiva chiavi precedenti
            await supabase
                .from('api_keys')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('provider', 'gemini');

            // Inserisci nuova chiave
            const { error } = await supabase
                .from('api_keys')
                .insert({
                    user_id: userId,
                    provider: 'gemini',
                    key_encrypted: apiKey, // In produzione, critta la chiave
                    is_active: true
                });

            if (error) throw error;

            // Salva anche in localStorage per backup
            localStorage.setItem('gemini_api_key', apiKey);
            this.apiKey = apiKey;

            showNotification('API Key salvata con successo', 'success');
        } catch (error) {
            console.error('Errore salvataggio API key:', error);
            showNotification('Errore salvataggio API key', 'error');
        }
    },

    // Carica knowledge base
    async loadKnowledgeBase() {
        try {
            const { data, error } = await supabase
                .from('knowledge_base')
                .select('*')
                .order('category', { ascending: true });

            if (error) throw error;

            // Organizza per categoria
            data.forEach(item => {
                if (!this.knowledgeCache.has(item.category)) {
                    this.knowledgeCache.set(item.category, []);
                }
                this.knowledgeCache.get(item.category).push(item);
            });

            console.log(`Knowledge base caricata: ${data.length} elementi`);
        } catch (error) {
            console.error('Errore caricamento knowledge base:', error);
        }
    },

    // Carica prompts
    async loadPrompts() {
        try {
            const { data, error } = await supabase
                .from('ai_prompts')
                .select('*')
                .eq('is_active', true);

            if (error) throw error;

            data.forEach(prompt => {
                this.promptsCache.set(prompt.name, prompt);
            });

            console.log(`Prompts caricati: ${data.length}`);
        } catch (error) {
            console.error('Errore caricamento prompts:', error);
        }
    },

    // Ottieni prompt
    getPrompt(name, variables = {}) {
        const promptData = this.promptsCache.get(name);
        if (!promptData) {
            console.warn(`Prompt non trovato: ${name}`);
            return null;
        }

        let prompt = promptData.prompt_template;
        
        // Sostituisci variabili
        Object.entries(variables).forEach(([key, value]) => {
            prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
        });

        return prompt;
    },

    // Ottieni knowledge per categoria
    getKnowledge(category) {
        return this.knowledgeCache.get(category) || [];
    },

    // Cerca nella knowledge base
    searchKnowledge(query) {
        const results = [];
        
        this.knowledgeCache.forEach((items, category) => {
            items.forEach(item => {
                const score = this.calculateRelevanceScore(query, item);
                if (score > 0.3) {
                    results.push({ ...item, score });
                }
            });
        });

        return results.sort((a, b) => b.score - a.score).slice(0, 5);
    },

    // Calcola score di rilevanza semplice
    calculateRelevanceScore(query, item) {
        const queryLower = query.toLowerCase();
        const titleScore = item.title.toLowerCase().includes(queryLower) ? 0.5 : 0;
        const contentScore = item.content.toLowerCase().includes(queryLower) ? 0.3 : 0;
        const tagsScore = item.tags.some(tag => tag.toLowerCase().includes(queryLower)) ? 0.2 : 0;
        
        return titleScore + contentScore + tagsScore;
    },

    // Controlla rate limits
    async checkRateLimits() {
        const now = Date.now();
        
        // Reset contatore minuti
        if (now - this.lastMinuteReset > 60000) {
            this.requestsThisMinute = 0;
            this.lastMinuteReset = now;
        }

        // Controlla limite per minuto
        if (this.requestsThisMinute >= this.limits.requestsPerMinute) {
            const waitTime = 60 - ((now - this.lastMinuteReset) / 1000);
            showNotification(`Limite richieste raggiunto. Attendi ${Math.ceil(waitTime)} secondi...`, 'warning');
            
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            this.requestsThisMinute = 0;
            this.lastMinuteReset = Date.now();
        }

        // Controlla limite giornaliero
        if (this.requestsToday >= this.limits.requestsPerDay) {
            showNotification('Quota giornaliera API esaurita!', 'error');
            throw new Error('DAILY_QUOTA_EXCEEDED');
        }

        // Controlla intervallo minimo tra richieste
        const timeSinceLastRequest = Date.now() - this.lastRequestTime;
        if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    },

    // Incrementa contatori
    incrementCounters() {
        this.requestsThisMinute++;
        this.requestsToday++;
        this.lastRequestTime = Date.now();
        this.saveCounters();
    },

    // Salva contatori
    saveCounters() {
        const data = {
            today: this.requestsToday,
            minute: this.requestsThisMinute,
            lastMinuteReset: this.lastMinuteReset
        };
        localStorage.setItem('ai_counters', JSON.stringify(data));
    },

    // Carica contatori
    loadCounters() {
        const saved = localStorage.getItem('ai_counters');
        if (saved) {
            const data = JSON.parse(saved);
            this.requestsToday = data.today || 0;
            
            if (Date.now() - data.lastMinuteReset > 60000) {
                this.requestsThisMinute = 0;
                this.lastMinuteReset = Date.now();
            } else {
                this.requestsThisMinute = data.minute || 0;
                this.lastMinuteReset = data.lastMinuteReset || Date.now();
            }
        }
    },

    // Reset giornaliero
    checkDailyReset() {
        const lastReset = localStorage.getItem('ai_last_daily_reset');
        const today = new Date().toDateString();
        
        if (lastReset !== today) {
            this.requestsToday = 0;
            this.requestsThisMinute = 0;
            localStorage.setItem('ai_last_daily_reset', today);
            this.saveCounters();
        } else {
            this.loadCounters();
        }
    },

    // Chiamata API generica
    async callGeminiAPI(endpoint, body) {
        if (!this.apiKey) {
            throw new Error('API Key non configurata');
        }

        await this.checkRateLimits();

        try {
            const response = await fetch(`${endpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body)
            });

            this.incrementCounters();

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                
                if (response.status === 429) {
                    throw new Error('QUOTA_EXCEEDED');
                } else if (response.status === 401) {
                    throw new Error('API Key non valida');
                }
                
                throw new Error(`API Error: ${response.status} - ${errorData?.error?.message || 'Sconosciuto'}`);
            }

            return await response.json();

        } catch (error) {
            console.error('Errore chiamata API:', error);
            throw error;
        }
    },

    // Estrai dati da busta paga
    async extractPayslipData(fileData, mimeType) {
        const prompt = this.getPrompt('extract_payslip');
        if (!prompt) {
            throw new Error('Prompt non trovato');
        }

        const endpoint = this.endpoints.generateContent.replace('{model}', this.models.vision);
        
        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: fileData
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 0.8,
                maxOutputTokens: 1024,
            }
        };

        const response = await this.callGeminiAPI(endpoint, body);
        
        if (!response.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Risposta API non valida');
        }

        const text = response.candidates[0].content.parts[0].text;
        
        // Estrai JSON dalla risposta
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        
        throw new Error('Formato risposta non valido');
    },

    // Analizza documento generico
    async analyzeDocument(fileData, mimeType, documentType = 'generic') {
        const prompt = this.getPrompt(`analyze_${documentType}`) || this.getPrompt('analyze_generic');
        
        const endpoint = this.endpoints.generateContent.replace('{model}', this.models.vision);
        
        const body = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: fileData
                        }
                    }
                ]
            }],
            generationConfig: {
                temperature: 0.3,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        };

        const response = await this.callGeminiAPI(endpoint, body);
        
        return response.candidates[0].content.parts[0].text;
    },

    // Genera contenuto per relazione
    async generateReportContent(section, projectData) {
        // Cerca knowledge relevante
        const relevantKnowledge = this.searchKnowledge(`${section} ${projectData.type}`);
        
        // Costruisci contesto
        let context = '';
        if (relevantKnowledge.length > 0) {
            context = '\n\nInformazioni utili dalla knowledge base:\n';
            relevantKnowledge.forEach(item => {
                context += `- ${item.title}: ${item.content.substring(0, 200)}...\n`;
            });
        }

        const prompt = this.getPrompt(`report_${section}`, {
            project_name: projectData.name,
            project_type: projectData.type,
            context: context
        });

        if (!prompt) {
            throw new Error(`Prompt non trovato per sezione: ${section}`);
        }

        const endpoint = this.endpoints.generateContent.replace('{model}', this.models.flash);
        
        const body = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        };

        const response = await this.callGeminiAPI(endpoint, body);
        
        return response.candidates[0].content.parts[0].text;
    },

    // Analizza tutti i documenti di un progetto
    async analyzeProjectDocuments(projectId) {
        try {
            showLoading(true);
            showNotification('Analisi documenti in corso...', 'info');

            // Recupera tutti i documenti del progetto
            const { data: documents, error } = await supabase
                .from('documents')
                .select('*, documents_content(*)')
                .eq('project_id', projectId)
                .eq('is_active', true);

            if (error) throw error;

            const analyses = [];
            
            for (const doc of documents) {
                if (doc.documents_content && doc.documents_content.text_content) {
                    // Usa il contenuto già estratto
                    analyses.push({
                        document: doc.file_name,
                        type: doc.document_type,
                        content: doc.documents_content.text_content,
                        summary: doc.documents_content.summary
                    });
                } else {
                    // Analizza il documento
                    const analysis = await this.analyzeDocument(
                        doc.file_data,
                        doc.mime_type,
                        doc.document_type
                    );
                    
                    analyses.push({
                        document: doc.file_name,
                        type: doc.document_type,
                        content: analysis
                    });

                    // Salva l'analisi per usi futuri
                    await this.saveDocumentAnalysis(doc.id, analysis);
                }
            }

            return analyses;

        } catch (error) {
            console.error('Errore analisi documenti:', error);
            showNotification('Errore durante l\'analisi dei documenti', 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    },

    // Salva analisi documento
    async saveDocumentAnalysis(documentId, analysis) {
        try {
            // Genera summary
            const summary = analysis.substring(0, 500);
            
            // Genera embedding per ricerca semantica
            const embedding = await this.generateEmbedding(analysis);

            const { error } = await supabase
                .from('documents_content')
                .upsert({
                    document_id: documentId,
                    text_content: analysis,
                    summary: summary,
                    embedding: embedding,
                    extracted_at: new Date().toISOString()
                });

            if (error) throw error;

        } catch (error) {
            console.error('Errore salvataggio analisi:', error);
        }
    },

    // Genera embedding
    async generateEmbedding(text) {
        if (!this.apiKey) return null;

        try {
            const body = {
                model: 'models/embedding-001',
                content: {
                    parts: [{
                        text: text.substring(0, 3072) // Limite caratteri
                    }]
                }
            };

            const response = await this.callGeminiAPI(this.endpoints.embedContent, body);
            
            return response.embedding.values;

        } catch (error) {
            console.error('Errore generazione embedding:', error);
            return null;
        }
    },

    // Ricerca semantica
    async semanticSearch(query, projectId = null) {
        try {
            // Genera embedding per la query
            const queryEmbedding = await this.generateEmbedding(query);
            if (!queryEmbedding) {
                throw new Error('Impossibile generare embedding per la query');
            }

            // Ricerca nel database usando pgvector
            let searchQuery = supabase
                .from('documents_content')
                .select(`
                    document_id,
                    text_content,
                    summary,
                    documents!inner(
                        id,
                        file_name,
                        document_type,
                        project_id
                    )
                `)
                .order('embedding <-> $1', { ascending: true })
                .limit(5);

            if (projectId) {
                searchQuery = searchQuery.eq('documents.project_id', projectId);
            }

            const { data, error } = await searchQuery;

            if (error) throw error;

            return data;

        } catch (error) {
            console.error('Errore ricerca semantica:', error);
            return [];
        }
    },

    // Genera suggerimenti AI
    async generateSuggestions(context) {
        const prompt = this.getPrompt('generate_suggestions', {
            context: JSON.stringify(context)
        });

        const endpoint = this.endpoints.generateContent.replace('{model}', this.models.flash);
        
        const body = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.8,
                topK: 50,
                topP: 0.95,
                maxOutputTokens: 512,
            }
        };

        const response = await this.callGeminiAPI(endpoint, body);
        
        const text = response.candidates[0].content.parts[0].text;
        
        // Estrai suggerimenti come array
        const suggestions = text.split('\n')
            .filter(line => line.trim().startsWith('- '))
            .map(line => line.replace(/^- /, '').trim());

        return suggestions;
    },

    // Ottieni stato API
    getAPIStatus() {
        return {
            configured: this.apiKey !== null,
            requestsToday: this.requestsToday,
            requestsRemaining: this.limits.requestsPerDay - this.requestsToday,
            percentageUsed: (this.requestsToday / this.limits.requestsPerDay * 100).toFixed(0)
        };
    },

    // Helper per gestire errori comuni
    handleAPIError(error) {
        if (error.message === 'QUOTA_EXCEEDED') {
            return {
                retry: false,
                message: 'Quota API esaurita per oggi',
                fallback: true
            };
        } else if (error.message === 'API Key non valida') {
            return {
                retry: false,
                message: 'API Key non valida. Verifica nella sezione Setup',
                fallback: false
            };
        } else {
            return {
                retry: true,
                message: 'Errore temporaneo. Riprova tra qualche secondo',
                fallback: true
            };
        }
    }
};

// Export
window.AIManager = AIManager;