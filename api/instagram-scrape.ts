import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser } from './_lib/auth.js';
import { scrapeInstagramUrl } from './_lib/instagramScraper.js';

/**
 * GET /api/instagram-scrape?url=<link o @handle>
 *
 * Diferencia entre:
 *  - Un link de Reel/Post especifico (/p/, /reel/, /tv/) -> devuelve la metadata
 *    de esa publicacion puntual (isProfile: false).
 *  - Un link de perfil o un @handle suelto -> devuelve los datos globales del
 *    perfil (seguidores, bio, foto) y sus ultimos posts para importar en lote
 *    (isProfile: true, posts: [...]).
 *
 * No pide ni almacena contrasenas de Instagram: los datos se obtienen via un
 * proveedor externo de scraping de perfiles publicos (Apify), configurado por
 * variables de entorno del servidor.
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

  const url = typeof req.query.url === 'string' ? req.query.url : Array.isArray(req.query.url) ? req.query.url[0] : '';
  if (!url) {
    res.status(400).json({ success: false, error: 'Falta el parametro "url".' });
    return;
  }

  const result = await scrapeInstagramUrl(url);

  if (!result.success) {
    res.status(result.configured === false ? 503 : 502).json(result);
    return;
  }

  res.status(200).json(result);
}
