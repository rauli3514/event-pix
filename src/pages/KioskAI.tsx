import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, Download, Printer, Users, Sparkles, Trophy, QrCode, Instagram } from 'lucide-react';
import { toast } from 'sonner';

// ---- Types ----
type Step =
  | 'splash'
  | 'modeSelect'
  | 'getReady'
  | 'lookCamera'
  | 'countdown'
  | 'photoPreview'
  | 'flashResult'
  | 'themeSelect'
  | 'mundialCountry'
  | 'mundialInfo'
  | 'processing'
  | 'result';

type Mode = 'selfie' | 'retrato' | 'mundial' | null;

// ---- Mundial Data ----
const COUNTRIES = [
  { id: 'argentina', name: 'Argentina', flag: '/flags/argentina.png', jersey: 'white and light blue vertical stripes Adidas Argentina AFA national team jersey with three gold stars' },
  { id: 'brasil',    name: 'Brasil',    flag: '/flags/brasil.png',    jersey: 'yellow Adidas Brazil CBF national team jersey with green collar' },
  { id: 'uruguay',   name: 'Uruguay',   flag: '/flags/uruguay.png',   jersey: 'light blue Puma Uruguay AUF national team jersey' },
  { id: 'chile',     name: 'Chile',     flag: '/flags/chile.png',     jersey: 'red Nike Chile FEF national team jersey' },
  { id: 'mexico',    name: 'México',    flag: '/flags/mexico.png',    jersey: 'green Adidas Mexico FMF national team jersey' },
  { id: 'espana',    name: 'España',    flag: '/flags/espana.png',    jersey: 'red Adidas Spain RFEF national team jersey' },
  { id: 'portugal',  name: 'Portugal',  flag: '/flags/portugal.png',  jersey: 'dark red Nike Portugal FPF national team jersey' },
  { id: 'venezuela', name: 'Venezuela', flag: '/flags/venezuela.png', jersey: 'red and black Hummel Venezuela FVF national team jersey' },
  { id: 'estados-unidos', name: 'USA',  flag: '/flags/estados-unidos.png', jersey: 'white Nike USA USMNT national team jersey with red and blue details' },
  { id: 'corea',     name: 'Corea',     flag: '/flags/corea.png',     jersey: 'red Nike South Korea KFA national team jersey' },
  { id: 'japon',     name: 'Japón',     flag: '/flags/japon.png',     jersey: 'blue Adidas Japan JFA national team jersey' },
  { id: 'marruecos', name: 'Marruecos', flag: '/flags/marruecos.png', jersey: 'red Puma Morocco FRMF national team jersey' },
  { id: 'croacia',   name: 'Croacia',   flag: '/flags/croacia.png',   jersey: 'white with red checkered pattern Nike Croatia HNS national team jersey' },
  { id: 'gana',      name: 'Ghana',     flag: '/flags/gana.png',      jersey: 'white Nike Ghana GFA national team jersey' },
];

const POSITIONS = [
  'Delantero', 'Centrocampista', 'Defensa', 'Arquero',
  'Extremo', 'Mediapunta', 'Lateral', 'Líbero',
];

// ---- Funny phrases for Selfie Grupal ----
const SELFIE_PHRASES = [
  "¡CHE, alguien pidió una foto tan fachera? ¡Porque acá ESTÁ!",
  "¡BOOM! Eso sí es una foto de campeonas y campeones.",
  "¡Ojo, que esta foto va a hacer historia!",
  "¡Sonrieron como si supieran que iban a quedar perfectos... y tenían razón!",
  "¡Esto no es una foto, esto es una OBRA DE ARTE!",
  "¡Paren todo! La mejor foto del evento acaba de tomarse.",
];

