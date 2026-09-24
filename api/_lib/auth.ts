import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Valida la sesion de Supabase del usuario que llama al endpoint, a partir del
 * access token que el cliente manda en `Authorization: Bearer <token>`.
 * Ningun endpoint bajo /api confia en datos de sesion enviados en el body.
 *
 * En modo demo/local (sin SUPABASE_URL/ANON_KEY configuradas en el servidor,
 * el mismo criterio que ya usa el cliente para su "modo mock") se permite pasar
 * sin sesion real, para no romper el flujo de desarrollo sin backend.
 */

function isServerSupabaseConfigured(): boolean {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('your_supabase_url') && !url.includes('placeholder'));
}

export interface AuthResult {
  ok: true;
  userId: string | null; // null solo quando está en modo demo sin backend real
}

export interface AuthFailure {
  ok: false;
  status: number;
  error: string;
}

export async function requireAuthenticatedUser(req: VercelRequest): Promise<AuthResult | AuthFailure> {
  if (!isServerSupabaseConfigured()) {
    return { ok: true, userId: null };
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    return { ok: false, status: 401, error: 'Falta la sesion de usuario (Authorization: Bearer <token>).' };
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY!;
  const supabase = createClient(url, anonKey);

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: 'Sesion invalida o expirada.' };
  }

  return { ok: true, userId: data.user.id };
}
