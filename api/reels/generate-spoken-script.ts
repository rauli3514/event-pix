import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser } from '../_lib/auth.js';
import { generateSpokenReelScript } from '../_lib/spokenReelService.js';
import { getErrorMessage } from '../_lib/errors.js';
import type { GenerateSpokenScriptRequest } from '../../src/types/spokenReel.js';

/**
 * POST /api/reels/generate-spoken-script
 * Body: GenerateSpokenScriptRequest { businessId, topic, brandDna }
 *
 * Motor 2 (Spoken Content Engine): genera un guion hablado completo
 * (Hook -> Retain -> Sell) a partir del Brand DNA del negocio y un tema
 * ganador detectado por el Motor 1. La API key del LLM (Claude/OpenAI) se lee
 * unicamente de las variables de entorno del servidor.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Metodo no permitido.' });
    return;
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ success: false, error: auth.error });
    return;
  }

  const body = req.body as Partial<GenerateSpokenScriptRequest>;
  if (!body?.businessId || !body?.topic || !body?.brandDna) {
    res.status(400).json({ success: false, error: 'Faltan "businessId", "topic" o "brandDna" en el body.' });
    return;
  }

  try {
    const { script, provider } = await generateSpokenReelScript(body as GenerateSpokenScriptRequest);
    res.status(200).json({ success: true, script, provider });
  } catch (err) {
    const notConfigured = /no hay ningun proveedor de ia configurado/i.test(getErrorMessage(err));
    res.status(notConfigured ? 503 : 502).json({ success: false, error: getErrorMessage(err) || 'Error al generar el guion.' });
  }
}
