const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'display_media' });
    if(error) {
        // Fallback if rpc is not defined, we can just query the table and look at keys
        const { data: rows, error: err2 } = await supabase.from('display_media').select('*').limit(1);
        if(rows && rows.length > 0) {
            console.log(Object.keys(rows[0]));
        } else {
            console.log("No rows, cannot infer columns.");
        }
    } else {
        console.log(data);
    }
}
check();
