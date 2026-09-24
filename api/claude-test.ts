// ================================================================
// api/claude-test.ts
// Función serverless de Vercel — prueba una API key de Claude y
// autodetecta modelo/workspace habilitados.
// Espejo en producción del middleware /api/claude-test de vite.config.ts
// (que solo corre en `npm run dev`). Mantener ambos en sync si se toca uno.
// ================================================================

export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } });
    return;
  }

  try {
    const { apiKey, model, workspaceId } = req.body || {};
    const testModel = model || 'claude-3-5-sonnet-20241022';
    const cleanKey = (apiKey || '').trim();
    let effectiveWorkspaceId = workspaceId;

    const makeHeaders = (wId?: string) => {
      const headers: Record<string, string> = {
        'x-api-key': cleanKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      };
      if (wId) headers['anthropic-workspace-id'] = wId;
      return headers;
    };

    // Consultar modelos disponibles habilitados para esta cuenta
    let availableModels: string[] = [];
    try {
      const modelsRes = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: { 'x-api-key': cleanKey, 'anthropic-version': '2023-06-01' }
      });
      if (modelsRes.ok) {
        const modelsData: any = await modelsRes.json();
        if (Array.isArray(modelsData.data)) {
          availableModels = modelsData.data.map((m: any) => m.id);
        }
      }
    } catch {
      // Sigue con la lista fija si /v1/models falla
    }

    const modelsToTry = [
      testModel,
      ...availableModels,
      'claude-3-7-sonnet-20250219',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
      'claude-sonnet-4-6',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307'
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let anthropicRes: Response | null = null;
    let data: any = null;
    let successfulModel = testModel;

    for (const candidateModel of modelsToTry) {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: makeHeaders(effectiveWorkspaceId),
        body: JSON.stringify({ model: candidateModel, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] })
      });
      data = await anthropicRes.json();

      if (anthropicRes.ok && (data.id || data.content)) {
        successfulModel = candidateModel;
        break;
      }
      if (data.error?.type === 'authentication_error' || data.error?.message?.includes('anthropic-workspace-id')) {
        break;
      }
    }

    if (anthropicRes && anthropicRes.status === 400 && data.error?.message?.includes('anthropic-workspace-id')) {
      try {
        const wsRes = await fetch('https://api.anthropic.com/v1/workspaces', {
          method: 'GET',
          headers: { 'x-api-key': cleanKey, 'anthropic-version': '2023-06-01' }
        });
        const wsData: any = await wsRes.json();
        if (wsData.data && wsData.data.length > 0) {
          effectiveWorkspaceId = wsData.data[0].id;
        }
      } catch {
        // Sin autodetección de workspace posible
      }

      const candidateWorkspaces = [effectiveWorkspaceId, 'default', 'wrkspc_default'].filter(Boolean) as string[];
      for (const candidate of candidateWorkspaces) {
        anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: makeHeaders(candidate),
          body: JSON.stringify({ model: testModel, max_tokens: 10, messages: [{ role: 'user', content: 'ping' }] })
        });
        data = await anthropicRes.json();
        if (anthropicRes.ok) {
          effectiveWorkspaceId = candidate;
          break;
        }
      }
    }

    if (effectiveWorkspaceId) data._detectedWorkspaceId = effectiveWorkspaceId;
    if (successfulModel) data._detectedModel = successfulModel;

    res.status(anthropicRes ? anthropicRes.status : 500).json(data);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message || 'Error de conexión interno con Claude' } });
  }
}
