import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Ingresá la contraseña de rauli3514@gmail.com: ', async (password) => {
  rl.close();
  console.log("Iniciando sesión como rauli3514@gmail.com...");

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'rauli3514@gmail.com',
    password: password.trim(),
  });

  if (authError) {
    console.error("Error al iniciar sesión:", authError.message);
    process.exit(1);
  }

  console.log("Sesión iniciada con éxito. Actualizando rol de sebadj@eventpix.com a 'provider'...");

  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'provider' })
    .eq('email', 'sebadj@eventpix.com')
    .select();

  if (error) {
    console.error("Error actualizando perfil:", error);
  } else {
    console.log("✅ ¡Rol actualizado con éxito en Supabase!", data);
  }
});
