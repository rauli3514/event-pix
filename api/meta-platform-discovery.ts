// ================================================================
// api/meta-platform-discovery.ts
// Función serverless de Vercel — consulta business_discovery de Meta
// usando la cuenta de Instagram Business/Creator PROPIA de la plataforma
// (META_PLATFORM_ACCESS_TOKEN / META_PLATFORM_IG_ACCOUNT_ID, configuradas
// en Vercel, nunca expuestas al cliente). Sirve como respaldo para
// negocios que todavía no conectaron su propia cuenta de Meta: business_discovery
// solo necesita el token de NUESTRA cuenta para consultar los datos
// públicos de CUALQUIER otra cuenta Business/Creator, incluida la propia
// del negocio si prefiere no pasar por el OAuth de Meta él mismo.
// Nunca inventa datos: si Meta no puede resolver la cuenta, se devuelve
// success:false con el motivo real.
// ================================================================

export const config = { maxDuration: 15 };

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export default async function handler(req: any, res: any) {
  const accessToken = process.env.META_PLATFORM_ACCESS_TOKEN;
  const igAccountId = process.env.META_PLATFORM_IG_ACCOUNT_ID;

  if (!accessToken || !igAccountId) {
    res.status(200).json({
      success: false,
      error: 'La cuenta compartida de la plataforma todavía no está configurada (faltan META_PLATFORM_ACCESS_TOKEN / META_PLATFORM_IG_ACCOUNT_ID en Vercel).'
    });
    return;
  }

  const rawUsername = req.query?.username as string | undefined;
  if (!rawUsername) {
    res.status(400).json({ success: false, error: 'Falta el parámetro username' });
    return;
  }

  const username = rawUsername.trim().replace(/^@/, '');
  if (!username) {
    res.status(200).json({ success: false, error: 'Nombre de usuario vacío.' });
    return;
  }

  const limitParam = parseInt((req.query?.limit as string) || '25', 10);
  const mediaLimit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 25;

  const fields = `business_discovery.username(${username}){username,name,profile_picture_url,followers_count,media_count,media.limit(${mediaLimit}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;

  try {
    const url = new URL(`${META_GRAPH_BASE}/${igAccountId}`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('access_token', accessToken);

    const metaRes = await fetch(url.toString());
    const data = await metaRes.json();

    if (!metaRes.ok || data.error) {
      res.status(200).json({
        success: false,
        error: data.error?.message || `Error de Meta (${metaRes.status})`
      });
      return;
    }

    if (!data.business_discovery) {
      res.status(200).json({
        success: false,
        error: `"@${username}" no es una cuenta Business/Creator pública de Instagram (o no existe), así que Meta no permite consultar sus métricas por este medio.`
      });
      return;
    }

    const bd = data.business_discovery;
    res.status(200).json({
      success: true,
      data: {
        username: bd.username,
        name: bd.name,
        profile_picture_url: bd.profile_picture_url,
        followers_count: bd.followers_count,
        media_count: bd.media_count,
        media: bd.media?.data || []
      }
    });
  } catch (err: any) {
    res.status(200).json({ success: false, error: err?.message || 'Error consultando la cuenta en Meta.' });
  }
}
