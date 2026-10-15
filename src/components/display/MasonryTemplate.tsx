import { useMemo } from "react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings } from "@/hooks/use-event-settings";
import { useWallEffects } from "@/hooks/use-wall-effects";
import { useGuestUrl, useIsPortrait } from "@/hooks/use-wall";
import { useEvent } from "@/context/EventContext";
import { getWallStats, wallItems } from "@/lib/wallStats";
import { accentVars } from "@/lib/wallAccent";
import { RouletteModal } from "@/components/display/RouletteModal";
import { MessageCard, PhotoCredit, WallBackground, WallEmpty, WallHeader } from "@/components/display/WallChrome";
import { Submission } from "@/types";

// "Muro social": columnas de fotos y mensajes que suben despacio y sin fin,
// cada una a su ritmo. En una TV nadie puede bajar, así que el muro se mueve solo.

const SECONDS_PER_CARD = 12;

const Card = ({ item }: { item: Submission }) =>
    item.type === 'photo' ? (
        <div className="overflow-hidden rounded-2xl bg-black/40 shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
            <img src={item.content} alt="" className="block h-auto w-full" />
            {(item.caption || item.author) && (
                <div className="px-4 py-3 empty:hidden">
                    <PhotoCredit item={item} />
                </div>
            )}
        </div>
    ) : (
        <MessageCard item={item} className="shadow-2xl" />
    );

interface MasonryTemplateProps {
    eventId?: string;
}

export const MasonryTemplate = ({ eventId }: MasonryTemplateProps) => {
    const { submissions } = useSubmissions(eventId);
    const { data: settings } = useEventSettings(eventId);
    const { event } = useEvent();
    useWallEffects(eventId, settings);

    const portrait = useIsPortrait();
    const guestUrl = useGuestUrl(event);
    const stats = useMemo(() => getWallStats(submissions), [submissions]);
    const pool = useMemo(() => wallItems(submissions), [submissions]);

    const colCount = portrait ? 3 : 5;
    const columns = useMemo(() => {
        const cols: Submission[][] = Array.from({ length: colCount }, () => []);
        pool.forEach((item, i) => cols[i % colCount].push(item));
        // Columnas cortas se repiten para que la vuelta no deje huecos
        return cols.filter((c) => c.length).map((c) => {
            const filled = [...c];
            while (filled.length < 3) filled.push(...c);
            return filled;
        });
    }, [pool, colCount]);

    // Con una tarjeta por columna quedan quietas y centradas; con más, suben
    const scrolling = pool.length > colCount;

    return (
        <div
            className={`absolute inset-0 flex flex-col overflow-hidden bg-black text-white ${settings?.font_family || 'font-sans'}`}
            style={accentVars(settings?.accent_color)}
        >
            <WallBackground settings={settings} dim="strong" />
            <WallHeader settings={settings} stats={stats} guestUrl={guestUrl} variant="bar" showQr={pool.length > 0} />

            {pool.length === 0 ? (
                <WallEmpty settings={settings} guestUrl={guestUrl} />
            ) : (
                <main
                    className={`relative z-10 flex flex-1 min-h-0 gap-5 px-8 portrait:px-5 ${scrolling ? '' : 'items-center justify-center pb-8'}`}
                    style={scrolling ? { maskImage: 'linear-gradient(to bottom, transparent, black 6%, black 92%, transparent)' } : undefined}
                >
                    {columns.map((col, c) => (
                        <div key={c} className={`min-w-0 ${scrolling ? 'flex-1 overflow-hidden' : 'w-1/5 portrait:w-1/3 max-h-full overflow-hidden'}`}>
                            {scrolling ? (
                                <div
                                    className="animate-wall-scroll"
                                    // cada columna a un ritmo un poco distinto; la lista va dos veces para que no se corte
                                    style={{ animationDuration: `${col.length * SECONDS_PER_CARD * (1 + (c % 3) * 0.12)}s` }}
                                >
                                    {[0, 1].map((copy) => (
                                        <div key={copy} className="flex flex-col gap-5 pb-5" aria-hidden={copy === 1}>
                                            {col.map((item, i) => <Card key={`${item.id}-${i}`} item={item} />)}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-5">
                                    <Card item={col[0]} />
                                </div>
                            )}
                        </div>
                    ))}
                </main>
            )}

            <RouletteModal />
        </div>
    );
};
