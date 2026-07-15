import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Helper to check if a string is a valid URL
const isValidUrl = (urlString: string) => {
    try {
        return Boolean(new URL(urlString));
    }
    catch (e) {
        return false;
    }
}

const isConfigured = supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your_supabase_url') &&
    isValidUrl(supabaseUrl);

if (!isConfigured) {
    console.warn('Supabase credentials missing or invalid. Using mock mode.');
}

// Use a valid dummy URL if not configured to prevent createClient from crashing
const urlToUse = isConfigured ? supabaseUrl : 'https://placeholder.supabase.co';
const keyToUse = isConfigured ? supabaseAnonKey : 'placeholder';

export const supabase = createClient(urlToUse, keyToUse);
