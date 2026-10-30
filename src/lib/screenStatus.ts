import { assignmentContentNow } from '@/lib/displaySchedule';
import { itemsActiveOn, localDayKey, playlistItems } from '@/lib/playlistItems';
import { itemsActiveNow } from '@/lib/itemRules';
import { formatDownFor } from '@/lib/screenAlerts';

// Textos y datos de una pantalla, compartidos por Inicio y Pantallas.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDevice = any;

export const screenName = (d: AnyDevice) => d.name || `Pantalla ${d.device_id}`;
export const isPortrait = (d: AnyDevice) => d.orientation === 'portrait' || d.orientation === '90' || d.orientation === '270';

// "sin señal hace 2 h" / "nunca se conectó"
export function downText(d: AnyDevice, now: number): string {
    if (!d.last_seen) return 'nunca se conectó';
    return `sin señal ${formatDownFor(Math.max(0, now - new Date(d.last_seen).getTime()))}`;
}

// Lo que pasa una pantalla, listo para mostrar.
export function describeContent(d: AnyDevice, now: Date) {
    const { campaign, media, schedule } = assignmentContentNow(d.assignment, now);
    const inDate = campaign ? itemsActiveOn(playlistItems(campaign.items_json), localDayKey(now)) : media ? [media] : [];
    // Lo que toca a esta hora (sin mirar el clima); si nada, lo primero en fecha.
    const items = campaign ? [...itemsActiveNow(inDate, now), ...inDate] : inDate;
    const title = campaign?.name || media?.name || null;
    let detail = 'Sin contenido asignado';
    if (schedule) detail = `Programación: ${schedule.name || 'sin nombre'}`;
    else if (campaign) detail = `Playlist: ${campaign.name}`;
    else if (media) detail = `Archivo: ${media.name}`;
    return { title, detail, cover: items[0] || null, campaignId: d.assignment?.campaign_id || null, scheduleId: d.assignment?.schedule_id || null, campaignNowId: campaign?.id || null };
}
