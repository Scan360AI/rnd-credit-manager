// Initialize Supabase Client
const supabase = window.supabase.createClient(Config.supabase.url, Config.supabase.anonKey);

// Supabase Helper Functions
const SupabaseClient = {
    // Auth helpers
    async getCurrentUser() {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    },
    
    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        return { data, error };
    },
    
    async signUp(email, password, metadata) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: metadata
            }
        });
        return { data, error };
    },
    
    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },
    
    // Database helpers
    async upsert(table, data) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        data.user_id = user.id;
        data.updated_at = new Date().toISOString();
        
        const { data: result, error } = await supabase
            .from(table)
            .upsert(data)
            .select();
            
        return { data: result, error };
    },
    
    async select(table, filters = {}) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        let query = supabase.from(table).select('*').eq('user_id', user.id);
        
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
                query = query.eq(key, value);
            }
        });
        
        const { data, error } = await query.order('created_at', { ascending: false });
        return { data, error };
    },
    
    async delete(table, id) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
            
        return { error };
    },
    
    // Storage helpers
    async uploadFile(bucket, path, file) {
        const user = await this.getCurrentUser();
        if (!user) throw new Error('Not authenticated');
        
        const fileName = `${user.id}/${path}`;
        
        const { data, error } = await supabase.storage
            .from(bucket)
            .upload(fileName, file, {
                upsert: true
            });
            
        return { data, error };
    },
    
    async downloadFile(bucket, path) {
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(path);
            
        return { data, error };
    },
    
    async getPublicUrl(bucket, path) {
        const { data } = supabase.storage
            .from(bucket)
            .getPublicUrl(path);
            
        return data.publicUrl;
    },
    
    // Real-time subscriptions
    subscribe(table, callback) {
        const user = this.getCurrentUser();
        if (!user) return null;
        
        return supabase
            .channel(`${table}_changes`)
            .on('postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: table,
                    filter: `user_id=eq.${user.id}`
                }, 
                callback
            )
            .subscribe();
    },
    
    unsubscribe(subscription) {
        if (subscription) {
            supabase.removeChannel(subscription);
        }
    }
};