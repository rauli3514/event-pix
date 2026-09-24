import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { profilesRouter } from './routes/profiles.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', instagram_provider: env.instagramProvider, tiktok_provider: env.tiktokProvider });
});

app.use('/api/profiles', profilesRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.listen(env.port, () => {
  console.log(`social-analytics-api escuchando en http://localhost:${env.port}`);
  console.log(`  Instagram provider: ${env.instagramProvider}`);
  console.log(`  TikTok provider:    ${env.tiktokProvider}`);
  console.log(`  Anthropic:          ${env.anthropicApiKey ? 'configurado' : 'no configurado (resumen local)'}`);
});
