import QRCode from "react-qr-code";
import { MessageSquareQuote } from "lucide-react";
import type { Submission } from "@/types";
import { isAnonymousAuthor } from "@/lib/guestSubmissions";
import type { EventSettings } from "@/hooks/use-event-settings";
import type { WallStats } from "@/lib/wallStats";

// Partes comunes a los tres diseños del muro: fondo del tema, título del
// evento, QR para sumarse y contador en vivo.

const DEFAULT_BACKGROUND_IMAGE = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop";

export const WallBackground = ({ settings, dim = 'normal' }: { settings?: EventSettings | null; dim?: 'normal' | 'strong' }) => (
    <div className="absolute inset-0 z-0">
        <img
            src={settings?.background_image_url || DEFAULT_BACKGROUND_IMAGE}
            alt=""
            className="w-full h-full object-cover opacity-60"
        />
        <div className={`absolute inset-0 ${dim === 'strong'
            ? 'bg-gradient-to-b from-black/80 via-black/70 to-black/85'
            : 'bg-gradient-to-t from-black via-black/60 to-black/30'}`} />
    </div>
);

interface WallHeaderProps {
    settings?: EventSettings | null;
    stats: WallStats;
    guestUrl: string;
    showQr?: boolean;
    /** "overlay": flota sobre la foto (Presentación). "bar": franja propia (Cuadrícula y Mosaico). */
    variant?: 'overlay' | 'bar';
}

export const WallCounter = ({ settings, stats }: Pick<WallHeaderProps, 'settings' | 'stats'>) => {
    if (stats.photos === 0 || settings?.wall_counter_enabled === false) return null;
    return (
        <div className="bg-black/50 backdrop-blur-xl border border-white/15 rounded-full px-4 py-1.5 text-lg font-bold shadow-lg tabular-nums whitespace-nowrap">
            🔥 {stats.photos} {stats.photos === 1 ? 'foto' : 'fotos'}
            {stats.guests > 1 && <span className="text-white/80 font-semibold"> · {stats.guests} invitados</span>}
        </div>
    );
};

export const WallQr = ({ guestUrl, size = 120 }: { guestUrl: string; size?: number }) => (
    <div className="bg-white p-3 rounded-2xl shadow-2xl flex flex-col items-center gap-1.5 shrink-0">
        <QRCode value={guestUrl} size={size} />
        <span className="text-black text-sm font-bold whitespace-nowrap">📸 ¡Subí tu foto!</span>
    </div>
);

export const WallHeader = ({ settings, stats, guestUrl, showQr = true, variant = 'overlay' }: WallHeaderProps) => {
    const title = (
        <h1 className={`text-4xl font-bold ${settings?.font_family || 'font-serif'} tracking-tight text-white drop-shadow-lg flex items-center gap-3 min-w-0`}>
            <span className="truncate">{settings?.title || "EventPix"}</span>
            <img src="/pwa-192x192.png" alt="EventPix" className="h-10 w-10 object-contain ml-2 opacity-90 drop-shadow-md shrink-0" />
        </h1>
    );

    if (variant === 'bar') {
        return (
            <header className="relative z-20 flex items-center justify-between gap-6 px-8 py-4 portrait:px-5">
                <div className="min-w-0 space-y-1">
                    {title}
                    <div className="h-1 w-24 rounded-full bg-[var(--accent)]" />
                </div>
                <div className="flex items-center gap-4">
                    <WallCounter settings={settings} stats={stats} />
                    {showQr && <WallQr guestUrl={guestUrl} size={96} />}
                </div>
            </header>
        );
    }

    return (
        <header className="absolute top-0 left-0 z-50 p-6 w-full flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent">
            <div className="min-w-0">{title}</div>
            {/* QR siempre visible + contador en vivo */}
            <div className="flex flex-col items-end gap-3">
                {showQr && <WallQr guestUrl={guestUrl} />}
                <WallCounter settings={settings} stats={stats} />
            </div>
        </header>
    );
};

/** Sin fotos todavía: QR grande para que arranquen */
export const WallEmpty = ({ settings, guestUrl }: { settings?: EventSettings | null; guestUrl: string }) => (
    <div className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6">
        {settings?.splash_logo_url && (
            <img src={settings.splash_logo_url} className="h-28 w-28 object-cover rounded-full border-4 border-white/20 mb-8 shadow-2xl" alt="Logo" />
        )}
        <h2 className="text-5xl md:text-6xl font-bold text-white mb-8 drop-shadow-lg">¡La fiesta recién empieza! Subí tu foto 📸</h2>
        <div className="bg-white p-6 rounded-3xl shadow-[0_0_80px_var(--accent-soft)] ring-4 ring-[var(--accent)]">
            <QRCode value={guestUrl} size={250} />
        </div>
        <p className="text-2xl text-slate-300 mt-8 font-light tracking-wide">Escaneá para aparecer en la pantalla ✨</p>
    </div>
);

/** Nombre y dedicatoria debajo o encima de una foto */
export const PhotoCredit = ({ item, size = 'md' }: { item: Submission; size?: 'sm' | 'md' }) => {
    const named = !isAnonymousAuthor(item.author);
    if (!named && !item.caption) return null;
    return (
        <div className={size === 'sm' ? 'space-y-0.5' : 'space-y-1'}>
            {named && (
                <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span className={`truncate font-semibold text-white ${size === 'sm' ? 'text-base' : 'text-lg'}`}>{item.author}</span>
                </div>
            )}
            {item.caption && (
                <p className={`italic text-white/85 line-clamp-2 ${size === 'sm' ? 'text-sm' : 'text-base'}`}>“{item.caption}”</p>
            )}
        </div>
    );
};

/** Mensaje de texto como tarjeta (Cuadrícula y Mosaico) */
export const MessageCard = ({ item, className = '' }: { item: Submission; className?: string }) => (
    <div className={`flex flex-col justify-center gap-4 rounded-2xl border border-white/15 bg-[var(--accent-soft)] p-6 backdrop-blur-md ${className}`}>
        <MessageSquareQuote className="h-9 w-9 shrink-0 text-[var(--accent-text)]" />
        <p className="font-serif text-2xl italic leading-snug text-white line-clamp-6">“{item.content}”</p>
        {!isAnonymousAuthor(item.author) && (
            <p className="text-lg font-semibold uppercase tracking-widest text-[var(--accent-text)]">— {item.author}</p>
        )}
    </div>
);
