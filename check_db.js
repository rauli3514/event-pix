import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('display_devices').select('*').eq('device_id', '5HAN60');
  console.log("Error:", error);
  console.log("Data:", data);
}
check();
