import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { detectFacesInVideo, drawAccessory, filterCss, loadCustomAccessory } from '@/lib/faceFx';

// Imagen en vivo de la cámara que llena su contenedor también con la cámara
// girada 90°/270°: el video se dibuja con ancho y alto intercambiados y se gira,
// así no queda recortado ni chico. Espejo y giro en el mismo orden que la foto.
// Opcional: filtro de color y accesorio que sigue la cara, en vivo.
// Si la foto sale vertical y la pantalla es horizontal (o al revés), se muestra
// entera (como va a salir) en vez de agrandarla para llenar la pantalla.

export default function CameraVideo({ videoRef, mirror, rotation, className = '', filter, accessory }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirror?: boolean;
  rotation?: number;
  className?: string;
  /** Filtro de color (valor de COLOR_FILTERS) */
  filter?: string;
  /** Accesorio que sigue la cara ('none' o vacío = sin accesorio) */
  accessory?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Tamaño real del video (cambia al abrir la cámara)
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setFrame({ w: video.videoWidth, h: video.videoHeight });
    update();
    video.addEventListener('loadedmetadata', update);
    video.addEventListener('resize', update);
    return () => {
      video.removeEventListener('loadedmetadata', update);
      video.removeEventListener('resize', update);
    };
  }, [videoRef]);

  // Accesorio en vivo: se busca la cara en cada cuadro y se dibuja en un canvas encima
  const accRef = useRef(accessory);
  useEffect(() => { accRef.current = accessory; }, [accessory]);
  const rotRef = useRef(rotation);
  useEffect(() => { rotRef.current = rotation; }, [rotation]);
  const active = !!accessory && accessory !== 'none';
  useEffect(() => {
    if (!active) return;
    let alive = true;
    let raf = 0;
    const overlay = canvasRef.current;
    const loop = async () => {
      if (!alive) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth && video.readyState >= 2) {
        try {
          const faces = await detectFacesInVideo(video, Number(rotRef.current) || 0);
          const acc = accRef.current;
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (acc && acc !== 'none') {
            const custom = await loadCustomAccessory(acc);
            for (const f of faces) drawAccessory(ctx, f, acc, custom);
          }
        } catch (e) {
          // el detector todavía no está listo o falló: se reintenta en un rato
          console.warn('[fx] detección en vivo', e);
          await new Promise(r => setTimeout(r, 500));
        }
      }
      if (alive) raf = requestAnimationFrame(() => void loop());
    };
    void loop();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      overlay?.getContext('2d')?.clearRect(0, 0, overlay.width, overlay.height);
    };
  }, [active, videoRef]);

  const rot = (((Number(rotation) || 0) % 360) + 360) % 360;
  const sideways = rot === 90 || rot === 270;
  // Foto vertical en pantalla horizontal (o al revés): entera, sin recortar
  const photoW = sideways ? frame.h : frame.w;
  const photoH = sideways ? frame.w : frame.h;
  const fit = photoW && box.w && (photoW >= photoH) !== (box.w >= box.h) ? 'object-contain' : 'object-cover';
  const layer: CSSProperties = {
    left: '50%',
    top: '50%',
    width: sideways ? box.h : box.w,
    height: sideways ? box.w : box.h,
    transform: `translate(-50%, -50%) scaleX(${mirror ? -1 : 1}) rotate(${rot}deg)`,
  };
  return (
    <div ref={boxRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className={`absolute ${fit} max-w-none max-h-none`}
        style={{ ...layer, filter: filterCss(filter) || undefined }} />
      {/* Mismo tamaño y giro que el video: el accesorio queda sobre la cara */}
      <canvas ref={canvasRef} className={`absolute ${fit} max-w-none max-h-none pointer-events-none ${active ? '' : 'hidden'}`} style={layer} />
    </div>
  );
}
