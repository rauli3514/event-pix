import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
    const { data, error } = await supabase.from('display_media').select('id, name, type, url, metadata').order('created_at', { ascending: false }).limit(5);
    console.log(data, error);
}

main();
