import { supabase } from './supabase';

/**
 * Header de autorizacion con la sesion actual de Supabase, para llamar de
 * forma segura a los endpoints de /api/*. Esos endpoints validan este token
 * server-side (ver api/_lib/auth.ts) — nunca hay que mandar API keys propias
 * (OpenAI/Anthropic/etc.) desde el cliente en el body de la request.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}