// ---- On-screen keyboard ----
const KB_ROWS = [
  ['Q','W','E','R','T','Y','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Z','X','C','V','B','N','M','⌫'],
  ['ESPACIO'],
];
interface VKProps { value: string; onChange: (v: string) => void; onClose: () => void; }
const VirtualKeyboard = ({ value, onChange, onClose }: VKProps) => {
  const press = (key: string) => {
    if (key === '⌫') { onChange(value.slice(0, -1)); return; }
    if (key === 'ESPACIO') { if (value.length < 24) onChange(value + ' '); return; }
    if (value.length < 24) onChange(value + key);
  };
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-[#0a0f1a]/95 border-t border-white/10 p-4 pb-6 backdrop-blur">
      <div className="flex justify-between items-center mb-3">
        <p className="carlmarx-bold text-white text-2xl tracking-wider">{value || <span className="text-white/30">RAUL GUTIERREZ</span>}</p>
        <button onClick={onClose} className="text-white/50 hover:text-white text-lg carlmarx-regular px-4 py-2 border border-white/20 rounded-xl">Listo ✓</button>
      </div>
      {KB_ROWS.map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1.5 mb-1.5">
          {row.map(k => (
            <button
              key={k}
              onPointerDown={e => { e.preventDefault(); press(k); }}
              className={`carlmarx-bold text-white rounded-xl border border-white/20 bg-white/10 active:bg-white/30 transition-colors flex items-center justify-center select-none
                ${ k === 'ESPACIO' ? 'text-base px-16 py-4 flex-1 max-w-xs' : k === '⌫' ? 'text-xl px-4 py-4 bg-red-900/40 border-red-700/40' : 'text-xl w-12 h-12' }`}
            >
              {k === 'ESPACIO' ? '— ESPACIO —' : k}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

// ---- Corner decoration ----
const Corners = () => (
  <>
    <div className="absolute top-0 left-0 w-40 h-40 pointer-events-none" style={{
      background: 'linear-gradient(135deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(0 0, 100% 0, 0 100%)',
      opacity: 0.9
    }} />
    <div className="absolute top-0 right-0 w-40 h-40 pointer-events-none" style={{
      background: 'linear-gradient(225deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
      opacity: 0.9
    }} />
    <div className="absolute bottom-0 left-0 w-32 h-32 pointer-events-none" style={{
      background: 'linear-gradient(45deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(0 0, 0 100%, 100% 100%)',
      opacity: 0.7
    }} />
    <div className="absolute bottom-0 right-0 w-32 h-32 pointer-events-none" style={{
      background: 'linear-gradient(315deg, #ff6eb4 0%, #7b5ea7 40%, #4fc3f7 100%)',
      clipPath: 'polygon(100% 0, 0 100%, 100% 100%)',
      opacity: 0.7
    }} />
  </>
);

export default function KioskAI() {
  const [searchParams] = useSearchParams();
  const kioskEventId = searchParams.get('event');

  const [step, setStep] = useState<Step>('splash');
  const [mode, setMode] = useState<Mode>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [lastPublicUrl, setLastPublicUrl] = useState<string | null>(null);
  const [resultPhrase, setResultPhrase] = useState('');
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  // Mundial state
  const [mundialCountry, setMundialCountry] = useState<any>(null);
  const [mundialName, setMundialName] = useState('');
  const [mundialPosition, setMundialPosition] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [themes, setThemes] = useState<any[]>([]);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [hasCameraError, setHasCameraError] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cameraSettings = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_camera_settings') || '{}'); }
    catch { return {}; }
  })();

  const printerSettings = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); }
    catch { return {}; }
  })();

  const generalSettings = (() => {
    try { return JSON.parse(localStorage.getItem('kiosk_general_settings') || '{}'); }
    catch { return {}; }
  })();

  // Fullscreen effect fallback
  useEffect(() => {
    if (generalSettings.autoFullscreen) {
      const enterFS = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      };
      // We still keep the window listener as a backup, but the primary one is now the splash tap
      window.addEventListener('click', enterFS, { once: true });
    }
  }, []);

  // Auto-print effect
  useEffect(() => {
    if (step === 'result' && capturedImage && printerSettings.autoPrint) {
      triggerPrint(capturedImage);
    }
  }, [step]);

  // Load themes + frame
  useEffect(() => {
    const loadFrame = () => {
      const savedFrame = localStorage.getItem('kiosk_frame_url');
      if (savedFrame === 'none') {
        setFrameUrl(null);
      } else if (savedFrame) {
        setFrameUrl(savedFrame);
      } else {
        // Fallback to legacy Supabase frame if nothing in localStorage
        (async () => {
          const { supabase } = await import('@/lib/supabase');
          const { data: fd } = supabase.storage.from('photos').getPublicUrl('kiosk_frame.png');
          if (fd?.publicUrl) setFrameUrl(fd.publicUrl);
        })();
      }
    };

    loadFrame();
    window.addEventListener('kiosk-frame-changed', loadFrame);
    window.addEventListener('storage', (e) => {
      if (e.key === 'kiosk_frame_url') loadFrame();
    });

    (async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data } = await supabase.from('ai_themes').select('*').order('created_at', { ascending: false });
      if (data) setThemes(data);
    })();

    return () => {
      window.removeEventListener('kiosk-frame-changed', loadFrame);
    };
  }, []);

  // Camera management
  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        video: cameraSettings.deviceId && cameraSettings.deviceId !== 'default'
          ? { deviceId: { exact: cameraSettings.deviceId } }
          : { facingMode: 'user' },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load before playing to avoid AbortError
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.warn("Auto-play was prevented:", err);
          });
        };
      }
    } catch {
      setHasCameraError(true);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (step === 'lookCamera' || step === 'countdown') startCamera();
    else stopCamera();
    return () => stopCamera();
  }, [step]);

  // Go to mode after splash
  const handleSplashTap = () => {
    if (generalSettings.autoFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    setStep('modeSelect');
  };

  const handleModeSelect = (m: Mode) => {
    setMode(m);
    setStep('getReady');
    setTimeout(() => setStep('lookCamera'), 2500);
  };

  // Countdown + capture
  const startCountdown = () => {
    setStep('countdown');
    const timer = cameraSettings.timer || 5;
    setCountdown(timer);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          capturePhoto();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d')!;

    if (cameraSettings.mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    const rot = cameraSettings.rotation || 0;
    if (rot !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }
    ctx.drawImage(video, 0, 0);

    // Play shutter sound
    try { new Audio('/kiosk-camera-sound.mp3').play(); } catch {}

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(dataUrl);
    // Always go to preview first — user can approve or retake
    setStep('photoPreview');
  };

  const savePhotoToAlbum = async (dataUrl: string): Promise<string | null> => {
    if (!kioskEventId) return null;
    try {
      const { supabase } = await import('@/lib/supabase');
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `kiosk_sessions/${kioskEventId}/${Date.now()}.jpg`;
      await supabase.storage.from('photos').upload(fileName, blob, { contentType: 'image/jpeg' });
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);
      await supabase.from('kiosk_photos').insert([{ kiosk_event_id: kioskEventId, image_url: publicUrl }]);
      return publicUrl;
    } catch (e) { 
      console.error(e);
      return null;
    }
  };

  const runAI = async (imageDataUrl: string, theme: any) => {
    if (isAIGenerating) return;
    setIsAIGenerating(true);
    setStep('processing');
    try {
      const { supabase } = await import('@/lib/supabase');
      const blob = await (await fetch(imageDataUrl)).blob();
      const fileName = `kiosk_raw/${Date.now()}.jpg`;
      await supabase.storage.from('photos').upload(fileName, blob, { contentType: 'image/jpeg' });
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);

      // Build prompt based on mode
      let prompt = theme?.prompt || '';
      if (mode === 'mundial' && mundialCountry) {
        prompt = `Photorealistic official FIFA World Cup 2026 player portrait photograph. \
The subject is wearing a ${mundialCountry.jersey}. \
Dramatic professional stadium lighting with bright floodlights bokeh in background. \
Upper body shot, subject looking directly into camera with confident serious athlete expression. \
Professional sports photography, ultra sharp, 4K, cinematic, no text, no watermark.`;
      }

      const token = import.meta.env.VITE_REPLICATE_API_TOKEN;
      let createRes;
      let retries = 0;
      const maxRetries = 2;

      while (retries <= maxRetries) {
        createRes = await fetch('/api/replicate/v1/predictions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: '8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b',
            input: { 
              prompt, 
              main_face_image: publicUrl, 
              num_steps: 20, 
              start_step: 0, 
              id_weight: 1, 
              guidance_scale: 4, 
              true_cfg: 1, 
              max_sequence_length: 128, 
              width: 896, 
              height: 1152, 
              output_format: 'webp', 
              output_quality: 80, 
              negative_prompt: 'bad quality, text, watermark, extra limbs' 
            }
          }),
        });

        if (createRes.status === 429 && retries < maxRetries) {
          console.warn(`Rate limit hit (429). Retrying in 3s... (Attempt ${retries + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 3000));
          retries++;
          continue;
        }
        break;
      }
      
      if (createRes?.status === 429) {
        throw new Error('El servidor de IA está recibiendo muchas peticiones. Por favor, intenta de nuevo en unos segundos.');
      }
      if (!createRes?.ok) throw new Error('Error al conectar con el servidor de IA.');
      let prediction = await createRes.json();
      let attempts = 0;
      while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && attempts < 30) {
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`/api/replicate/v1/predictions/${prediction.id}`, { headers: { 'Authorization': `Bearer ${token}` } });
        prediction = await poll.json();
        attempts++;
      }
      if (prediction.status !== 'succeeded') throw new Error('Falló la generación IA.');
      const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;

      let finalImage: string;
      if (mode === 'mundial') {
        finalImage = await buildMundialCard(outputUrl);
      } else {
        finalImage = await mergeImages(outputUrl, frameUrl);
      }

      setCapturedImage(finalImage);
      const url = await savePhotoToAlbum(finalImage);
      setLastPublicUrl(url);
      setStep('result');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Error al procesar la foto');
      setStep(mode === 'mundial' ? 'mundialInfo' : 'themeSelect');
    } finally {
      setIsAIGenerating(false);
    }
  };

  const mergeImages = (base: string, frame: string | null): Promise<string> =>
    new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width || 896; canvas.height = img.height || 1152;
        ctx.drawImage(img, 0, 0);
        if (!frame) return resolve(canvas.toDataURL('image/jpeg', 0.95));
        const fi = new Image(); fi.crossOrigin = 'anonymous';
        fi.onload = () => { ctx.drawImage(fi, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.95)); };
        fi.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.95));
        fi.src = frame;
      };
      img.onerror = reject;
      img.src = base;
    });

  // Build World Cup player card on canvas
  const buildMundialCard = (portraitUrl: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const W = 800, H = 1140;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d')!;

      const portrait = new Image(); portrait.crossOrigin = 'anonymous';
      portrait.onload = () => {
        // 1 — Portrait fills FULL canvas using cover-crop logic
        const pA = portrait.width / portrait.height;
        const cA = W / H;
        let sx = 0, sy = 0, sw = portrait.width, sh = portrait.height;
        if (pA > cA) { sw = portrait.height * cA; sx = (portrait.width - sw) / 2; }
        else { sh = portrait.width / cA; sy = (portrait.height - sh) / 4; }
        ctx.drawImage(portrait, sx, sy, sw, sh, 0, 0, W, H);

        // 2 — Frame overlay (marco3mundial) at full canvas size
        const frame = new Image(); frame.crossOrigin = 'anonymous';
        frame.onload = () => {
          ctx.drawImage(frame, 0, 0, W, H);

          // 3 — Subtle localized gradient only behind text (top-left corner)
          const B = 48;
          const tX = B + 14;  // text X — just inside frame border
          const tY = B + 14;  // text Y — just inside frame border

          const nameText = (mundialName || 'JUGADOR').toUpperCase();
          const posText  = (mundialPosition || '').toUpperCase();

          // Measure widths so gradient only covers text area
          ctx.font = `bold 62px 'CarlMarx', Impact, sans-serif`;
          const nameW = ctx.measureText(nameText).width;
          ctx.font = `bold 32px 'CarlMarx', Impact, sans-serif`;
          const posW  = ctx.measureText(posText).width;
          const bgW = Math.max(nameW, posW) + 32;
          const bgH = 110;

          const bgGrad = ctx.createLinearGradient(tX, tY, tX + bgW, tY);
          bgGrad.addColorStop(0,   'rgba(0,0,0,0.78)');
          bgGrad.addColorStop(1,   'rgba(0,0,0,0)');
          ctx.fillStyle = bgGrad;
          ctx.fillRect(tX - 8, tY, bgW + 20, bgH);

          // 4 — Player name
          ctx.font = `bold 62px 'CarlMarx', Impact, sans-serif`;
          ctx.fillStyle = '#FFFFFF';
          ctx.shadowColor = 'rgba(0,0,0,0.9)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2;
          ctx.fillText(nameText, tX, tY + 62);

          // 5 — Position
          ctx.font = `bold 32px 'CarlMarx', Impact, sans-serif`;
          ctx.fillStyle = '#e2e8f0';
          ctx.fillText(posText, tX, tY + 100);
          ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

          // 6 — Country flag (top-right inside header)
          const finish = (flagSrc?: string) => {
            if (!flagSrc) { resolve(canvas.toDataURL('image/jpeg', 0.96)); return; }
            const fi = new Image(); fi.crossOrigin = 'anonymous';
            fi.onload = () => {
              const fW = 92, fH = 62;
              const fX = W - B - fW - 10;   // right side, inside frame border
              const fY = B + 14;             // same top margin as text
              ctx.shadowBlur = 0;
              ctx.drawImage(fi, fX, fY, fW, fH);
              resolve(canvas.toDataURL('image/jpeg', 0.96));
            };
            fi.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.96));
            fi.src = flagSrc;
          };
          finish(mundialCountry?.flag);
        };
        frame.onerror = () => resolve(canvas.toDataURL('image/jpeg', 0.96));
        if (frameUrl === 'none') {
          resolve(canvas.toDataURL('image/jpeg', 0.9));
          return;
        }
        frame.src = frameUrl || '/kiosk-marco-mundial.png';
      };
      portrait.onerror = reject;
      portrait.src = portraitUrl;
    });

  const triggerPrint = (imageUrl: string) => {
    const cfg = (() => {
      try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); }
      catch { return {}; }
    })();

    const pw = window.open('', '_blank', 'width=800,height=600');
    if (!pw) {
      toast.error("Por favor, permite las ventanas emergentes para imprimir");
      return;
    }

    let sz = 'A4';
    if (cfg.paperSize === '4x6') sz = '4in 6in';
    else if (cfg.paperSize === '5x7') sz = '5in 7in';
    else if (cfg.paperSize === '10x15') sz = '100mm 150mm';
    else if (cfg.paperSize === '13x18') sz = '130mm 180mm';
    else if (cfg.paperSize === '15x20') sz = '150mm 200mm';

    const rotation = cfg.rotation || 0;
    const objectFit = cfg.imageAdjust || 'contain';
    const orientation = cfg.orientation || 'portrait';

    pw.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Imprimir Foto - Kiosco</title>
          <style>
            @page {
              size: ${sz} ${orientation};
              margin: 0;
            }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              width: 100%;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
              overflow: hidden;
            }
            .print-container {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              transform: rotate(${rotation}deg);
            }
            img {
              max-width: 100%;
              max-height: 100%;
              width: 100%;
              height: 100%;
              object-fit: ${objectFit};
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            <img src="${imageUrl}" onload="setTimeout(() => { window.print(); window.close(); }, 500)"/>
          </div>
        </body>
      </html>
    `);
    pw.document.close();
  };

  const resetKiosk = () => {
    setStep('splash');
    setMode(null);
    setCapturedImage(null);
    setSelectedTheme(null);
    setMundialCountry(null);
    setMundialName('');
    setMundialPosition('');
  };

  // ─── SCREENS ────────────────────────────────────────────────

  if (step === 'splash') return (
    <div className="kiosk-root" onClick={handleSplashTap} style={{ cursor: 'pointer' }}>
      <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80">
        <source src="/kiosk-animacion1.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
      <Corners />
      <div className="relative z-10 flex flex-col items-center justify-center h-full">
        <h1 className="carlmarx-bold text-[clamp(4rem,12vw,9rem)] text-white drop-shadow-2xl text-center leading-tight animate-pulse-slow">
          Toca para<br />empezar
        </h1>
        <div className="mt-8 w-20 h-20 border-4 border-white/60 rounded-full flex items-center justify-center animate-bounce">
          <div className="w-10 h-10 border-4 border-white rounded-full" />
        </div>
      </div>
    </div>
  );

  if (step === 'modeSelect') return (
    <div className="kiosk-root">
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <Corners />
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-12 px-8">
        <h2 className="carlmarx-bold text-[clamp(2rem,5vw,4rem)] text-white">¿Cómo querés tu foto?</h2>
        <div className="grid grid-cols-3 gap-6 w-full max-w-5xl">

          {/* SELFIE GRUPAL */}
          <button onClick={() => handleModeSelect('selfie')}
            className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-cyan-400 bg-black/40 backdrop-blur hover:bg-cyan-400/10 transition-all">
            <Users className="w-16 h-16 text-cyan-400" />
            <span className="carlmarx-bold text-cyan-400 text-2xl uppercase tracking-wider">Selfie Grupal</span>
            <p className="text-white/70 text-sm text-center">Una foto con amigos o familia.<br />Podés ponerle un marco decorativo.</p>
          </button>

          {/* RETRATO MÁGICO */}
          <button onClick={() => handleModeSelect('retrato')}
            className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-violet-400 bg-black/40 backdrop-blur hover:bg-violet-400/10 transition-all">
            <Sparkles className="w-16 h-16 text-violet-400" />
            <span className="carlmarx-bold text-violet-400 text-2xl uppercase tracking-wider">Retrato Mágico</span>
            <p className="text-white/70 text-sm text-center">Una foto de vos solo.<br />Elegí entre muchos estilos de retrato.</p>
          </button>

          {/* MUNDIAL */}
          <button onClick={() => handleModeSelect('mundial')}
            className="relative group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-green-400 bg-black/40 backdrop-blur hover:bg-green-400/10 transition-all">
            <Trophy className="w-16 h-16 text-green-400" />
            <span className="carlmarx-bold text-green-400 text-2xl uppercase tracking-wider">Mundial 2026</span>
            <p className="text-white/70 text-sm text-center">¡Convertite en una estrella del fútbol!<br />Tu carta de jugador con nombre y posición.</p>
          </button>
        </div>
      </div>
    </div>
  );

  if (step === 'getReady') return (
    <div className="kiosk-root">
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <Corners />
      <div className="relative z-10 flex items-center justify-center h-full">
        <h1 className="carlmarx-bold text-[clamp(4rem,10vw,8rem)] text-white text-center animate-fade-in">
          Vamos a<br /><span className="text-violet-400">Empezar</span>
        </h1>
      </div>
    </div>
  );

  if (step === 'lookCamera') return (
    <div className="kiosk-root" onClick={startCountdown} style={{ cursor: 'pointer' }}>
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <Corners />
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-20" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
        <p className="carlmarx-regular text-white/60 text-2xl uppercase tracking-widest">
          {mode === 'selfie' ? '📸 Selfie Grupal' : mode === 'retrato' ? '✨ Retrato Mágico' : '⚽ Mundial 2026'}
        </p>
        <h1 className="carlmarx-bold text-[clamp(4rem,10vw,8rem)] text-white text-center">
          ¡Estamos prendiendo<br />los focos!
        </h1>
        <p className="carlmarx-regular text-white/80 text-3xl mt-4 animate-pulse">
          Toca para empezar el conteo
        </p>
        <Camera className="w-16 h-16 text-white/60 mt-4" />
      </div>
    </div>
  );

  if (step === 'countdown') return (
    <div className="kiosk-root">
      <div className="absolute inset-0 bg-black" />
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: `scaleX(${cameraSettings.mirror ? -1 : 1}) rotate(${cameraSettings.rotation || 0}deg)` }} />
      <canvas ref={canvasRef} className="hidden" />
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative z-10 flex items-center justify-center h-full">
        <span className="carlmarx-bold text-[clamp(8rem,25vw,18rem)] text-white drop-shadow-2xl animate-ping-once" style={{ textShadow: '0 0 80px rgba(139,92,246,0.8)' }}>
          {countdown}
        </span>
      </div>
      <Corners />
    </div>
  );

  // ── PHOTO PREVIEW — approve or retake ───────────────────────
  if (step === 'photoPreview') {
    const goNext = async () => {
      if (mode === 'selfie') {
        setStep('processing'); // Show a brief processing state while merging
        const phrase = SELFIE_PHRASES[Math.floor(Math.random() * SELFIE_PHRASES.length)];
        setResultPhrase(phrase);
        
        // Apply frame if exists
        let finalImage = capturedImage!;
        if (frameUrl) {
          try {
            finalImage = await mergeImages(capturedImage!, frameUrl);
          } catch (e) {
            console.error("Error applying frame to selfie:", e);
          }
        }
        
        setCapturedImage(finalImage);
        await savePhotoToAlbum(finalImage);
        setStep('flashResult');
      } else if (mode === 'retrato') {
        setStep('themeSelect');
      } else if (mode === 'mundial') {
        setStep('mundialCountry');
      }
    };
    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-black" />
        <Corners />
        {capturedImage && (
          <img src={capturedImage} alt="preview"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ transform: `scaleX(${cameraSettings.mirror ? -1 : 1})` }} />
        )}
        {/* Gradient bottom overlay for buttons */}
        <div className="absolute bottom-0 inset-x-0 h-48 bg-gradient-to-t from-black to-transparent" />
        <div className="absolute bottom-0 inset-x-0 flex items-end justify-center gap-6 p-8 z-10">
          <button onClick={() => setStep('lookCamera')}
            className="flex-1 max-w-xs py-5 rounded-2xl border-2 border-white/30 bg-black/60 carlmarx-bold text-white text-2xl backdrop-blur hover:border-white/60 transition-all">
            ↩ Repetir foto
          </button>
          <button onClick={goNext}
            className="flex-1 max-w-xs py-5 rounded-2xl carlmarx-bold text-white text-2xl transition-all"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 40px rgba(124,58,237,0.5)' }}>
            ¡Me gusta! →
          </button>
        </div>
      </div>
    );
  }

  if (step === 'flashResult') return (
    <div className="kiosk-root" onClick={() => setStep('result')}>
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <Corners />
      {capturedImage && (
        <img src={capturedImage} alt="captured" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
      )}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-12 text-center gap-8">
        <p className="carlmarx-bold text-[clamp(2.5rem,5vw,4rem)] text-white leading-tight" style={{ textShadow: '0 0 40px rgba(255,255,255,0.4)' }}>
          {resultPhrase}
        </p>
        <p className="carlmarx-regular text-white/60 text-2xl animate-pulse mt-4">Toca para ver tu foto →</p>
      </div>
    </div>
  );

  // ── MUNDIAL: Country Selection ──────────────────────────────
  if (step === 'mundialCountry') return (
    <div className="kiosk-root">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#040c1a 0%,#0a1628 100%)' }} />
      <Corners />
      <div className="relative z-10 flex flex-col items-center h-full py-10 px-8 gap-6 overflow-auto">
        <div>
          <p className="carlmarx-regular text-green-400 text-center text-xl tracking-widest uppercase">⚽ Mundial 2026</p>
          <h2 className="carlmarx-bold text-white text-center text-[clamp(2rem,4vw,3.5rem)]">¿De qué país jugás?</h2>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-4 w-full max-w-5xl">
          {COUNTRIES.map(c => (
            <button key={c.id} onClick={() => { setMundialCountry(c); setStep('mundialInfo'); }}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl border-2 border-white/10 bg-white/5 hover:border-green-400 hover:bg-green-400/10 transition-all group">
              <img src={c.flag} alt={c.name} className="w-14 h-10 object-cover rounded shadow-lg group-hover:scale-110 transition-transform" />
              <span className="carlmarx-regular text-white text-xs text-center leading-tight">{c.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── MUNDIAL: Player Name + Position ─────────────────────────
  if (step === 'mundialInfo') return (
    <div className="kiosk-root">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#040c1a 0%,#0a1628 100%)' }} />
      <img src="/kiosk-fondo-cancha.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
      <Corners />
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8 px-8 max-w-2xl mx-auto">
        {/* Flag + country */}
        {mundialCountry && (
          <div className="flex items-center gap-4">
            <img src={mundialCountry.flag} alt={mundialCountry.name} className="w-20 h-14 object-cover rounded-lg shadow-xl border-2 border-white/20" />
            <p className="carlmarx-bold text-white text-3xl">{mundialCountry.name}</p>
          </div>
        )}

        {/* Name input — teclado virtual */}
        <div className="w-full space-y-2">
          <label className="carlmarx-regular text-white/60 text-lg uppercase tracking-widest">Tu nombre en la tarjeta</label>
          <div
            onClick={() => setShowKeyboard(true)}
            className={`w-full bg-white/10 border-2 rounded-2xl px-6 py-4 text-3xl carlmarx-bold uppercase cursor-pointer transition-colors ${showKeyboard ? 'border-green-400' : 'border-white/20'}`}
            style={{ fontFamily: "'CarlMarx', Impact, sans-serif", color: mundialName ? '#fff' : 'rgba(255,255,255,0.2)', minHeight: 72 }}
          >
            {mundialName || 'RAUL GUTIERREZ'}
          </div>
        </div>

        {showKeyboard && (
          <VirtualKeyboard
            value={mundialName}
            onChange={setMundialName}
            onClose={() => setShowKeyboard(false)}
          />
        )}

        {/* Position selector */}
        <div className="w-full space-y-2">
          <label className="carlmarx-regular text-white/60 text-lg uppercase tracking-widest">Tu posición</label>
          <div className="grid grid-cols-4 gap-3">
            {POSITIONS.map(p => (
              <button key={p} onClick={() => setMundialPosition(p)}
                className={`py-3 px-2 rounded-xl border-2 carlmarx-bold text-base uppercase transition-all ${mundialPosition === p ? 'border-green-400 bg-green-400/20 text-green-300' : 'border-white/20 bg-white/5 text-white hover:border-white/40'}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => {
            if (!mundialName.trim()) { toast.error('Ingresá tu nombre'); return; }
            if (!mundialPosition) { toast.error('Elegí tu posición'); return; }
            runAI(capturedImage!, null);
          }}
          className="w-full py-6 rounded-2xl carlmarx-bold text-2xl text-white transition-all"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 0 40px rgba(22,163,74,0.4)' }}
        >
          ⚽ ¡Generar mi carta de jugador!
        </button>

        <button onClick={() => setStep('mundialCountry')} className="text-white/40 text-lg carlmarx-regular hover:text-white/70 transition-colors">
          ← Cambiar país
        </button>
      </div>
    </div>
  );

  if (step === 'themeSelect') {
    const CATEGORY_LABELS: Record<string, string> = {
      deportes: '⚽ Deportes', fantasia: '🏰 Fantasía', epocas: '🕰️ Épocas',
      animacion: '🎬 Animación', moda: '👗 Moda', scifi: '🤖 Sci-Fi', aventura: '🌿 Aventura',
    };
    const grouped = themes.reduce((acc: Record<string, any[]>, t: any) => {
      const cat = t.category || 'otros';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(t);
      return acc;
    }, {});

    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-[#0a0a1a]" />
        <Corners />
        <div className="relative z-10 flex flex-col h-full overflow-auto">
          {/* Header */}
          <div className="text-center pt-10 pb-4 shrink-0">
            <p className="carlmarx-regular text-violet-400 text-xl uppercase tracking-widest">✨ Retrato Mágico</p>
            <h2 className="carlmarx-bold text-white text-[clamp(2rem,4vw,3.5rem)]">¿Cuál es tu estilo?</h2>
          </div>

          {/* Scrollable grid */}
          <div className="flex-1 overflow-auto px-8 pb-10">
            {themes.length === 0 && (
              <p className="text-slate-400 text-center py-20 text-xl">No hay temáticas configuradas aún.</p>
            )}
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-8">
                <p className="carlmarx-bold text-slate-400 text-lg uppercase tracking-widest mb-3 border-b border-white/10 pb-2">
                  {CATEGORY_LABELS[cat] || cat}
                </p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {(items as any[]).map((t: any) => (
                    <button key={t.id}
                      disabled={isAIGenerating}
                      onClick={() => { 
                        if (generalSettings.autoFullscreen && !document.fullscreenElement) {
                          document.documentElement.requestFullscreen().catch(() => {});
                        }
                        setSelectedTheme(t); 
                        runAI(capturedImage!, t); 
                      }}
                      className={`relative rounded-2xl overflow-hidden border-2 transition-all group bg-slate-900 ${isAIGenerating ? 'opacity-50 cursor-not-allowed' : 'border-violet-800/40 hover:border-violet-400 hover:scale-[1.03]'}`}
                      style={{ aspectRatio: '3/4' }}
                    >
                      {t.preview_url
                        ? <img src={t.preview_url} alt={t.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        : <div className="absolute inset-0 flex items-center justify-center text-5xl">{t.emoji || '🎨'}</div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      {/* max_people badge */}
                      <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/60 rounded-full px-2 py-0.5 text-white/80 text-xs">
                        {Array.from({ length: t.max_people || 1 }).map((_, i) => <span key={i}>👤</span>)}
                      </div>
                      {t.emoji && <div className="absolute top-2 right-2 text-xl">{t.emoji}</div>}
                      <div className="absolute bottom-0 inset-x-0 p-3">
                        <span className="carlmarx-bold text-white text-base leading-tight">{t.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'processing') return (
    <div className="kiosk-root">
      <div className="absolute inset-0 bg-[#0a0a1a]" />
      <Corners />
      {capturedImage && <img src={capturedImage} className="absolute inset-0 w-full h-full object-cover opacity-10 blur-md grayscale" />}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-8">
        <div className="w-40 h-40 rounded-full border-4 border-violet-500/30 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin" />
          <Sparkles className="w-16 h-16 text-white animate-pulse" />
        </div>
        <h2 className="carlmarx-bold text-[clamp(3rem,7vw,6rem)] text-white text-center">
          {mode === 'selfie' ? 'Preparando Foto' : 'Creando Magia'}
        </h2>
        <p className="carlmarx-regular text-white/60 text-2xl">
          {mode === 'selfie' ? 'Estamos aplicando los últimos retoques...' : 'La IA está dibujando tu retrato...'}
        </p>
      </div>
    </div>
  );

  if (step === 'result') {
    const printerCfg = (() => { try { return JSON.parse(localStorage.getItem('kiosk_print_settings') || '{}'); } catch { return {}; } })();
    const igCfg = (() => { try { return JSON.parse(localStorage.getItem('kiosk_ig_settings') || '{}'); } catch { return {}; } })();
    const showPrint = printerCfg.autoPrint !== false;
    // The QR points directly to the photo for downloading
    const qrUrl = lastPublicUrl 
      ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(lastPublicUrl)}&bgcolor=ffffff&color=000000`
      : null;

    return (
      <div className="kiosk-root">
        <div className="absolute inset-0 bg-[#0a0a1a]" />
        <Corners />
        
        <div className="relative z-10 flex h-full items-center justify-center gap-12 p-8 animate-in fade-in zoom-in duration-500">
          {/* Photo Preview */}
          <div className="relative flex-shrink-0 h-full max-h-[85vh] aspect-[7/9] rounded-[2rem] overflow-hidden shadow-[0_0_100px_rgba(139,92,246,0.4)] border border-violet-500/30 group">
            {capturedImage && <img src={capturedImage} alt="result" className="w-full h-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Actions Column */}
          <div className="flex flex-col gap-6 w-72">
            <div className="space-y-1 mb-4">
              <p className="carlmarx-regular text-violet-400 text-lg uppercase tracking-[0.2em]">¡Listo!</p>
              <h2 className="carlmarx-bold text-white text-4xl">Llevate tu recuerdo</h2>
            </div>

            <button onClick={resetKiosk}
              className="group relative py-6 px-8 bg-slate-900/80 hover:bg-slate-800 text-white rounded-3xl carlmarx-bold text-2xl transition-all border border-white/10 hover:border-white/20 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/0 via-violet-600/10 to-violet-600/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
              Terminar
            </button>

            {showPrint && (
              <button onClick={() => triggerPrint(capturedImage!)}
                className="py-6 px-8 bg-slate-800/80 hover:bg-slate-700 text-white rounded-3xl carlmarx-bold text-2xl flex items-center justify-center gap-4 border border-white/10 transition-all hover:scale-[1.02]">
                <Printer className="w-7 h-7 text-violet-400" /> Imprimir
              </button>
            )}

            <button onClick={() => setShowQrModal(true)}
              className="py-6 px-8 bg-slate-800/80 hover:bg-slate-700 text-white rounded-3xl carlmarx-bold text-2xl flex items-center justify-center gap-4 border border-white/10 transition-all hover:scale-[1.02]">
              <QrCode className="w-7 h-7 text-pink-400" /> Obtener QR
            </button>

            <button onClick={async () => {
              if (!navigator.share) { toast.info("Guardá la foto con un toque largo"); return; }
              try {
                const res = await fetch(capturedImage!);
                const blob = await res.blob();
                const file = new File([blob], 'foto-kiosco.jpg', { type: 'image/jpeg' });
                await navigator.share({ title: 'Mi foto del evento', files: [file] });
              } catch { toast.info("Guardá la foto con un toque largo"); }
            }}
              className="py-7 px-8 bg-gradient-to-br from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white rounded-[2rem] carlmarx-bold text-2xl flex items-center justify-center gap-4 shadow-[0_10px_40px_rgba(139,92,246,0.4)] transition-all hover:scale-[1.05] active:scale-95">
              <Instagram className="w-8 h-8" /> Compartir
            </button>
          </div>
        </div>

        {/* QR MODAL */}
        {showQrModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={() => setShowQrModal(false)} />
            <div className="relative bg-white rounded-[3rem] p-12 flex flex-col items-center gap-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="text-center space-y-2">
                <h3 className="carlmarx-bold text-slate-900 text-3xl">Descargá tu foto</h3>
                <p className="text-slate-500 text-lg">Escaneá para bajarla a tu celular</p>
              </div>
              
              <div className="p-4 bg-white rounded-3xl border-8 border-slate-100 shadow-inner">
                <img src={qrUrl!} alt="QR" className="w-64 h-64" />
              </div>

              {igCfg.hashtag && (
                <div className="bg-violet-50 px-6 py-3 rounded-full border border-violet-100">
                  <p className="text-violet-600 font-bold text-xl">#{igCfg.hashtag.replace(/^#/, '')}</p>
                </div>
              )}

              <button 
                onClick={() => setShowQrModal(false)}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl carlmarx-bold text-xl hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
