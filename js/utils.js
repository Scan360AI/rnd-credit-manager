// js/utils.js - Funzioni utility per R&S Credit Manager

const Utils = {
    // Formattazione valuta
    formatCurrency(amount) {
        if (amount === null || amount === undefined) return '€0,00';
        
        return new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR'
        }).format(amount);
    },
    
    // Formattazione valuta compatta
    formatCurrencyCompact(amount) {
        if (amount === null || amount === undefined) return '€0';
        
        if (Math.abs(amount) < 1000) {
            return this.formatCurrency(amount);
        } else if (Math.abs(amount) < 1000000) {
            return '€' + (amount / 1000).toFixed(1) + 'k';
        } else {
            return '€' + (amount / 1000000).toFixed(1) + 'M';
        }
    },
    
    // Formattazione percentuale
    formatPercentage(value) {
        if (value === null || value === undefined) return '0%';
        return `${value}%`;
    },
    
    // Formattazione data
    formatDate(date, format = 'short') {
        if (!date) return '';
        
        const d = new Date(date);
        
        switch (format) {
            case 'short':
                return d.toLocaleDateString('it-IT');
            case 'long':
                return d.toLocaleDateString('it-IT', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            case 'month':
                return d.toLocaleDateString('it-IT', {
                    month: '2-digit',
                    year: 'numeric'
                });
            case 'iso':
                return d.toISOString().split('T')[0];
            default:
                return d.toLocaleDateString('it-IT');
        }
    },
    
    // Formattazione data e ora
    formatDateTime(date) {
        if (!date) return '';
        
        const d = new Date(date);
        return d.toLocaleString('it-IT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Formattazione tempo relativo
    formatRelativeTime(date) {
        const now = new Date();
        const d = new Date(date);
        const diff = now - d;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 30) {
            return this.formatDate(date);
        } else if (days > 0) {
            return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
        } else if (hours > 0) {
            return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
        } else if (minutes > 0) {
            return `${minutes} ${minutes === 1 ? 'minuto' : 'minuti'} fa`;
        } else {
            return 'Ora';
        }
    },
    
    // Validazione email
    isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Validazione codice fiscale
    isValidCodiceFiscale(cf) {
        if (!cf || cf.length !== 16) return false;
        
        cf = cf.toUpperCase();
        const pattern = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
        
        if (!pattern.test(cf)) return false;
        
        // Mappa per il calcolo del carattere di controllo
        const odd = {
            '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19,
            '9': 21, 'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17,
            'I': 19, 'J': 21, 'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6,
            'R': 8, 'S': 12, 'T': 14, 'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
        };
        
        let sum = 0;
        for (let i = 0; i < 15; i++) {
            const c = cf[i];
            sum += i % 2 === 0 ? odd[c] : (isNaN(c) ? c.charCodeAt(0) - 65 : parseInt(c));
        }
        
        const checkChar = String.fromCharCode(65 + sum % 26);
        return checkChar === cf[15];
    },
    
    // Validazione partita IVA
    isValidPartitaIVA(piva) {
        if (!piva || piva.length !== 11) return false;
        if (!/^\d{11}$/.test(piva)) return false;
        
        let sum = 0;
        for (let i = 0; i < 10; i++) {
            let n = parseInt(piva[i]);
            if (i % 2 === 0) {
                n *= 2;
                if (n > 9) n -= 9;
            }
            sum += n;
        }
        
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(piva[10]);
    },
    
    // Generazione ID univoco
    generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const randomPart = Math.random().toString(36).substr(2, 9);
        return prefix ? `${prefix}_${timestamp}_${randomPart}` : `${timestamp}_${randomPart}`;
    },
    
    // Generazione UUID v4
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    // Hash semplice (non crittografico)
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    },
    
    // Escape HTML
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },
    
    // Unescape HTML
    unescapeHtml(safe) {
        if (!safe) return '';
        
        const div = document.createElement('div');
        div.innerHTML = safe;
        return div.textContent || div.innerText || '';
    },
    
    // Sanitize input per prevenire XSS
    sanitizeInput(input) {
        if (!input) return '';
        
        return input
            .toString()
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '');
    },
    
    // Debounce function
    debounce(func, wait, immediate = false) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func.apply(this, args);
        };
    },
    
    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Deep clone object
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    },
    
    // Merge objects deeply
    deepMerge(target, ...sources) {
        if (!sources.length) return target;
        const source = sources.shift();
        
        if (this.isObject(target) && this.isObject(source)) {
            for (const key in source) {
                if (this.isObject(source[key])) {
                    if (!target[key]) Object.assign(target, { [key]: {} });
                    this.deepMerge(target[key], source[key]);
                } else {
                    Object.assign(target, { [key]: source[key] });
                }
            }
        }
        
        return this.deepMerge(target, ...sources);
    },
    
    // Check if object
    isObject(item) {
        return item && typeof item === 'object' && !Array.isArray(item);
    },
    
    // Group array by key
    groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    },
    
    // Sort array of objects
    sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            const aVal = this.getNestedValue(a, key);
            const bVal = this.getNestedValue(b, key);
            
            if (aVal < bVal) return order === 'asc' ? -1 : 1;
            if (aVal > bVal) return order === 'asc' ? 1 : -1;
            return 0;
        });
    },
    
    // Get nested object value
    getNestedValue(obj, path) {
        return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Truncate text
    truncateText(text, maxLength, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength - suffix.length) + suffix;
    },
    
    // Capitalize first letter
    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    // Title case
    titleCase(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, txt => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    },
    
    // Parse query string
    parseQueryString(queryString) {
        const params = {};
        const searchParams = new URLSearchParams(queryString);
        
        for (const [key, value] of searchParams) {
            params[key] = value;
        }
        
        return params;
    },
    
    // Build query string
    buildQueryString(params) {
        const searchParams = new URLSearchParams();
        
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined) {
                searchParams.append(key, value);
            }
        }
        
        return searchParams.toString();
    },
    
    // Check if mobile device
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },
    
    // Check if touch device
    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    },
    
    // Get browser info
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        if (ua.indexOf('Firefox') > -1) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.indexOf('Chrome') > -1) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.indexOf('Safari') > -1) {
            browser = 'Safari';
            version = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        } else if (ua.indexOf('Edge') > -1) {
            browser = 'Edge';
            version = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
        }
        
        return { browser, version };
    },
    
    // Copy to clipboard
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback per browser non sicuri
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const success = document.execCommand('copy');
                document.body.removeChild(textarea);
                return success;
            }
        } catch (error) {
            console.error('Errore copia negli appunti:', error);
            return false;
        }
    },
    
    // Download file
    downloadFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    // Convert base64 to blob
    base64ToBlob(base64, mimeType = 'application/octet-stream') {
        try {
            // Rimuovi il prefisso data URL se presente
            const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
            
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            return new Blob([byteArray], { type: mimeType });
        } catch (error) {
            console.error('Errore conversione base64 a blob:', error);
            return null;
        }
    },
    
    // Convert blob to base64
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    },
    
    // Validate file type
    validateFileType(file, allowedTypes) {
        const fileType = file.type || '';
        const fileName = file.name || '';
        const extension = fileName.split('.').pop().toLowerCase();
        
        // Controlla MIME type
        if (allowedTypes.includes(fileType)) return true;
        
        // Controlla estensione come fallback
        const typeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        };
        
        const mappedType = typeMap[extension];
        return mappedType && allowedTypes.includes(mappedType);
    },
    
    // Get file extension
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    },
    
    // Generate random color
    generateRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    },
    
    // Convert hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    // Sleep function
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Retry function
    async retry(fn, maxAttempts = 3, delay = 1000) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === maxAttempts - 1) throw error;
                await this.sleep(delay);
                delay *= 2; // Exponential backoff
            }
        }
    },
    
    // Format number with separators
    formatNumber(num, decimals = 0) {
        return new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(num);
    },
    
    // Calculate percentage
    calculatePercentage(value, total) {
        if (!total || total === 0) return 0;
        return Math.round((value / total) * 100);
    },
    
    // Parse CSV
    parseCSV(text, delimiter = ',') {
        const lines = text.split('\n');
        const headers = lines[0].split(delimiter).map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim()) {
                const values = lines[i].split(delimiter);
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index]?.trim() || '';
                });
                data.push(row);
            }
        }
        
        return { headers, data };
    },
    
    // Export to CSV
    exportToCSV(data, filename = 'export.csv') {
        if (!data || data.length === 0) return;
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => 
                headers.map(header => {
                    const value = row[header] || '';
                    return typeof value === 'string' && value.includes(',') 
                        ? `"${value}"` 
                        : value;
                }).join(',')
            )
        ].join('\n');
        
        this.downloadFile('\ufeff' + csvContent, filename, 'text/csv;charset=utf-8');
    }
};

// Esporta globalmente
window.Utils = Utils;