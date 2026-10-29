import { AlertTriangle, Bug, Download, Globe, Zap } from 'lucide-react';

// Diagnóstico remoto de una pantalla, a partir de la telemetría que manda la
// TV en cada latido. Sirve para saber por qué falló un equipo sin ir al local.

interface MediaCacheStatus {
    wanted?: number;
    ready?: number;
    downloading?: string | null;
    bytes_mb?: number;
    quota_mb?: number;
    last_error?: string | null;
}

interface Telemetry {
    webview?: string;
    last_crash?: string | null;
    memory?: { max_mb?: number };
    media_cache?: MediaCacheStatus;
    player?: {
        lite?: boolean;
        lite_setting?: 'auto' | 'on' | 'off';
        last_web_error?: { message: string; at: string } | null;
    };
}

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es-AR');
};

function Row({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3 pt-2">
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-300">{title}</p>
                {children}
            </div>
        </div>
    );
}

export function DeviceDiagnostics({ telemetry }: { telemetry: Telemetry | null | undefined }) {
    if (!telemetry) return null;
    const player = telemetry.player;
    const cache = telemetry.media_cache;

    return (
        <>
            {player && (
                <Row icon={<Zap className={`w-5 h-5 ${player.lite ? 'text-emerald-400' : 'text-slate-500'}`} />} title="Modo liviano">
                    <p className="text-sm text-slate-500">
                        {player.lite ? 'Activo' : 'Inactivo'}
                        {' · '}
                        {player.lite_setting === 'on' ? 'forzado desde la TV' : player.lite_setting === 'off' ? 'desactivado desde la TV' : 'automático según la memoria'}
                        {telemetry.memory?.max_mb ? ` (${telemetry.memory.max_mb} MB de RAM)` : ''}
                    </p>
                </Row>
            )}

            {cache && (
                <Row icon={<Download className={`w-5 h-5 ${cache.wanted && cache.ready === cache.wanted ? 'text-emerald-400' : 'text-amber-400'}`} />} title="Contenido guardado en el equipo">
                    <p className="text-sm text-slate-500">
                        {cache.wanted
                            ? `${cache.ready ?? 0} de ${cache.wanted} archivos`
                            : 'Sin archivos para guardar'}
                        {typeof cache.bytes_mb === 'number' ? ` · ${cache.bytes_mb} MB usados` : ''}
                        {cache.quota_mb ? ` de ${cache.quota_mb} MB` : ''}
                    </p>
                    {cache.wanted ? (
                        <p className={`text-xs mt-0.5 ${cache.ready === cache.wanted ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {cache.ready === cache.wanted
                                ? 'Si se corta internet, sigue reproduciendo todo.'
                                : cache.downloading
                                    ? 'Descargando… sin internet todavía faltaría contenido.'
                                    : 'Falta contenido: sin internet no se vería todo.'}
                        </p>
                    ) : null}
                    {cache.last_error && <p className="text-xs text-rose-400 mt-0.5 break-words">Último problema: {cache.last_error}</p>}
                </Row>
            )}

            {telemetry.webview && (
                <Row icon={<Globe className="w-5 h-5 text-slate-500" />} title="Navegador interno (WebView)">
                    <p className="text-sm text-slate-500 break-words">{telemetry.webview}</p>
                </Row>
            )}

            {telemetry.last_crash && (
                <Row icon={<AlertTriangle className="w-5 h-5 text-rose-500" />} title="Último cierre inesperado de la app">
                    <details className="mt-1">
                        <summary className="text-sm text-rose-300 cursor-pointer break-words">
                            {telemetry.last_crash.split('\n').find(line => line.trim() && !line.startsWith('Hilo ')) || 'Ver detalle'}
                        </summary>
                        <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-slate-950 border border-slate-800 p-3 text-[11px] leading-snug text-slate-400 whitespace-pre-wrap break-words">
                            {telemetry.last_crash}
                        </pre>
                    </details>
                </Row>
            )}

            {player?.last_web_error && (
                <Row icon={<Bug className="w-5 h-5 text-amber-400" />} title="Último error del reproductor">
                    <p className="text-sm text-slate-500 break-words">{player.last_web_error.message}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{formatDate(player.last_web_error.at)}</p>
                </Row>
            )}
        </>
    );
}
