// Application Configuration
const Config = {
    // Supabase Configuration
    supabase: {
        url: 'https://hkmlggeddkhyyldwbjmt.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbWxnZ2VkZGtoeXlsZHdiam10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNDE2MzMsImV4cCI6MjA2NTcxNzYzM30.Oj7WomoO4jMzIu6yvO-9VLTEn1lKBypKHXOQ1dt2f-s'
    },
    
    // Gemini API Configuration
    gemini: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/models/',
        model: 'gemini-1.5-flash',
        visionModel: 'gemini-1.5-flash',
        maxTokens: 8192,
        temperature: 0.1,
        topK: 1,
        topP: 0.8
    },
    
    // Credit Rates
    creditRates: {
        'ricerca_fondamentale': 0.12,
        'ricerca_industriale': 0.10,
        'sviluppo_sperimentale': 0.10,
        'innovazione_tecnologica': 0.10,
        'innovazione_4.0': 0.15,
        'innovazione_green': 0.15,
        'design': 0.10
    },
    
    // Project Types
    projectTypes: [
        { value: 'ricerca_fondamentale', label: 'Ricerca Fondamentale', rate: 0.12, color: '#9b59b6' },
        { value: 'ricerca_industriale', label: 'Ricerca Industriale', rate: 0.10, color: '#3498db' },
        { value: 'sviluppo_sperimentale', label: 'Sviluppo Sperimentale', rate: 0.10, color: '#e74c3c' },
        { value: 'innovazione_tecnologica', label: 'Innovazione Tecnologica', rate: 0.10, color: '#f39c12' },
        { value: 'innovazione_4.0', label: 'Innovazione 4.0', rate: 0.15, color: '#27ae60' },
        { value: 'innovazione_green', label: 'Innovazione Green', rate: 0.15, color: '#16a085' },
        { value: 'design', label: 'Design e Ideazione Estetica', rate: 0.10, color: '#e91e63' }
    ],
    
    // File Upload Limits
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        supportedFormats: {
            payslips: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
            invoices: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
            documents: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 
                       'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        }
    },
    
    // Validation Rules
    validation: {
        minProjectName: 3,
        maxProjectName: 100,
        minDescription: 10,
        maxDescription: 5000,
        minReportSection: 50,
        maxReportSection: 10000,
        codiceFiscalePattern: /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/i
    },
    
    // API Rate Limits
    rateLimits: {
        gemini: {
            requestsPerMinute: 15,
            requestsPerDay: 1500,
            minInterval: 4000 // 4 seconds between requests
        }
    },
    
    // Knowledge Base Categories
    knowledgeBase: {
        categories: ['normativa', 'esempi', 'template', 'best_practices'],
        relevanceThreshold: 0.7
    }
};

// Freeze configuration to prevent modifications
Object.freeze(Config);