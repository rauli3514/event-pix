// ================================================================
// api/claude-messages.ts
// Función serverless de Vercel — proxea generación de contenido con
// Claude (evita CORS del navegador hacia api.anthropic.com).
// Espejo en producción del middleware /api/claude-messages de
// vite.config.ts (que solo corre en `npm run dev`).
// ================================================================

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    const { apiKey, model, max_tokens, messages, workspaceId, system } = req.body || {};
    const headers: Record<string, string> = {
      'x-api-key': (apiKey || '').trim(),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    };
    if (workspaceId) headers['anthropic-workspace-id'] = workspaceId;

    const requestedModel = model || 'claude-3-5-sonnet-20241022';
    const modelsToTry = [
      requestedModel,
      'claude-sonnet-4-6',
      'claude-3-5-sonnet-latest',
      'claude-3-7-sonnet-latest',
      'claude-3-haiku-20240307',
      'claude-3-5-haiku-latest'
    ].filter((m, i, arr) => m && arr.indexOf(m) === i);

    let lastData: any = null;
    let lastStatus = 500;

    for (const candidate of modelsToTry) {
      const payload: any = { model: candidate, max_tokens: max_tokens || 2000, messages: messages || [] };
      if (system) payload.system = system;

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      lastStatus = anthropicRes.status;
      lastData = await anthropicRes.json();

      if (anthropicRes.ok) break;
      if (anthropicRes.status !== 404) break;
    }

    res.status(lastStatus).json(lastData);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Error en proxy de Claude' } });
  }
}
