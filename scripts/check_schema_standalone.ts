
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking event_settings columns...");

    // Try to select the specific columns. If they don't exist, this should error.
    const { data, error } = await supabase
        .from('event_settings')
        .select('id, font_family, frame_image_url')
        .limit(1);

    if (error) {
        console.error("❌ Error selecting columns:", error.message);
        console.log("⚠️ It seems the columns are MISSING. The update will fail.");
    } else {
        console.log("✅ Columns exist. Data sample:", data);
    }
}

checkSchema();
