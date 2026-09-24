import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser } from './_lib/auth.js';
import { getErrorMessage } from './_lib/errors.js';

export const config = { maxDuration: 20 };

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

interface BusinessDiscoveryMedia {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

interface BusinessDiscoveryPayload {
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  media?: { data: BusinessDiscoveryMedia[] };
}

/**
 * GET /api/meta-business-discovery?username=<handle>&limit=25
 *
 * Fallback de plataforma para MetaGraphService.getBusinessDiscovery(): trae
 * datos PUBLICOS de cualquier cuenta Business/Creator de Instagram (seguidores,
 * ultimos posts con likes/comentarios) usando UNA SOLA cuenta de Meta
 * configurada por el Admin en el servidor (META_PLATFORM_ACCESS_TOKEN +
 * META_PLATFORM_IG_ACCOUNT_ID), en vez de exigirle a cada negocio/cliente que
 * conecte su propia cuenta solo para poder analizar perfiles publicos.
 *
 * No devuelve datos privados (reach, guardados, insights) de la cuenta
 * consultada — Meta nunca expone eso a traves de business_discovery, sin
 * importar que cuenta se use como "llave". Para los datos privados de CADA
 * negocio (sus propios Reels, DMs, etc.) sigue haciendo falta que ese negocio
 * conecte su propia cuenta desde "Conectar APIs".
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

  const token = process.env.META_PLATFORM_ACCESS_TOKEN;
  const viewerId = process.env.META_PLATFORM_IG_ACCOUNT_ID;
  if (!token || !viewerId) {
    res.status(503).json({
      success: false,
      error:
        'El análisis de perfiles públicos todavía no está configurado en el servidor (falta META_PLATFORM_ACCESS_TOKEN / META_PLATFORM_IG_ACCOUNT_ID).',
    });
    return;
  }

  const rawUsername = req.query.username;
  const username = (typeof rawUsername === 'string' ? rawUsername : Array.isArray(rawUsername) ? rawUsername[0] : '')
    .replace('@', '')
    .trim();
  if (!username) {
    res.status(400).json({ success: false, error: 'Falta el parametro "username".' });
    return;
  }

  const rawLimit = req.query.limit;
  const parsedLimit = Number(Array.isArray(rawLimit) ? rawLimit[0] : rawLimit);
  const mediaLimit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 25;

  const fields =
    `business_discovery.username(${username}){username,name,profile_picture_url,followers_count,media_count,` +
    `media.limit(${mediaLimit}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const metaRes = await fetch(
      `${META_GRAPH_BASE}/${viewerId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(token)}`,
      { signal: controller.signal }
    ).finally(() => clearTimeout(timer));
    const data = (await metaRes.json()) as {
      business_discovery?: BusinessDiscoveryPayload;
      error?: { message?: string };
    };

    if (!metaRes.ok || data.error) {
      res.status(502).json({ success: false, error: data.error?.message || `Meta devolvió HTTP ${metaRes.status}` });
      return;
    }

    const bd = data.business_discovery;
    if (!bd) {
      res.status(404).json({
        success: false,
        error: `"@${username}" no es una cuenta Business/Creator pública de Instagram (o no existe), así que Meta no permite consultar sus métricas.`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        username: bd.username,
        name: bd.name,
        profile_picture_url: bd.profile_picture_url,
        followers_count: bd.followers_count,
        media_count: bd.media_count,
        media: bd.media?.data || [],
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      res.status(504).json({ success: false, error: 'Meta no respondió a tiempo. Probá de nuevo en unos segundos.' });
      return;
    }
    res.status(500).json({ success: false, error: getErrorMessage(err) });
  }
}
