// ================================================================
// api/instagram-transcribe.ts
// Función serverless de Vercel — transcribe el audio de un Reel con
// OpenAI Whisper.
//
// A diferencia del middleware de desarrollo (vite.config.ts), que baja
// el video con yt-dlp a partir del link público del Reel, esta función
// NO puede ejecutar yt-dlp (las funciones serverless de Vercel no
// corren binarios externos). En su lugar, requiere `mediaUrl`: el link
// directo y descargable al archivo de video que Meta Graph API entrega
// para los Reels de una cuenta conectada (`IntelligencePost.meta_media_url`).
// Por eso esta función solo transcribe Reels importados por una cuenta
// de Instagram conectada por Meta Graph API, no cualquier link público.
// ================================================================

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { mediaUrl, apiKey } = req.body || {};

    if (!apiKey) {
      res.status(400).json({ error: 'Se requiere una API Key de OpenAI para transcribir con Whisper.' });
      return;
    }
    if (!mediaUrl) {
      res.status(400).json({
        error: 'Este Reel no tiene un archivo de video descargable. La transcripción automática en producción solo funciona con Reels importados desde una cuenta de Instagram conectada por Meta Graph API.'
      });
      return;
    }

    const videoRes = await fetch(mediaUrl);
    if (!videoRes.ok) {
      res.status(502).json({ error: 'No se pudo descargar el video del Reel desde Meta.' });
      return;
    }
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
    const blob = new Blob([videoBuffer], { type: 'video/mp4' });

    const formData = new FormData();
    formData.append('file', blob, 'reel.mp4');
    formData.append('model', 'whisper-1');
    formData.append('language', 'es');
    formData.append('response_format', 'verbose_json');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });

    if (!whisperRes.ok) {
      const errJson: any = await whisperRes.json().catch(() => ({}));
      res.status(whisperRes.status).json({ error: errJson?.error?.message || 'Error en la llamada a Whisper API' });
      return;
    }

    const whisperData: any = await whisperRes.json();
    const text = (whisperData.text || '').trim();
    const segments = (whisperData.segments || []).map((s: any) => ({
      range: `${Math.round(s.start)}-${Math.round(s.end)}s`,
      content: s.text.trim()
    }));

    const hasSpeech = text.length > 5;

    res.status(200).json({
      success: true,
      hasSpeech,
      transcript: text,
      segments: segments.length > 0 ? segments : (text ? [{ range: '0-25s', content: text }] : []),
      message: hasSpeech
        ? 'Transcripción completada automáticamente palabra por palabra.'
        : 'Audio analizado: Es una pista musical sin diálogo de voz detectado.'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al transcribir Reel' });
  }
}
