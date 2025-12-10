
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEvent() {
    const slug = 'recepcionesgala';
    console.log(`Checking for event: ${slug}`);

    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error("Error fetching event:", error);
    } else {
        console.log("Event found:", data);

        // Also check settings
        const { data: settings, error: settingsError } = await supabase
            .from('event_settings')
            .select('*')
            .eq('event_id', data.id)
            .single();

        if (settingsError) {
            console.error("Error fetching settings:", settingsError);
        } else {
            console.log("Settings found:", settings);
        }
    }
}

checkEvent();
