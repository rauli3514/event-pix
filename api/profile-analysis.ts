import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser } from './_lib/auth.js';
import { analyzeInstagramProfile } from './_lib/instagramScraper.js';

/**
 * GET /api/profile-analysis?username=shop_plumas
 * (tambien acepta ?username=@shop_plumas o una URL completa de perfil)
 *
 * Motor 1 (Analizador de Perfiles Publicos): trae el perfil - propio o de un
 * competidor -, calcula el engagement rate de cada uno de sus ultimos posts y
 * devuelve los top reels ordenados junto con los formatos ganadores.
 * No pide ni usa contrasenas del perfil consultado.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Metodo no permitido.' });
    return;
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ success: false, error: auth.error });
    return;
  }

  const raw = req.query.username ?? req.query.url;
  const usernameOrUrl = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : '';

  if (!usernameOrUrl) {
    res.status(400).json({ success: false, error: 'Falta el parametro "username" (o "url").' });
    return;
  }

  const result = await analyzeInstagramProfile(usernameOrUrl);

  if (!result.success) {
    res.status(result.configured === false ? 503 : 502).json(result);
    return;
  }

  res.status(200).json(result);
}
