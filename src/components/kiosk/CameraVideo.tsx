import { useEffect, useRef, useState, type RefObject } from 'react';

// Imagen en vivo de la cámara que llena su contenedor también con la cámara
// girada 90°/270°: el video se dibuja con ancho y alto intercambiados y se gira,
// así no queda recortado ni chico. Espejo y giro en el mismo orden que la foto.

export default function CameraVideo({ videoRef, mirror, rotation, className = '' }: {
  videoRef: RefObject<HTMLVideoElement | null>;
  mirror?: boolean;
  rotation?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
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

  const rot = (((Number(rotation) || 0) % 360) + 360) % 360;
  const sideways = rot === 90 || rot === 270;
  return (
    <div ref={boxRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className="absolute object-cover max-w-none max-h-none"
        style={{
          left: '50%',
          top: '50%',
          width: sideways ? box.h : box.w,
          height: sideways ? box.w : box.h,
          transform: `translate(-50%, -50%) scaleX(${mirror ? -1 : 1}) rotate(${rot}deg)`,
        }} />
    </div>
  );
}
