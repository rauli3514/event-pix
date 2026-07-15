import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTvBoxAssignment() {
    console.log("Checking assignments for tvbox prueba...");
    const { data: assignments, error } = await supabase
        .from('display_assignments')
        .select('*')
        .eq('device_id', 'b68e2b51-c85e-48cc-900e-c8f02ce3f773');
    
    if (error) {
        console.error("Failed:", error);
    } else {
        console.log("Assignments:", JSON.stringify(assignments, null, 2));
    }
}

checkTvBoxAssignment();
