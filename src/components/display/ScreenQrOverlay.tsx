import { useEffect, useMemo, useRef, useState } from 'react';
import { QR_SIZES, qrSvgPath, type ScreenQr } from '@/lib/qr';

interface Props {
    qr: Pick<ScreenQr, 'value' | 'caption' | 'corner' | 'size'>;
    // Si hay un aviso urgente en franja abajo, el QR de abajo se corre para arriba.
    bannerBelow?: boolean;
}

// QR fijo en una esquina de la pantalla, encima de lo que se está pasando.
// Los tamaños salen del recuadro: anda igual en la TV (rotada o no) y en la
// vista previa del panel.
export function ScreenQrOverlay({ qr, bannerBelow = false }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ width: 0, height: 0 });
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            const rect = entries[0].contentRect;
            setBox({ width: rect.width, height: rect.height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const svg = useMemo(() => qrSvgPath(qr.value), [qr.value]);
    const { width, height } = box;
    const min = Math.min(width, height);
    const size = min * (QR_SIZES[qr.size]?.fraction ?? QR_SIZES.m.fraction);
    const pad = size * 0.08;
    const margin = min * 0.03;
    // Mismo alto que la franja del aviso urgente (ver UrgentAlertOverlay).
    const banner = bannerBelow ? Math.max(height * 0.16, min * 0.12) : 0;
    const top = qr.corner === 'tl' || qr.corner === 'tr';
    const left = qr.corner === 'tl' || qr.corner === 'bl';

    return (
        <div ref={ref} className="absolute inset-0 z-[55] pointer-events-none">
            {width > 0 && (
                <div
                    className="absolute bg-white flex flex-col items-center shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
                    style={{
                        width: size + pad * 2,
                        padding: pad,
                        borderRadius: pad * 1.4,
                        [top ? 'top' : 'bottom']: margin + (top ? 0 : banner),
                        [left ? 'left' : 'right']: margin,
                    }}
                >
                    <svg viewBox={`0 0 ${svg.size} ${svg.size}`} width={size} height={size} shapeRendering="crispEdges" aria-label="Código QR">
                        <path d={svg.path} fill="#000" />
                    </svg>
                    {qr.caption && (
                        <p className="text-center font-bold leading-tight text-black" style={{ fontSize: size * 0.1, marginTop: pad * 0.4, overflowWrap: 'break-word' }}>
                            {qr.caption}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
