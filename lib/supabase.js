import { createClient } from '@supabase/supabase-js';

let _supabase = null;

// Lazy init - hanya buat client bila dipanggil, bukan masa module load
export function getSupabase() {
    if (_supabase) return _supabase;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }

    _supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    
    return _supabase;
}

// Backward compat export
export const supabase = new Proxy({}, {
    get(_, prop) {
        return getSupabase()[prop];
    }
});
