
import { supabase } from "../src/lib/supabase";

async function checkSchema() {
    console.log("Checking event_settings columns...");

    // Try to select the specific columns. If they don't exist, this should error.
    const { data, error } = await supabase
        .from('event_settings')
        .select('id, font_family, frame_image_url, frame_enabled')
        .limit(1);

    if (error) {
        console.error("❌ Error selecting columns:", error.message);
        if (error.message.includes("does not exist")) {
            console.log("⚠️ Missing columns detected!");
        }
    } else {
        console.log("✅ Columns exist. Data sample:", data);
    }
}

checkSchema();
