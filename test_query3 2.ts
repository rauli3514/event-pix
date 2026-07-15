import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDevices() {
    console.log("Checking devices...");
    const { data: devices, error } = await supabase
        .from('display_devices')
        .select('*');
    
    if (error) {
        console.error("Failed:", error);
    } else {
        console.log("Devices:", JSON.stringify(devices, null, 2));
    }
}

checkDevices();
