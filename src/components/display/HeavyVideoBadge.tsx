import { AlertTriangle } from 'lucide-react';

// Marca "Pesado" en la biblioteca para los videos que al subirse superaron lo
// recomendado para los TV box (ver lib/videoCheck.ts). Los subidos antes de
// este control no tienen el dato y no muestran nada.

const ISSUE_TEXT: Record<string, string> = {
    resolution: 'más de 1080p',
    codec: 'formato poco compatible (H.265/VP9/AV1)',
    bitrate: 'mucho bitrate',
    size: 'archivo muy grande',
};

interface Props {
    media: { type?: string; metadata?: unknown };
    className?: string;
}

export function HeavyVideoBadge({ media, className = '' }: Props) {
    if (media.type !== 'video') return null;
    const issues = (media.metadata as { video?: { issues?: string[] } } | null)?.video?.issues;
    if (!Array.isArray(issues) || issues.length === 0) return null;
    const detail = issues.map(code => ISSUE_TEXT[code] || code).join(', ');
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-black shrink-0 ${className}`}
            title={`Puede trabarse en equipos chicos: ${detail}`}
        >
            <AlertTriangle className="w-3 h-3" /> Pesado
        </span>
    );
}
