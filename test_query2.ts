import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log("Running query...");
    const { data: assignments, error } = await supabase
        .from('display_assignments')
        .select('*, campaign:display_campaigns(*), media:display_media(*), schedule:display_schedules(*, events:display_schedule_events(*, campaign:display_campaigns!campaign_id(*), media:display_media!media_id(*)), default_campaign:display_campaigns!default_campaign_id(*), default_media:display_media!default_media_id(*))')
        .order('created_at', { ascending: false })
        .limit(5);
    
    if (error) {
        console.error("Query failed:", error);
    } else {
        console.log("Latest 5 assignments:", JSON.stringify(assignments, null, 2));
    }
}

testQuery();
