import { Link } from 'react-router-dom';
import { Activity, Edit2, Eye, MonitorPlay, MoreVertical, Move, QrCode, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContentThumb } from '@/components/display/ContentThumb';
import { ScreenPhoto } from '@/components/display/ScreenPhoto';
import type { DeviceScreen } from '@/hooks/use-device-screens';
import { parseScreenQr } from '@/lib/qr';
import { downText, isPortrait, screenName, type describeContent } from '@/lib/screenStatus';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDevice = any;

interface Props {
    device: AnyDevice;
    content: ReturnType<typeof describeContent>;
    shot?: DeviceScreen | null;
    // Qué está pasando según la propia TV (si reportó hace poco).
    nowPlaying?: string | null;
    zoneName?: string | null;
    now: number;
    onChangeContent: () => void;
    onQr: () => void;
    onPreview: () => void;
    onEdit: () => void;
    onMove: () => void;
    onDelete: () => void;
    // Arrastrar la tarjeta (para soltarla en otra zona).
    draggable?: boolean;
    dragging?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    // Recibir otra tarjeta arrastrada (para cambiar el orden).
    dropProps?: Pick<React.HTMLAttributes<HTMLElement>, 'onDragOver' | 'onDragLeave' | 'onDrop'>;
    dropHighlight?: boolean;
}

// Una pantalla: foto real (o lo que tiene asignado), estado y acciones.
export function ScreenCard({ device: d, content, shot, nowPlaying, zoneName, now, onChangeContent, onQr, onPreview, onEdit, onMove, onDelete, draggable, dragging, onDragStart, onDragEnd, dropProps, dropHighlight }: Props) {
    const online = d.derived_status === 'online';
    const qr = parseScreenQr(d.qr_overlay);
    const meta = [
        `Código ${d.device_id}`,
        d.app_version ? `App ${d.app_version}` : null,
        d.android_version ? `Android ${d.android_version}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <article
            draggable={draggable}
            onDragStart={e => {
                e.dataTransfer.setData('text/plain', d.id);
                e.dataTransfer.effectAllowed = 'move';
                onDragStart?.();
            }}
            onDragEnd={onDragEnd}
            {...dropProps}
            className={`group/card relative bg-card border rounded-2xl overflow-hidden flex flex-col transition-all hover:border-indigo-500/40 ${online ? 'border-border' : 'border-amber-500/30'} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging ? 'opacity-40 scale-[0.98]' : ''} ${dropHighlight ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-background' : ''}`}
        >
            {/* Línea de estado arriba */}
            <span className={`absolute inset-x-0 top-0 h-0.5 z-10 ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
            <ScreenPhoto
                device={d}
                screen={shot}
                orientation={d.orientation}
                contentSince={d.assignment?.created_at}
                className="aspect-video"
                fallback={content.cover ? (
                    <ContentThumb
                        large
                        item={content.cover}
                        className={`absolute inset-0 w-full h-full ${online ? '' : 'grayscale opacity-60'} group-hover/card:scale-[1.02] transition-transform`}
                        iconClassName="w-8 h-8"
                    />
                ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-zinc-500">
                        <MonitorPlay className="w-10 h-10" />
                    </span>
                )}
            >
                <button type="button" onClick={onChangeContent} className="absolute inset-0 cursor-pointer" title="Cambiar el contenido de esta pantalla" aria-label={`Cambiar el contenido de ${screenName(d)}`} />
                <span className="absolute top-2 right-2 flex gap-1 pointer-events-none">
                    {qr && (
                        <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-bold text-black flex items-center gap-1"><QrCode className="w-3 h-3" /> QR</span>
                    )}
                    <span className="rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">{isPortrait(d) ? 'Vertical' : 'Horizontal'}</span>
                </span>
                {(nowPlaying || content.title) && (
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pl-3 pr-28 pt-6 pb-2 text-sm font-medium text-white truncate pointer-events-none">
                        {online ? 'Ahora' : 'Último'}: {nowPlaying || content.title}
                    </span>
                )}
            </ScreenPhoto>

            <div className="p-4 flex-1 flex flex-col gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={`relative flex w-2.5 h-2.5 shrink-0`}>
                            {online && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />}
                            <span className={`relative inline-flex w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        </span>
                        <h3 className="font-semibold truncate">{screenName(d)}</h3>
                        {zoneName && (
                            <span className="ml-auto shrink-0 max-w-[45%] truncate rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground" title={`Zona: ${zoneName}`}>
                                {zoneName}
                            </span>
                        )}
                    </div>
                    <p className={`text-sm mt-0.5 ${online ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                        {online ? 'En línea' : downText(d, now).replace(/^./, c => c.toUpperCase())}
                    </p>
                    <p className="text-sm text-muted-foreground truncate mt-1">{content.detail}</p>
                    <p className="text-[11px] text-muted-foreground/80 truncate mt-1 font-mono">{meta}</p>
                </div>
                <div className="mt-auto flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={onChangeContent}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Cambiar contenido
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={onQr}
                        title={qr ? 'Cambiar el QR fijo' : 'Poner un QR fijo en la pantalla'}
                        aria-label="QR fijo en la pantalla"
                        className={qr ? 'border-indigo-500/60 text-indigo-600 dark:text-indigo-400' : ''}
                    >
                        <QrCode className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={`Más opciones de ${screenName(d)}`}><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-card text-foreground border-border">
                            <DropdownMenuItem className="cursor-pointer" onClick={onPreview}><Eye className="w-4 h-4 mr-2" /> Ver cómo se ve</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={onEdit}><Edit2 className="w-4 h-4 mr-2" /> Nombre y ajustes</DropdownMenuItem>
                            <DropdownMenuItem asChild className="cursor-pointer">
                                <Link to={`/admin/display/${d.id}`}><Activity className="w-4 h-4 mr-2" /> Detalles y diagnóstico</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer" onClick={onMove}><Move className="w-4 h-4 mr-2" /> Cambiar de zona</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={onDelete}><Trash2 className="w-4 h-4 mr-2" /> Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </article>
    );
}
