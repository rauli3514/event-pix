import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testTvPlayerQuery() {
    console.log("Checking TvPlayer query...");
    const { data: assignments, error } = await supabase
        .from('display_assignments')
        .select(`
            *,
            campaign:display_campaigns(*),
            media:display_media(*),
            schedule:display_schedules(
                *,
                default_campaign:display_campaigns!default_campaign_id(*),
                default_media:display_media!default_media_id(*),
                events:display_schedule_events(
                    *,
                    campaign:display_campaigns!campaign_id(*),
                    media:display_media!media_id(*)
                )
            )
        `)
        .or(`device_id.eq.b68e2b51-c85e-48cc-900e-c8f02ce3f773`)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Failed:", error);
    } else {
        console.log("Assignments:", JSON.stringify(assignments, null, 2));
    }
}

testTvPlayerQuery();
