import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuthenticatedUser } from './_lib/auth.js';
import { scrapeInstagramUrl, isSinglePostUrl } from './_lib/instagramScraper.js';
import { getErrorMessage } from './_lib/errors.js';

/**
 * POST /api/instagram-transcribe
 * Body: { "url": "https://www.instagram.com/reel/...", "videoUrl"?: string }
 *
 * Transcribe el audio de un Reel con OpenAI Whisper. La API key de OpenAI se
 * lee EXCLUSIVAMENTE de las variables de entorno del servidor (OPENAI_API_KEY):
 * el cliente ya no puede ni debe mandarla en el body — antes viajaba una clave
 * privada desde el navegador en cada llamada, exponiendola en el trafico de red
 * y en cualquier log de cliente.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Metodo no permitido.' });
    return;
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    res.status(auth.status).json({ error: auth.error });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'La transcripcion no esta configurada en el servidor (falta OPENAI_API_KEY).' });
    return;
  }

  const { url, videoUrl: providedVideoUrl } = (req.body || {}) as { url?: string; videoUrl?: string };
  if (!url && !providedVideoUrl) {
    res.status(400).json({ error: 'Falta "url" (o "videoUrl") del Reel a transcribir.' });
    return;
  }

  try {
    let videoUrl = providedVideoUrl;

    if (!videoUrl) {
      if (!isSinglePostUrl(url!)) {
        res.status(400).json({ error: 'La transcripcion solo aplica a un Reel/Post especifico, no a un perfil.' });
        return;
      }
      const scraped = await scrapeInstagramUrl(url!);
      if (!scraped.success) {
        res.status(scraped.configured === false ? 503 : 502).json({ error: scraped.error });
        return;
      }
      if (scraped.isProfile || !scraped.videoUrl) {
        res.status(422).json({ error: 'Este post no tiene un video del que extraer audio.', hasSpeech: false });
        return;
      }
      videoUrl = scraped.videoUrl;
    }

    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      res.status(502).json({ error: `No se pudo descargar el video del Reel (HTTP ${videoRes.status}).` });
      return;
    }
    const videoBlob = await videoRes.blob();

    const form = new FormData();
    form.append('file', videoBlob, 'reel.mp4');
    form.append('model', 'whisper-1');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!whisperRes.ok) {
      const errText = await whisperRes.text();
      res.status(502).json({ error: `Whisper devolvio un error: ${errText}` });
      return;
    }

    const data = (await whisperRes.json()) as { text?: string };
    const transcript = data.text?.trim() || '';

    res.status(200).json({
      transcript,
      hasSpeech: transcript.length > 0,
    });
  } catch (err) {
    res.status(500).json({ error: getErrorMessage(err) });
  }
}
