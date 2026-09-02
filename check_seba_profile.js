import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSeba() {
  console.log("=== Checking profiles table ===");
  const { data: profileData, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', 'sebadj@eventpix.com');
  console.log("profiles:", profileData, profileErr);

  console.log("=== Checking user_roles table if exists ===");
  const { data: roleData, error: roleErr } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', profileData?.[0]?.id);
  console.log("user_roles:", roleData, roleErr);

  console.log("=== Checking all super_admins in profiles ===");
  const { data: superAdmins } = await supabase
    .from('profiles')
    .select('id, email, name, role, user_type')
    .eq('role', 'super_admin');
  console.log("super_admins:", superAdmins);
}

inspectSeba();
