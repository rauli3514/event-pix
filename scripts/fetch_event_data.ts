
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchEvent() {
    const slug = 'fereventos';
    console.log(`Fetching event with slug: ${slug}`);

    const { data: event, error } = await supabase
        .from('events')
        .select('*')
        .eq('slug', slug)
        .single();

    if (error) {
        console.error('Error fetching event:', error);
        return;
    }

    console.log('Event Data:', event);

    // Fetch settings if event exists
    if (event) {
        const { data: settings, error: settingsError } = await supabase
            .from('event_settings')
            .select('*')
            .eq('event_id', event.id)
            .single();

        if (settingsError) {
            console.error('Error fetching settings:', settingsError);
        } else {
            console.log('Event Settings:', settings);
        }
    }
}

fetchEvent();
