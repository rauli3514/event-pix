// ================================================================
// api/gemini-test.ts
// Función serverless de Vercel — prueba una API key de Gemini.
// Espejo en producción del middleware /api/gemini-test de
// vite.config.ts (que solo corre en `npm run dev`).
// ================================================================

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    const { apiKey } = req.body || {};
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      res.status(400).json({ error: { message: 'API Key de Gemini vacía' } });
      return;
    }

    const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    const data = await testRes.json();
    res.status(testRes.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Error de red con Gemini' } });
  }
}
