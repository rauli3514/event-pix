import { Router } from 'express';
import { randomUUID } from 'crypto';
import { AnalyzeProfileRequest, ProfileReport } from '../types/profile.js';
import { getInstagramProvider, ProfileNotFoundError, ProviderConfigError } from '../providers/instagram/index.js';
import { getTikTokProvider } from '../providers/tiktok/index.js';
import { computeAnalytics } from '../analytics/engine.js';
import { generateExecutiveSummary } from '../ai/executiveSummary.js';
import { reportStore } from '../storage/reportStore.js';

export const profilesRouter = Router();

function isValidUsername(username: unknown): username is string {
  return typeof username === 'string' && /^[a-zA-Z0-9._]{1,80}$/.test(username.trim());
}

/**
 * POST /api/profiles/analyze
 * Body: { "username": "shop_plumas", "platform": "instagram", "period_days"?: 30 }
 *
 * Trae los datos publicos del perfil, calcula las metricas y genera el resumen
 * ejecutivo con IA. No pide ni almacena contrasenas de ninguna red social.
 */
profilesRouter.post('/analyze', async (req, res) => {
  const body = req.body as Partial<AnalyzeProfileRequest>;

  if (!isValidUsername(body.username)) {
    return res.status(400).json({ error: 'username invalido o faltante.' });
  }
  if (body.platform !== 'instagram' && body.platform !== 'tiktok') {
    return res.status(400).json({ error: 'platform debe ser "instagram" o "tiktok".' });
  }

  const username = body.username.trim().replace(/^@/, '');
  const platform = body.platform;
  const periodDays = body.period_days && body.period_days > 0 ? body.period_days : 30;

  try {
    const provider = platform === 'instagram' ? getInstagramProvider() : getTikTokProvider();
    const raw = await provider.fetchProfile(username);

    const analytics = computeAnalytics(raw, periodDays);
    const summary = await generateExecutiveSummary({ username: raw.username, platform, analytics });

    const report: ProfileReport = {
      id: randomUUID(),
      platform,
      username: raw.username,
      provider: raw.source,
      raw,
      analytics,
      executive_summary: summary.text,
      executive_summary_source: summary.source,
      created_at: new Date().toISOString(),
    };

    reportStore.save(report);
    return res.status(201).json(report);
  } catch (err) {
    if (err instanceof ProfileNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof ProviderConfigError) {
      return res.status(503).json({ error: err.message });
    }
    console.error('[POST /api/profiles/analyze]', err);
    return res.status(502).json({ error: 'No se pudo obtener/analizar el perfil. Intenta nuevamente.' });
  }
});

/**
 * GET /api/profiles/:id
 * Devuelve el reporte completo (metricas + resumen ejecutivo) generado por un
 * analisis previo.
 */
profilesRouter.get('/:id', (req, res) => {
  const report = reportStore.getById(req.params.id);
  if (!report) {
    return res.status(404).json({ error: `No existe ningun reporte con id ${req.params.id}.` });
  }
  return res.json(report);
});

/** GET /api/profiles - lista los reportes generados en esta instancia (util para debug/demo). */
profilesRouter.get('/', (_req, res) => {
  res.json(reportStore.list());
});
