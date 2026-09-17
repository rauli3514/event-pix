// ================================================================
// api/instagram-connection-test.ts
// Proxy serverless para probar credenciales de Instagram (graph.instagram.com).
// El navegador no puede llamar directo a graph.instagram.com: ese dominio
// no responde el preflight CORS que exige cualquier fetch con header
// Authorization, así que el intento directo desde MetaConnectionPanel /
// UnifiedConnectionsModal siempre tiraba "Failed to fetch" sin importar
// si el token era válido. Server-to-server no tiene ese problema.
// ================================================================

export const config = { maxDuration: 15 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { accessToken, instagramAccountId } = req.body || {};
    if (!accessToken || !instagramAccountId) {
      res.status(400).json({ success: false, error: 'Access Token e Instagram Account ID son requeridos.' });
      return;
    }

    const url = `https://graph.instagram.com/v21.0/${String(instagramAccountId).trim()}?fields=id,username`;
    const metaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${String(accessToken).trim()}` }
    });
    const data = await metaRes.json();

    if (!metaRes.ok || data.error) {
      res.status(200).json({ success: false, error: data.error?.message || `Error de Meta API (${metaRes.status})` });
      return;
    }

    res.status(200).json({ success: true, instagramAccountId: data.id, username: data.username });
  } catch (err: any) {
    res.status(200).json({ success: false, error: err.message || 'Fallo de red al conectar con Instagram Graph API.' });
  }
}
