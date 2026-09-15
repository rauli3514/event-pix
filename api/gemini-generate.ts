// ================================================================
// api/gemini-generate.ts
// Función serverless de Vercel — proxea generateContent de Gemini.
// Espejo en producción del middleware /api/gemini-generate de
// vite.config.ts (que solo corre en `npm run dev`).
// ================================================================

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    const { apiKey, model, contents, systemInstruction, generationConfig } = req.body || {};
    const cleanKey = (apiKey || '').trim();
    if (!cleanKey) {
      res.status(400).json({ error: { message: 'API Key de Gemini requerida' } });
      return;
    }

    const targetModel = model || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${cleanKey}`;

    const payload: any = { contents: contents || [] };
    if (systemInstruction) {
      payload.systemInstruction = typeof systemInstruction === 'string'
        ? { parts: [{ text: systemInstruction }] }
        : systemInstruction;
    }
    if (generationConfig) payload.generationConfig = generationConfig;

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await geminiRes.json();
    res.status(geminiRes.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Error en proxy de Gemini' } });
  }
}
