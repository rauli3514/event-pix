// ================================================================
// api/instagram-scrape.ts
// Función serverless de Vercel — extrae metadata pública de un Reel
// (likes, comentarios, caption, audio) leyendo la página pública de
// Instagram. A diferencia del middleware de desarrollo
// (vite.config.ts), NO intenta yt-dlp: las funciones serverless de
// Vercel no pueden ejecutar binarios externos, así que este endpoint
// se queda solo con el scraping por HTML/embed (que ya era el
// fallback real cuando yt-dlp no está disponible).
// ================================================================

export const config = { maxDuration: 20 };

function decodeHtmlEntities(str: string) {
  if (!str) return '';
  let res = str;
  for (let i = 0; i < 2; i++) {
    res = res
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&apos;/g, "'")
      .replace(/&#064;/g, '@')
      .replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
      })
      .replace(/#x([0-9a-fA-F]+);?/g, (_, hex) => {
        try { return String.fromCodePoint(parseInt(hex, 16)); } catch { return ''; }
      })
      .replace(/&#([0-9]+);?/g, (_, dec) => {
        try { return String.fromCodePoint(parseInt(dec, 10)); } catch { return ''; }
      });
  }
  return res;
}

export default async function handler(req: any, res: any) {
  const targetUrl = req.query?.url as string | undefined;
  if (!targetUrl) {
    res.status(400).json({ error: 'Falta el parámetro url' });
    return;
  }

  try {
    const match = targetUrl.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
    const shortcode = match ? match[1] : '';
    if (!shortcode) {
      const profileMatch = targetUrl.match(/(?:instagram\.com\/|@)([A-Za-z0-9_.]+)/) || targetUrl.match(/^([A-Za-z0-9_.]+)$/);
      if (profileMatch) {
        const username = profileMatch[1].replace(/[/@]/g, '');
        res.status(200).json({
          success: true,
          isProfile: true,
          username,
          profileUrl: `https://www.instagram.com/${username}/`,
          message: `Perfil @${username} identificado correctamente.`
        });
        return;
      }
      res.status(400).json({ error: 'URL de Instagram inválida. Ingresá un @handle, link de perfil o link de Reel.' });
      return;
    }

    const scrapedResult: any = {
      shortcode,
      username: '',
      caption: '',
      imageUrl: '',
      // Instagram dejó de exponer conteos de likes/comentarios en el HTML público
      // (og:description) y en el embed la mayoría de las veces. null = "no se pudo
      // extraer", nunca 0: un 0 de arranque que nunca se sobrescribe se ve idéntico
      // a un reel con cero interacciones reales y termina mostrándose como dato real.
      likes: null as number | null,
      commentsCount: null as number | null,
      comments: [] as any[],
      audioTrack: '',
      followers: '',
      videoUrl: ''
    };

    // 1. Extraer vía OpenGraph y Meta tags de la página principal (con User-Agents rotativos)
    const userAgentsToTry = [
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    ];

    for (const ua of userAgentsToTry) {
      if (scrapedResult.caption && scrapedResult.imageUrl && scrapedResult.likes) break;
      try {
        const pageRes = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'es-419,es;q=0.9,en;q=0.8'
          }
        });

        if (pageRes.ok) {
          const html = await pageRes.text();

          const metaDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i) ||
                           html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:description"/i) ||
                           html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i);

          const metaImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
                          html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i) ||
                          html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i);

          const metaTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i) ||
                            html.match(/<meta[^>]*name="twitter:title"[^>]*content="([^"]+)"/i);

          const ogUrl = html.match(/<meta[^>]*property="og:url"[^>]*content="([^"]+)"/i);
          const keywords = html.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/i);

          if (!scrapedResult.username) {
            if (ogUrl) {
              const uMatch = ogUrl[1].match(/instagram\.com\/([A-Za-z0-9_.]+)\//i);
              if (uMatch) scrapedResult.username = uMatch[1];
            }
            if (!scrapedResult.username && metaTitle) {
              const titleUserMatch = metaTitle[1].match(/\(@([A-Za-z0-9_.]+)\)/i) ||
                                     metaTitle[1].match(/^([^:]+)\s+(?:en|on)\s+Instagram/i);
              if (titleUserMatch) scrapedResult.username = titleUserMatch[1].replace('@', '').trim();
            }
          }

          if (!scrapedResult.imageUrl && metaImg) {
            scrapedResult.imageUrl = decodeHtmlEntities(metaImg[1]);
          }

          if (metaDesc) {
            const rawDesc = metaDesc[1];
            const likesMatch = rawDesc.match(/([0-9,.]+)\s+likes/i);
            const commsMatch = rawDesc.match(/([0-9,.]+)\s+comments/i);
            const userInDesc = rawDesc.match(/-\s*([A-Za-z0-9_.]+)\s+(?:el|on)\s+/i);

            if (likesMatch && !scrapedResult.likes) {
              scrapedResult.likes = parseInt(likesMatch[1].replace(/[,.]/g, ''), 10);
            }
            if (commsMatch && !scrapedResult.commentsCount) {
              scrapedResult.commentsCount = parseInt(commsMatch[1].replace(/[,.]/g, ''), 10);
            }
            if (userInDesc && !scrapedResult.username) {
              scrapedResult.username = userInDesc[1];
            }

            const colonIdx = rawDesc.indexOf(':');
            if (colonIdx !== -1 && !scrapedResult.caption) {
              const extractedText = rawDesc.slice(colonIdx + 1).replace(/^[\s&quot;"]+|[\s&quot;"]+$/g, '').trim();
              if (extractedText.length > 5) {
                scrapedResult.caption = decodeHtmlEntities(extractedText);
              }
            }
          }

          if (!scrapedResult.caption && keywords) {
            const kwText = decodeHtmlEntities(keywords[1]).split(',').slice(0, 5).join(' • ');
            scrapedResult.caption = `Reel: ${kwText}`;
          }
        }
      } catch {
        // Probar el siguiente User-Agent
      }
    }

    // 2. Extraer o completar con Instagram embed
    if (!scrapedResult.caption || !scrapedResult.imageUrl) {
      try {
        const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
        const igResponse = await fetch(embedUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        if (igResponse.ok) {
          const html = await igResponse.text();

          if (!scrapedResult.username) {
            const userMatch = html.match(/class="CaptionUsername"[^>]*>([^<]+)<\/a>/i);
            if (userMatch) scrapedResult.username = userMatch[1].trim();
          }

          if (!scrapedResult.caption) {
            const captionMatch = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
            if (captionMatch) {
              scrapedResult.caption = decodeHtmlEntities(
                captionMatch[1]
                  .replace(/<div class="CaptionComments"[\s\S]*$/, '')
                  .replace(/<a class="CaptionUsername"[\s\S]*?<\/a>/, '')
                  .replace(/<br\s*\/?>/gi, '\n')
                  .replace(/<[^>]+>/g, '')
              ).trim();
            }
          }

          if (!scrapedResult.imageUrl) {
            const imgMatch = html.match(/<img[^>]*class="EmbeddedMediaImage"[^>]*src="([^"]+)"/i) ||
                             html.match(/<img[^>]*src="([^"]+)"[^>]*class="EmbeddedMediaImage"/i);
            if (imgMatch) scrapedResult.imageUrl = decodeHtmlEntities(imgMatch[1]);
          }

          const likesMatch = html.match(/class="SocialProof"[^>]*>.*?([0-9,.]+)\s+likes/is) ||
                             html.match(/([0-9,.]+)\s+likes<\/a>/i);
          if (likesMatch && !scrapedResult.likes) {
            scrapedResult.likes = parseInt(likesMatch[1].replace(/[,.]/g, ''), 10);
          }

          const audioMatch = html.match(/class="HeaderSecondaryContent"[^>]*><span>([^<]+)<\/span>/i);
          if (audioMatch && !scrapedResult.audioTrack) {
            scrapedResult.audioTrack = decodeHtmlEntities(audioMatch[1].trim());
          }
        }
      } catch {
        // Sin datos adicionales del embed
      }
    }

    res.status(200).json({
      success: true,
      ...scrapedResult,
      permalink: `https://www.instagram.com/p/${shortcode}/`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Error al procesar Instagram' });
  }
}
