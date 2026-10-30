import { useEffect, useRef, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { URGENT_ALERT_COLORS, type UrgentAlert } from '@/lib/urgentAlerts';

// Aviso urgente encima de lo que se está pasando: franja abajo o pantalla
// completa. Los tamaños salen del recuadro (anda igual en la TV, rotada o no,
// y en la vista previa del panel).
export function UrgentAlertOverlay({ alert }: { alert: Pick<UrgentAlert, 'message' | 'layout' | 'color'> }) {
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

    const colors = URGENT_ALERT_COLORS[alert.color] || URGENT_ALERT_COLORS.red;
    const { width, height } = box;
    // Mensajes largos, letra más chica.
    const lengthFactor = Math.min(1, Math.sqrt(40 / Math.max(alert.message.length, 1)));

    let content = null;
    if (width > 0 && height > 0) {
        if (alert.layout === 'full') {
            const fontSize = Math.min(width * 0.09, height * 0.13) * lengthFactor;
            content = (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: colors.bg, color: colors.fg, padding: width * 0.06 }}>
                    <Megaphone style={{ width: fontSize * 1.2, height: fontSize * 1.2, marginBottom: fontSize * 0.5 }} className="animate-pulse" />
                    <p className="font-extrabold leading-tight" style={{ fontSize, wordBreak: 'break-word' }}>{alert.message}</p>
                </div>
            );
        } else {
            const bannerHeight = Math.max(height * 0.16, Math.min(width, height) * 0.12);
            const fontSize = Math.min(bannerHeight * 0.34, width * 0.045) * Math.max(lengthFactor, 0.7);
            content = (
                <div
                    className="absolute inset-x-0 bottom-0 flex items-center shadow-[0_-8px_30px_rgba(0,0,0,0.45)]"
                    style={{ height: bannerHeight, background: colors.bg, color: colors.fg, paddingLeft: bannerHeight * 0.35, paddingRight: bannerHeight * 0.35, gap: bannerHeight * 0.25 }}
                >
                    <Megaphone className="shrink-0 animate-pulse" style={{ width: bannerHeight * 0.45, height: bannerHeight * 0.45 }} />
                    <p
                        className="font-extrabold leading-tight overflow-hidden"
                        style={{ fontSize, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word' }}
                    >
                        {alert.message}
                    </p>
                </div>
            );
        }
    }

    return <div ref={ref} className="absolute inset-0 z-[60] pointer-events-none">{content}</div>;
}
