import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixRole() {
  console.log("Updating role for sebadj@eventpix.com to 'provider'...");
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'provider' })
    .eq('email', 'sebadj@eventpix.com')
    .select();

  if (error) {
    console.error("Error updating role:", error);
  } else {
    console.log("Successfully updated role:", data);
  }
}

fixRole();
