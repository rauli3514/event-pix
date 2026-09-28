// ================================================================
// api/instagram-verify-profile.ts
// Función serverless de Vercel — confirma si un @usuario de Instagram
// existe de verdad, leyendo su página pública (sin necesitar el Meta
// Graph API ni que el usuario ya haya conectado su cuenta). Se usa
// como condición al completar "Perfil & Contexto IA": no dejamos
// guardar un handle que no pudimos confirmar que existe.
// Nunca inventa "existe" cuando no lo pudimos verificar: si Instagram
// bloqueó el request o no hay datos claros, devuelve success:false.
// ================================================================

export const config = { maxDuration: 15 };

function decodeHtmlEntities(str: string) {
  if (!str) return '';
  let res = str;
  for (let i = 0; i < 2; i++) {
    res = res
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
      })
      .replace(/&#([0-9]+);?/g, (_, dec) => {
        try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
      });
  }
  return res;
}

function parseCompactNumber(raw: string): number | null {
  const clean = raw.trim().replace(/,/g, '');
  const match = clean.match(/^([0-9.]+)\s*([kKmM]?)$/);
  if (!match) return null;
  const value = parseFloat(match[1]);
  if (Number.isNaN(value)) return null;
  const suffix = match[2].toLowerCase();
  if (suffix === 'k') return Math.round(value * 1_000);
  if (suffix === 'm') return Math.round(value * 1_000_000);
  return Math.round(value);
}

async function verifyViaPlatform(username: string): Promise<{
  success: true;
  exists: boolean;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
} | null> {
  const accessToken = process.env.META_PLATFORM_ACCESS_TOKEN;
  const igAccountId = process.env.META_PLATFORM_IG_ACCOUNT_ID;
  if (!accessToken || !igAccountId) return null;

  try {
    const fields = `business_discovery.username(${username}){username,name,profile_picture_url,followers_count}`;
    const url = new URL(`https://graph.facebook.com/v19.0/${igAccountId}`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('access_token', accessToken);

    const metaRes = await fetch(url.toString());
    const data: any = await metaRes.json();

    if (!metaRes.ok || data.error || !data.business_discovery) return null;

    const bd = data.business_discovery;
    return {
      success: true,
      exists: true,
      username: bd.username,
      displayName: bd.name || null,
      avatarUrl: bd.profile_picture_url || null,
      followerCount: typeof bd.followers_count === 'number' ? bd.followers_count : null
    };
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  const raw = req.query?.username as string | undefined;
  if (!raw) {
    res.status(400).json({ success: false, error: 'Falta el parámetro username' });
    return;
  }

  const username = raw.trim().replace(/^@/, '').replace(/\/$/, '');
  if (!/^[A-Za-z0-9_.]{1,30}$/.test(username)) {
    res.status(200).json({ success: false, error: 'Ese nombre de usuario no tiene un formato válido de Instagram.' });
    return;
  }

  // Intento 1: business_discovery con la cuenta compartida de la plataforma
  // (Meta Graph API oficial, con nuestro propio token — no depende de leer
  // el HTML público, así que no lo bloquea el anti-scraping de Instagram).
  // Solo confirma cuentas Business/Creator; si no aplica, null y seguimos
  // con el scraping — no concluimos "no existe" solo por esto.
  const platformResult = await verifyViaPlatform(username);
  if (platformResult) {
    res.status(200).json(platformResult);
    return;
  }

  const userAgentsToTry = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
  ];

  for (const ua of userAgentsToTry) {
    try {
      const pageRes = await fetch(`https://www.instagram.com/${username}/`, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-419,es;q=0.9,en;q=0.8'
        }
      });

      if (pageRes.status === 404) {
        res.status(200).json({ success: true, exists: false, username });
        return;
      }

      if (pageRes.ok) {
        const html = await pageRes.text();

        if (/Sorry, this page isn't available/i.test(html) || /Página no disponible/i.test(html)) {
          res.status(200).json({ success: true, exists: false, username });
          return;
        }

        const metaDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
        const metaImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
        const metaTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);

        if (metaDesc || metaTitle) {
          let followerCount: number | null = null;
          let displayName: string | null = null;

          if (metaDesc) {
            const followersMatch = metaDesc[1].match(/([0-9.,]+[KMkm]?)\s+Followers/i);
            if (followersMatch) followerCount = parseCompactNumber(followersMatch[1]);
          }

          if (metaTitle) {
            const nameMatch = metaTitle[1].match(/^([^(]+)\(@/);
            if (nameMatch) displayName = decodeHtmlEntities(nameMatch[1].trim());
          }

          res.status(200).json({
            success: true,
            exists: true,
            username,
            displayName,
            avatarUrl: metaImg ? decodeHtmlEntities(metaImg[1]) : null,
            followerCount
          });
          return;
        }
      }
    } catch {
      // Probar el siguiente User-Agent
    }
  }

  res.status(200).json({
    success: false,
    error: 'No pudimos confirmar ese perfil ahora mismo (Instagram puede estar bloqueando la verificación). Probá de nuevo en unos segundos.'
  });
}
