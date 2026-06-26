import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
    const { data, error } = await supabase.rpc('get_tables_info'); // if this RPC doesn't exist, we can query information_schema if anon key has access, or just use psql if we had a connection string. Since we only have anon key, we might need a workaround.
    console.log(data, error);
}
run();
