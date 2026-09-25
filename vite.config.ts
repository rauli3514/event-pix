import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import legacy from '@vitejs/plugin-legacy'
import path from 'path'
import fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true, // Permite conexiones desde la IP del emulador (10.0.2.2)
    proxy: {
      '/api/replicate': {
        target: 'https://api.replicate.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/replicate/, '')
      }
    }
  },
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 49', 'android >= 5', 'safari >= 9'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    }),
    {
      name: 'instagram-scraper-and-old-assets',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/assets/index-') && req.url.endsWith('.js')) {
            res.statusCode = 404;
            res.end();
            return;
          }
          next();
        });

        // Middleware para transcribir Reels automáticamente con OpenAI Whisper
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/instagram-transcribe') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { url, apiKey } = JSON.parse(body || '{}');
                if (!url) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Falta el parámetro url' }));
                  return;
                }

                if (!apiKey) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Se requiere una API Key de OpenAI para transcribir con Whisper.' }));
                  return;
                }

                const match = url.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
                const shortcode = match ? match[1] : `reel_${Date.now()}`;
                const tempDir = path.resolve(__dirname, 'dev-dist');
                if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                const tempFilePath = path.join(tempDir, `transcribe_${shortcode}.mp4`);

                // Descargar audio/video con yt-dlp
                const { exec } = await import('child_process');
                await new Promise((resolve, reject) => {
                  exec(
                    `python3 -m yt_dlp --no-check-certificates -o "${tempFilePath}" "${url}"`,
                    { timeout: 30000 },
                    (err) => {
                      if (err) return reject(err);
                      resolve(true);
                    }
                  );
                });

                if (!fs.existsSync(tempFilePath)) {
                  throw new Error('No se pudo descargar el medio del Reel para transcripción.');
                }

                // Leer archivo y enviar a OpenAI Whisper
                const fileBuffer = fs.readFileSync(tempFilePath);
                const blob = new Blob([fileBuffer], { type: 'video/mp4' });
                const formData = new FormData();
                formData.append('file', blob, `${shortcode}.mp4`);
                formData.append('model', 'whisper-1');
                formData.append('language', 'es');
                formData.append('response_format', 'verbose_json');

                const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`
                  },
                  body: formData
                });

                // Limpiar archivo temporal
                try { fs.unlinkSync(tempFilePath); } catch {}

                if (!whisperRes.ok) {
                  const errJson: any = await whisperRes.json().catch(() => ({}));
                  throw new Error(errJson?.error?.message || 'Error en la llamada a Whisper API');
                }

                const whisperData: any = await whisperRes.json();
                const text = (whisperData.text || '').trim();
                const segments = (whisperData.segments || []).map((s: any) => ({
                  range: `${Math.round(s.start)}-${Math.round(s.end)}s`,
                  content: s.text.trim()
                }));

                const hasSpeech = text.length > 5;

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  success: true,
                  hasSpeech,
                  transcript: text,
                  segments: segments.length > 0 ? segments : (text ? [{ range: '0-25s', content: text }] : []),
                  message: hasSpeech
                    ? 'Transcripción completada automáticamente palabra por palabra.'
                    : 'Audio analizado: Es una pista musical sin diálogo de voz detectado.'
                }));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message || 'Error al transcribir Reel' }));
              }
            });
            return;
          }
          next();
        });

        // Middleware para probar o proxear llamadas a Claude Anthropic
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/claude-test') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { apiKey, model, workspaceId } = JSON.parse(body || '{}');
                const testModel = model || 'claude-3-5-sonnet-20241022';
                console.log(`[Vite Claude Test] Probando modelo: ${testModel}, key: ${apiKey ? apiKey.slice(0, 15) + '...' + apiKey.slice(-4) : 'VACIA'}`);

                const cleanKey = (apiKey || '').trim();
                let effectiveWorkspaceId = workspaceId;

                const makeHeaders = (wId?: string) => {
                  const headers: Record<string, string> = {
                    'x-api-key': cleanKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                  };
                  if (wId) {
                    headers['anthropic-workspace-id'] = wId;
                  }
                  return headers;
                };

                // Consultar modelos disponibles habilitados para esta cuenta
                let availableModels: string[] = [];
                try {
                  const modelsRes = await fetch('https://api.anthropic.com/v1/models', {
                    method: 'GET',
                    headers: {
                      'x-api-key': cleanKey,
                      'anthropic-version': '2023-06-01'
                    }
                  });
                  if (modelsRes.ok) {
                    const modelsData: any = await modelsRes.json();
                    if (Array.isArray(modelsData.data)) {
                      availableModels = modelsData.data.map((m: any) => m.id);
                      console.log('[Vite Claude Test] Modelos habilitados en la cuenta:', availableModels);
                    }
                  } else {
                    console.log('[Vite Claude Test] /v1/models status:', modelsRes.status);
                  }
                } catch (mErr) {
                  console.warn('[Vite Claude Test] Error consultando /v1/models:', mErr);
                }

                // Modelos a probar en orden prioritario
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

                let anthropicRes: any = null;
                let data: any = null;
                let successfulModel = testModel;

                for (const candidateModel of modelsToTry) {
                  console.log(`[Vite Claude Test] Probando con candidato: ${candidateModel}...`);
                  anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: makeHeaders(effectiveWorkspaceId),
                    body: JSON.stringify({
                      model: candidateModel,
                      max_tokens: 10,
                      messages: [{ role: 'user', content: 'ping' }]
                    })
                  });

                  data = await anthropicRes.json();
                  console.log(`[Vite Claude Test] Modelo ${candidateModel} status: ${anthropicRes.status}`, JSON.stringify(data));

                  if (anthropicRes.ok && (data.id || data.content)) {
                    successfulModel = candidateModel;
                    break;
                  }

                  // Si el error es de workspace o billing o auth, no es problema de modelo
                  if (data.error?.type === 'authentication_error' || data.error?.message?.includes('anthropic-workspace-id')) {
                    break;
                  }
                }

                // Si pide workspace, intentar autodescubrirlo con /v1/workspaces
                if (anthropicRes.status === 400 && data.error?.message?.includes('anthropic-workspace-id')) {
                  console.log('[Vite Claude Test] Autodetectando workspaces en Anthropic...');
                  try {
                    const wsRes = await fetch('https://api.anthropic.com/v1/workspaces', {
                      method: 'GET',
                      headers: {
                        'x-api-key': cleanKey,
                        'anthropic-version': '2023-06-01'
                      }
                    });
                    const wsData: any = await wsRes.json();
                    console.log(`[Vite Claude Test] Workspaces API status: ${wsRes.status}`, JSON.stringify(wsData));
                    if (wsData.data && wsData.data.length > 0) {
                      effectiveWorkspaceId = wsData.data[0].id;
                      console.log(`[Vite Claude Test] Workspace autodetectado: ${effectiveWorkspaceId}`);
                    }
                  } catch (wsErr) {
                    console.warn('[Vite Claude Test] Error al consultar workspaces:', wsErr);
                  }

                  // Si encontramos o probamos candidatos comunes
                  const candidateWorkspaces = [effectiveWorkspaceId, 'default', 'wrkspc_default'].filter(Boolean) as string[];
                  for (const candidate of candidateWorkspaces) {
                    console.log(`[Vite Claude Test] Reintentando con anthropic-workspace-id: "${candidate}"...`);
                    anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                      method: 'POST',
                      headers: makeHeaders(candidate),
                      body: JSON.stringify({
                        model: testModel,
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'ping' }]
                      })
                    });
                    data = await anthropicRes.json();
                    console.log(`[Vite Claude Test] Reintento con "${candidate}" status: ${anthropicRes.status}`, JSON.stringify(data));
                    if (anthropicRes.ok) {
                      effectiveWorkspaceId = candidate;
                      break;
                    }
                  }
                }

                if (effectiveWorkspaceId) {
                  data._detectedWorkspaceId = effectiveWorkspaceId;
                }
                if (successfulModel) {
                  data._detectedModel = successfulModel;
                }

                res.statusCode = anthropicRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                console.error('[Vite Claude Test Exception]:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: err.message || 'Error de conexión interno con Claude' } }));
              }
            });
            return;
          }

          // Proxy para generación completa con Claude (evita CORS y adjunta workspaceId)
          if (req.url && req.url.startsWith('/api/claude-messages') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { apiKey, model, max_tokens, messages, workspaceId, system } = JSON.parse(body || '{}');
                const headers: Record<string, string> = {
                  'x-api-key': (apiKey || '').trim(),
                  'anthropic-version': '2023-06-01',
                  'content-type': 'application/json'
                };
                if (workspaceId) {
                  headers['anthropic-workspace-id'] = workspaceId;
                }

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
                  const payload: any = {
                    model: candidate,
                    max_tokens: max_tokens || 2000,
                    messages: messages || []
                  };
                  if (system) {
                    payload.system = system;
                  }

                  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                  });

                  lastStatus = anthropicRes.status;
                  lastData = await anthropicRes.json();

                  if (anthropicRes.ok) {
                    break;
                  }

                  // Si el error no es 404 (modelo no encontrado), no seguir probando otros modelos
                  if (anthropicRes.status !== 404) {
                    break;
                  }
                }

                res.statusCode = lastStatus;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(lastData));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: err.message || 'Error en proxy de Claude' } }));
              }
            });
            return;
          }

          // Middleware para Google Gemini API (generateContent)
          if (req.url && req.url.startsWith('/api/gemini-generate') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { apiKey, model, contents, systemInstruction, generationConfig } = JSON.parse(body || '{}');
                const cleanKey = (apiKey || '').trim();
                if (!cleanKey) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: { message: 'API Key de Gemini requerida' } }));
                  return;
                }

                const targetModel = model || 'gemini-1.5-flash';
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${cleanKey}`;
                
                const payload: any = {
                  contents: contents || []
                };
                if (systemInstruction) {
                  payload.systemInstruction = typeof systemInstruction === 'string'
                    ? { parts: [{ text: systemInstruction }] }
                    : systemInstruction;
                }
                if (generationConfig) {
                  payload.generationConfig = generationConfig;
                }

                const geminiRes = await fetch(url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });

                const data = await geminiRes.json();
                res.statusCode = geminiRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: err.message || 'Error en proxy de Gemini' } }));
              }
            });
            return;
          }

          // Middleware para probar Google Gemini API Key
          if (req.url && req.url.startsWith('/api/gemini-test') && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const { apiKey } = JSON.parse(body || '{}');
                const cleanKey = (apiKey || '').trim();
                if (!cleanKey) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: { message: 'API Key de Gemini vacía' } }));
                  return;
                }

                const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
                const data = await testRes.json();
                res.statusCode = testRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
              } catch (err: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: { message: err.message || 'Error de red con Gemini' } }));
              }
            });
            return;
          }
          next();
        });


        // Middleware para Scrapear Reel (Metadata, Likes reales, Comentarios, Audio)
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/instagram-scrape')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Falta el parámetro url' }));
              return;
            }

            try {
              const match = targetUrl.match(/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
              const shortcode = match ? match[1] : '';
              if (!shortcode) {
                // Puede ser una URL de perfil o un handle: ej. https://www.instagram.com/shop_plumas/ o @shop_plumas
                const profileMatch = targetUrl.match(/(?:instagram\.com\/|@)([A-Za-z0-9_.]+)/) || targetUrl.match(/^([A-Za-z0-9_.]+)$/);
                if (profileMatch) {
                  const username = profileMatch[1].replace(/[\/@]/g, '');
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true,
                    isProfile: true,
                    username,
                    profileUrl: `https://www.instagram.com/${username}/`,
                    message: `Perfil @${username} identificado correctamente.`
                  }));
                  return;
                }

                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'URL de Instagram inválida. Ingresá un @handle, link de perfil o link de Reel.' }));
                return;
              }

              let scrapedResult: any = {
                shortcode,
                username: '',
                caption: '',
                imageUrl: '',
                likes: null as number | null,
                commentsCount: null as number | null,
                comments: [] as any[],
                audioTrack: '',
                followers: '',
                videoUrl: ''
              };

              // 1. Intentar extracción con yt-dlp para metadata rica
              try {
                const { exec } = await import('child_process');
                const ytData: any = await new Promise((resolve) => {
                  exec(
                    `python3 -m yt_dlp --no-check-certificates --dump-json "${targetUrl}"`,
                    { timeout: 10000 },
                    (err, stdout) => {
                      if (err || !stdout) return resolve(null);
                      try {
                        resolve(JSON.parse(stdout));
                      } catch {
                        resolve(null);
                      }
                    }
                  );
                });

                if (ytData) {
                  if (typeof ytData.like_count === 'number') scrapedResult.likes = ytData.like_count;
                  if (typeof ytData.comment_count === 'number') scrapedResult.commentsCount = ytData.comment_count;
                  if (Array.isArray(ytData.comments)) {
                    scrapedResult.comments = ytData.comments.map((c: any) => ({
                      author: c.author || '',
                      text: c.text || ''
                    }));
                  }
                  if (ytData.description) scrapedResult.caption = ytData.description;
                  if (ytData.thumbnail) scrapedResult.imageUrl = ytData.thumbnail;
                  if (ytData.uploader) scrapedResult.username = ytData.uploader;
                  if (ytData.track) scrapedResult.audioTrack = `${ytData.artist ? ytData.artist + ' · ' : ''}${ytData.track}`;
                  if (ytData.url && ytData.ext === 'mp4') scrapedResult.videoUrl = ytData.url;
                }
              } catch (e) {
                console.warn('yt-dlp scrape fallback to embed:', e);
              }

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

              // 2. Extraer vía OpenGraph y Meta tags de la página principal (con User-Agents rotativos)
              const userAgentsToTry = [
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
              ];

              for (const ua of userAgentsToTry) {
                if (scrapedResult.caption && scrapedResult.imageUrl && scrapedResult.likes > 0) break;
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

                    // Username desde og:url o twitter:title
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

                    // Image URL
                    if (!scrapedResult.imageUrl && metaImg) {
                      scrapedResult.imageUrl = decodeHtmlEntities(metaImg[1]);
                    }

                    // Likes, Comments & Caption desde meta description
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

                    // Si todavía no hay caption pero hay keywords y título
                    if (!scrapedResult.caption && keywords) {
                      const kwText = decodeHtmlEntities(keywords[1]).split(',').slice(0, 5).join(' • ');
                      scrapedResult.caption = `Reel: ${kwText}`;
                    }
                  }
                } catch (pageErr) {
                  console.warn('Error fetching page with UA', ua, pageErr);
                }
              }

              // 3. Extraer o completar con Instagram embed
              if (!scrapedResult.caption || !scrapedResult.imageUrl) {
                try {
                  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
                  const igResponse = await fetch(embedUrl, {
                    headers: {
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
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
                } catch (embedErr) {
                  console.warn('Embed scrape fallback error:', embedErr);
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                ...scrapedResult,
                permalink: `https://www.instagram.com/p/${shortcode}/`
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Error al procesar Instagram' }));
            }
            return;
          }
          next();
        });

        // Middleware: confirmar si un @usuario de Instagram existe de verdad
        // (condición para guardar el handle en "Perfil & Contexto IA").
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/instagram-verify-profile')) {
            const urlObj = new URL(req.url, 'http://localhost');
            const raw = urlObj.searchParams.get('username');
            if (!raw) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Falta el parámetro username' }));
              return;
            }

            const username = raw.trim().replace(/^@/, '').replace(/\/$/, '');
            if (!/^[A-Za-z0-9_.]{1,30}$/.test(username)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Ese nombre de usuario no tiene un formato válido de Instagram.' }));
              return;
            }

            function decodeEntities(str: string) {
              if (!str) return '';
              return str
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&apos;/g, "'");
            }

            function parseCompact(raw2: string): number | null {
              const clean = raw2.trim().replace(/,/g, '');
              const m = clean.match(/^([0-9.]+)\s*([kKmM]?)$/);
              if (!m) return null;
              const value = parseFloat(m[1]);
              if (Number.isNaN(value)) return null;
              const suffix = m[2].toLowerCase();
              if (suffix === 'k') return Math.round(value * 1_000);
              if (suffix === 'm') return Math.round(value * 1_000_000);
              return Math.round(value);
            }

            const userAgentsToTry = [
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
              'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
              'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
            ];

            let handled = false;
            for (const ua of userAgentsToTry) {
              if (handled) break;
              try {
                const pageRes = await fetch(`https://www.instagram.com/${username}/`, {
                  headers: {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8'
                  }
                });

                if (pageRes.status === 404) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: true, exists: false, username }));
                  handled = true;
                  break;
                }

                if (pageRes.ok) {
                  const html = await pageRes.text();

                  if (/Sorry, this page isn't available/i.test(html) || /Página no disponible/i.test(html)) {
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true, exists: false, username }));
                    handled = true;
                    break;
                  }

                  const metaDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
                  const metaImg = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
                  const metaTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);

                  if (metaDesc || metaTitle) {
                    let followerCount: number | null = null;
                    let displayName: string | null = null;

                    if (metaDesc) {
                      const followersMatch = metaDesc[1].match(/([0-9.,]+[KMkm]?)\s+Followers/i);
                      if (followersMatch) followerCount = parseCompact(followersMatch[1]);
                    }
                    if (metaTitle) {
                      const nameMatch = metaTitle[1].match(/^([^(]+)\(@/);
                      if (nameMatch) displayName = decodeEntities(nameMatch[1].trim());
                    }

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({
                      success: true,
                      exists: true,
                      username,
                      displayName,
                      avatarUrl: metaImg ? decodeEntities(metaImg[1]) : null,
                      followerCount
                    }));
                    handled = true;
                    break;
                  }
                }
              } catch (e) {
                console.warn('Error verifying IG profile with UA', ua, e);
              }
            }

            if (!handled) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: 'No pudimos confirmar ese perfil ahora mismo (Instagram puede estar bloqueando la verificación). Probá de nuevo en unos segundos.'
              }));
            }
            return;
          }
          next();
        });

        // Middleware: business_discovery con la cuenta compartida de la
        // plataforma (respaldo para negocios sin su propia cuenta de Meta).
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/meta-platform-discovery')) {
            const accessToken = process.env.META_PLATFORM_ACCESS_TOKEN;
            const igAccountId = process.env.META_PLATFORM_IG_ACCOUNT_ID;

            if (!accessToken || !igAccountId) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: false,
                error: 'La cuenta compartida de la plataforma todavía no está configurada (faltan META_PLATFORM_ACCESS_TOKEN / META_PLATFORM_IG_ACCOUNT_ID).'
              }));
              return;
            }

            const urlObj = new URL(req.url, 'http://localhost');
            const rawUsername = urlObj.searchParams.get('username');
            if (!rawUsername) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Falta el parámetro username' }));
              return;
            }

            const username = rawUsername.trim().replace(/^@/, '');
            if (!username) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Nombre de usuario vacío.' }));
              return;
            }

            const limitParam = parseInt(urlObj.searchParams.get('limit') || '25', 10);
            const mediaLimit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 25;
            const fields = `business_discovery.username(${username}){username,name,profile_picture_url,followers_count,media_count,media.limit(${mediaLimit}){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;

            try {
              const metaUrl = new URL(`https://graph.facebook.com/v19.0/${igAccountId}`);
              metaUrl.searchParams.set('fields', fields);
              metaUrl.searchParams.set('access_token', accessToken);

              const metaRes = await fetch(metaUrl.toString());
              const data: any = await metaRes.json();

              res.setHeader('Content-Type', 'application/json');

              if (!metaRes.ok || data.error) {
                res.end(JSON.stringify({ success: false, error: data.error?.message || `Error de Meta (${metaRes.status})` }));
                return;
              }
              if (!data.business_discovery) {
                res.end(JSON.stringify({
                  success: false,
                  error: `"@${username}" no es una cuenta Business/Creator pública de Instagram (o no existe).`
                }));
                return;
              }

              const bd = data.business_discovery;
              res.end(JSON.stringify({
                success: true,
                data: {
                  username: bd.username,
                  name: bd.name,
                  profile_picture_url: bd.profile_picture_url,
                  followers_count: bd.followers_count,
                  media_count: bd.media_count,
                  media: bd.media?.data || []
                }
              }));
            } catch (err: any) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err.message || 'Error consultando la cuenta en Meta.' }));
            }
            return;
          }
          next();
        });
      }
    },
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'EventPix',
        short_name: 'EventPix v1.1',
        description: 'Comparte tus fotos del evento en tiempo real',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // El bundle legacy (target navegadores viejos) ronda los 4 MB;
        // el límite anterior (4.000.000 bytes) estaba pegado a ese
        // tamaño real, así que una variación mínima entre entornos
        // (Node 20 vs Node 24, por ejemplo) hacía que el build pasara
        // localmente y fallara en CI. Con margen real de sobra.
        maximumFileSizeToCacheInBytes: 8000000,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
            }
          }
        ]
      }
    })
  ],
  base: '/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
