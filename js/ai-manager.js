// js/ai-manager.js - Gestione Gemini AI e Knowledge Base

const AIManager = {
    apiKey: null,
    disabled: false,
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
        console.log('🤖 Inizializzazione AI Manager...');
        
        // Carica configurazione da localStorage
        this.loadConfiguration();
        
        // Carica knowledge base e prompts solo se AI è abilitata
        if (!this.disabled && this.apiKey) {
            await this.loadKnowledgeBase();
            await this.loadPrompts();
        }
        
        // Reset contatori se nuovo giorno
        this.checkDailyReset();
        
        console.log(`🤖 AI Manager inizializzato - API Key: ${this.apiKey ? 'Configurata' : 'Mancante'}, Modalità: ${this.disabled ? 'Manuale' : 'AI'}`);
        
        return this.apiKey !== null && !this.disabled;
    },

    // Carica configurazione da localStorage
    loadConfiguration() {
        // Carica API key
        this.apiKey = localStorage.getItem('gemini_api_key') || null;
        
        // Carica stato disabled
        this.disabled = localStorage.getItem('ai_disabled') === 'true';
        
        // Carica contatori
        this.loadCounters();
        
        console.log(`🔑 Configurazione caricata - API Key: ${this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'Non presente'}`);
    },

    // Salva API key
    async saveApiKey(apiKey) {
        if (!apiKey) {
            localStorage.removeItem('gemini_api_key');
            this.apiKey = null;
            console.log('🔑 API Key rimossa');
            return;
        }
        
        // Salva in localStorage
        localStorage.setItem('gemini_api_key', apiKey);
        this.apiKey = apiKey;
        
        console.log('🔑 API Key salvata con successo');
        
        // Se abbiamo una key valida e AI non è disabilitata, carica le risorse
        if (!this.disabled) {
            await this.loadKnowledgeBase();
            await this.loadPrompts();
        }
        
        showNotification('API Key salvata con successo', 'success');
    },

    // Carica knowledge base
    async loadKnowledgeBase() {
        try {
            const userId = Auth.getUser()?.id;
            if (!userId) {
                console.log('⚠️ Utente non autenticato, skip knowledge base');
                return;
            }

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

            console.log(`📚 Knowledge base caricata: ${data.length} elementi`);
        } catch (error) {
            console.error('Errore caricamento knowledge base:', error);
            // Non è critico, continua comunque
        }
    },

    // Carica prompts
    async loadPrompts() {
        // Prompts hardcoded per ora, in futuro dal database
        this.promptsCache.set('extract_payslip', {
            name: 'extract_payslip',
            prompt_template: `Analizza questa busta paga e estrai i seguenti dati in formato JSON:
{
  "nome_completo": "Nome e cognome del dipendente",
  "codice_fiscale": "Codice fiscale",
  "qualifica": "Qualifica o ruolo",
  "mese": "MM/YYYY",
  "ore_mensili": numero ore lavorate nel mese,
  "retribuzione_lorda": importo lordo mensile,
  "costo_azienda": costo totale per l'azienda (se presente)
}

Se non trovi un dato, metti null. Rispondi SOLO con il JSON, senza altre spiegazioni.`
        });

        this.promptsCache.set('analyze_invoice', {
            name: 'analyze_invoice',
            prompt_template: `Analizza questa fattura e determina se è ammissibile per il credito R&S. Estrai:
- Fornitore
- Numero fattura
- Data
- Importo totale
- Descrizione servizi/prodotti
- È ammissibile per R&S? (true/false)
- Motivazione ammissibilità

Cerca keywords come: ricerca, sviluppo, innovazione, consulenza tecnica, prototipazione, test, analisi.`
        });

        console.log(`📝 Prompts caricati: ${this.promptsCache.size}`);
    },

    // Ottieni prompt
    getPrompt(name, variables = {}) {
        const promptData = this.promptsCache.get(name);
        if (!promptData) {
            console.warn(`Prompt non trovato: ${name}`);
            // Fallback su prompt di base
            if (name === 'extract_payslip') {
                return this.getDefaultPayslipPrompt();
            }
            return null;
        }

        let prompt = promptData.prompt_template;
        
        // Sostituisci variabili
        Object.entries(variables).forEach(([key, value]) => {
            prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
        });

        return prompt;
    },

    // Prompt di default per busta paga
    getDefaultPayslipPrompt() {
        return `Analizza questa busta paga e estrai i seguenti dati in formato JSON:
{
  "nome_completo": "Nome e cognome del dipendente",
  "codice_fiscale": "Codice fiscale",
  "qualifica": "Qualifica o ruolo",
  "mese": "MM/YYYY",
  "ore_mensili": numero ore lavorate nel mese,
  "retribuzione_lorda": importo lordo mensile,
  "costo_azienda": costo totale per l'azienda (se presente)
}

Se non trovi un dato, metti null. Rispondi SOLO con il JSON, senza altre spiegazioni.`;
    },

    // Controlla se AI è disponibile
    isAvailable() {
        return this.apiKey !== null && !this.disabled;
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
            lastMinuteReset: this.lastMinuteReset,
            date: new Date().toDateString()
        };
        localStorage.setItem('ai_counters', JSON.stringify(data));
    },

    // Carica contatori
    loadCounters() {
        const saved = localStorage.getItem('ai_counters');
        if (saved) {
            const data = JSON.parse(saved);
            
            // Controlla se è un nuovo giorno
            if (data.date !== new Date().toDateString()) {
                this.requestsToday = 0;
                this.requestsThisMinute = 0;
                this.lastMinuteReset = Date.now();
                this.saveCounters();
                return;
            }
            
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
        }
    },

    // Chiamata API generica
    async callGeminiAPI(endpoint, body) {
        if (!this.apiKey) {
            throw new Error('API Key non configurata');
        }

        if (this.disabled) {
            throw new Error('AI disabilitata in modalità manuale');
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
                } else if (response.status === 400 && errorData?.error?.message?.includes('API_KEY_INVALID')) {
                    // API key non valida, rimuovila
                    this.apiKey = null;
                    localStorage.removeItem('gemini_api_key');
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
        if (!this.isAvailable()) {
            throw new Error('AI non disponibile');
        }

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

    // Ottieni stato API
    getAPIStatus() {
        return {
            configured: this.apiKey !== null,
            disabled: this.disabled,
            requestsToday: this.requestsToday,
            requestsRemaining: this.limits.requestsPerDay - this.requestsToday,
            percentageUsed: Math.round((this.requestsToday / this.limits.requestsPerDay) * 100)
        };
    }
};

// Export
window.AIManager = AIManager;
