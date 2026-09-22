// ================================================================
// api/tiktok-scrape.ts
// Función serverless de Vercel — extrae datos públicos reales de un
// perfil de TikTok (seguidores, videos recientes con vistas/likes/
// comentarios/compartidos) leyendo la página pública, sin login ni
// token de ningún tipo.
//
// A diferencia de Instagram (que ya casi no expone datos en su HTML
// público, ver api/instagram-scrape.ts), TikTok todavía incrusta un
// bloque JSON completo con datos reales en cada página de perfil, en
// un <script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">. Es la misma
// fuente que usan herramientas como Socialinsider o los scrapers de
// Apify para esto — no hace falta ninguna cuenta ni API key de TikTok.
//
// Aviso real: TikTok tiene detección de bots. Sin un proxy residencial
// esto puede empezar a fallar bajo uso intenso — no es un bug de este
// código, es la defensa anti-scraping de TikTok. Cuando falla, se
// reporta el motivo real, nunca se inventan datos.
// ================================================================

export const config = { maxDuration: 20 };

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

interface TikTokVideo {
  id: string;
  caption: string;
  thumbnailUrl: string;
  permalink: string;
  createdAt: string;
  playCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
}

function extractUsername(raw: string): string | null {
  const trimmed = raw.trim();
  const urlMatch = trimmed.match(/tiktok\.com\/@([A-Za-z0-9_.]+)/i);
  if (urlMatch) return urlMatch[1];
  if (!trimmed.includes('/') && !trimmed.includes('?')) {
    const clean = trimmed.replace('@', '');
    if (clean.length > 0) return clean;
  }
  return null;
}

function numberOrNull(v: unknown): number | null {
  return typeof v === 'number' && !isNaN(v) ? v : null;
}

export default async function handler(req: any, res: any) {
  const targetRaw = req.query?.url as string | undefined;
  if (!targetRaw) {
    res.status(400).json({ success: false, error: 'Falta el parámetro url (perfil o @usuario de TikTok).' });
    return;
  }

  const username = extractUsername(targetRaw);
  if (!username) {
    res.status(400).json({ success: false, error: 'No pudimos reconocer un @usuario de TikTok en ese texto.' });
    return;
  }

  try {
    const pageRes = await fetch(`https://www.tiktok.com/@${username}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
      },
    });

    if (!pageRes.ok) {
      res.status(200).json({
        success: false,
        error: `TikTok respondió con estado ${pageRes.status}. Puede que el perfil no exista o que esté bloqueando el pedido temporalmente.`,
      });
      return;
    }

    const html = await pageRes.text();
    const scriptMatch = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );

    if (!scriptMatch) {
      res.status(200).json({
        success: false,
        error: 'TikTok no devolvió los datos esperados para este perfil (posible bloqueo anti-scraping o perfil privado/inexistente).',
      });
      return;
    }

    let rehydration: any;
    try {
      rehydration = JSON.parse(scriptMatch[1]);
    } catch {
      res.status(200).json({ success: false, error: 'No se pudo interpretar la respuesta de TikTok para este perfil.' });
      return;
    }

    const scope = rehydration?.__DEFAULT_SCOPE__ || {};
    const userDetail = scope['webapp.user-detail'];
    const userInfo = userDetail?.userInfo;

    if (!userInfo?.user) {
      res.status(200).json({
        success: false,
        error: `No se encontró el perfil @${username} (puede ser privado, no existir, o TikTok bloqueó el pedido).`,
      });
      return;
    }

    const user = userInfo.user;
    const stats = userInfo.stats || userInfo.statsV2 || {};

    // La lista de videos recientes vive en un scope aparte, "webapp.user-post".
    // No siempre viene junto al perfil (a veces TikTok la carga después con
    // scroll infinito) — si no está, devolvemos el perfil igual, sin inventar videos.
    const itemList = scope['webapp.user-post']?.itemList || [];
    const videos: TikTokVideo[] = itemList.map((item: any) => ({
      id: item.id,
      caption: item.desc || '',
      thumbnailUrl: item.video?.cover || item.video?.dynamicCover || '',
      permalink: `https://www.tiktok.com/@${username}/video/${item.id}`,
      createdAt: item.createTime ? new Date(Number(item.createTime) * 1000).toISOString() : new Date().toISOString(),
      playCount: numberOrNull(item.stats?.playCount),
      likeCount: numberOrNull(item.stats?.diggCount),
      commentCount: numberOrNull(item.stats?.commentCount),
      shareCount: numberOrNull(item.stats?.shareCount),
    }));

    res.status(200).json({
      success: true,
      username: user.uniqueId || username,
      displayName: user.nickname || user.uniqueId || username,
      avatarUrl: user.avatarLarger || user.avatarMedium || user.avatarThumb || '',
      bio: user.signature || '',
      verified: !!user.verified,
      followerCount: numberOrNull(stats.followerCount),
      followingCount: numberOrNull(stats.followingCount),
      heartCount: numberOrNull(stats.heartCount ?? stats.heart),
      videoCount: numberOrNull(stats.videoCount),
      videos,
    });
  } catch (err: any) {
    res.status(200).json({
      success: false,
      error: err?.message || 'Fallo de red al conectar con TikTok.',
    });
  }
}
