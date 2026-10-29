import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Bell, BellOff, CalendarClock, Megaphone, ChevronDown, FolderOpen, ListVideo, MonitorPlay, Plus, RefreshCw, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useDisplayCampaigns, useDisplayDevices, useDisplaySchedules } from '@/hooks/use-display-hub';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { assignmentContentNow } from '@/lib/displaySchedule';
import { itemsActiveOn, playlistItems } from '@/lib/playlistItems';
import { describeAlertSchedule, formatDownFor } from '@/lib/screenAlerts';
import { useAlertSettings } from '@/hooks/use-alert-settings';
import { AlertSettingsModal } from '@/components/display/AlertSettingsModal';
import { UrgentAlertModal } from '@/components/display/UrgentAlertModal';
import { useActiveUrgentAlerts, useCancelUrgentAlert } from '@/hooks/use-urgent-alerts';
import { toast } from 'sonner';
import { ContentThumb } from '@/components/display/ContentThumb';
import { ScreenPhoto } from '@/components/display/ScreenPhoto';
import { useDeviceScreens } from '@/hooks/use-device-screens';
import { ChangeScreenContentModal } from '@/components/display/ChangeScreenContentModal';
import { OnboardingWizardWidget } from '@/components/display/OnboardingWizardWidget';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDevice = any;

const MAX_DOWN_LISTED = 4;

const screenName = (d: AnyDevice) => d.name || `Pantalla ${d.device_id}`;
const isPortrait = (d: AnyDevice) => d.orientation === 'portrait' || d.orientation === '90' || d.orientation === '270';

// "sin señal hace 2 h" / "nunca se conectó"
function downText(d: AnyDevice, now: number): string {
    if (!d.last_seen) return 'nunca se conectó';
    return `sin señal ${formatDownFor(Math.max(0, now - new Date(d.last_seen).getTime()))}`;
}

// Lo que pasa una pantalla, listo para mostrar.
function describeContent(d: AnyDevice, now: Date) {
    const { campaign, media, schedule } = assignmentContentNow(d.assignment, now);
    const items = campaign ? itemsActiveOn(playlistItems(campaign.items_json)) : media ? [media] : [];
    const title = campaign?.name || media?.name || null;
    let detail = 'Sin contenido asignado';
    if (schedule) detail = `Programación: ${schedule.name || 'sin nombre'}`;
    else if (campaign) detail = `Playlist: ${campaign.name}`;
    else if (media) detail = `Archivo: ${media.name}`;
    return { title, detail, cover: items[0] || null, campaignId: d.assignment?.campaign_id || null, scheduleId: d.assignment?.schedule_id || null, campaignNowId: campaign?.id || null };
}

function WhatToDo({ device }: { device: AnyDevice }) {
    return (
        <ol className="mt-2 space-y-1 text-sm text-foreground/80 list-decimal pl-5">
            <li>Fijate que el equipo esté prendido y la TV en la entrada HDMI correcta.</li>
            <li>Revisá que tenga internet (el Wi-Fi del local o el cable).</li>
            <li>Desenchufalo 10 segundos y volvé a enchufarlo.</li>
            <li>
                Si sigue igual,{' '}
                <Link to={`/admin/display/${device.id}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">mirá los detalles del equipo</Link>.
            </li>
        </ol>
    );
}

// Inicio: cómo están las pantallas ahora y qué pasa cada una.
export default function WorkspaceDashboard() {
    const { commerceId = '' } = useParams<{ commerceId: string }>();
    const { data: devices = [], isLoading } = useDisplayDevices(commerceId);
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const { data: media = [] } = useDisplayMedia(commerceId);
    const { data: schedules = [] } = useDisplaySchedules(commerceId);

    const [openHelp, setOpenHelp] = useState<string | null>(null);
    const [changing, setChanging] = useState<AnyDevice | null>(null);
    const [showAllDown, setShowAllDown] = useState(false);
    const { data: alertSettings } = useAlertSettings(commerceId);
    const [alertsOpen, setAlertsOpen] = useState(false);
    const { data: urgent } = useActiveUrgentAlerts(commerceId);
    const cancelUrgent = useCancelUrgentAlert();
    const [urgentOpen, setUrgentOpen] = useState(false);

    const now = new Date();
    const nowMs = now.getTime();

    const screens = useMemo(() => (devices as AnyDevice[])
        .filter(d => d.pairing_status === 'linked')
        .sort((a, b) => {
            const onlineA = a.derived_status === 'online' ? 0 : 1;
            const onlineB = b.derived_status === 'online' ? 0 : 1;
            return onlineA - onlineB || screenName(a).localeCompare(screenName(b));
        }), [devices]);
    const waiting = (devices as AnyDevice[]).filter(d => d.pairing_status === 'pending').length;
    const online = screens.filter(d => d.derived_status === 'online');
    const down = screens
        .filter(d => d.derived_status !== 'online')
        .sort((a, b) => (b.last_seen || '').localeCompare(a.last_seen || ''));
    const downListed = showAllDown ? down : down.slice(0, MAX_DOWN_LISTED);

    const files = media.filter(m => m.type !== 'folder');
    const images = files.filter(m => m.type === 'image' || m.type === 'image_ad').length;
    const videos = files.filter(m => m.type === 'video' || m.type === 'video_ad').length;
    const others = files.length - images - videos;

    // Foto real de cada pantalla y qué estaba pasando según la propia TV
    // (si reportó hace menos de 15 minutos).
    const { data: screenShots = {} } = useDeviceScreens(screens.map(d => d.id));
    const nowName = (d: AnyDevice): string | null => {
        const shot = screenShots[d.id];
        if (!shot?.now_playing?.name) return null;
        return nowMs - new Date(shot.captured_at).getTime() < 15 * 60 * 1000 ? shot.now_playing.name : null;
    };

    const contents = new Map(screens.map(d => [d.id, describeContent(d, now)]));
    const playlistsOnAir = new Set([...contents.values()].map(c => c.campaignNowId).filter(Boolean)).size;
    const screensWithSchedule = screens.filter(d => d.assignment?.schedule_id).length;

    const base = `/admin/display/commerce/${commerceId}/workspace`;
    // La guía aparece mientras falta configurar algo, o si se pidió desde el menú (?guia=1).
    const [searchParams] = useSearchParams();
    const setupPending = searchParams.get('guia') === '1'
        || (!isLoading && (screens.length === 0 || files.length === 0 || campaigns.length === 0));

    return (
        <div className="p-4 md:p-8 w-full max-w-7xl mx-auto space-y-6">
            {/* Encabezado */}
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Inicio</h1>
                    <p className="text-muted-foreground mt-1">Así están tus pantallas ahora.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {urgent?.available && screens.length > 0 && (
                        <Button variant="outline" onClick={() => setUrgentOpen(true)} className="h-11 px-4 border-rose-500/50 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 hover:text-rose-600">
                            <Megaphone className="w-4 h-4 mr-2" /> Aviso urgente
                        </Button>
                    )}
                    <Button variant="outline" asChild className="h-11 px-4">
                        <Link to={`${base}/library?subir=1`}><Upload className="w-4 h-4 mr-2" /> Subir contenido</Link>
                    </Button>
                    <Button asChild className="h-11 px-4 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Link to={`${base}/playlists?nueva=1`}><Plus className="w-4 h-4 mr-2" /> Nueva playlist</Link>
                    </Button>
                </div>
            </div>

            {/* Avisos urgentes activos */}
            {(urgent?.alerts || []).map(a => {
                const count = a.device_ids ? a.device_ids.length : screens.length;
                const codes = screens.filter(d => !a.device_ids || a.device_ids.includes(d.id)).map(d => d.device_id);
                return (
                    <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3">
                        <Megaphone className="w-5 h-5 text-rose-500 shrink-0 animate-pulse" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">“{a.message}”</p>
                            <p className="text-sm text-muted-foreground">
                                Aviso en {a.device_ids ? (count === 1 ? '1 pantalla' : `${count} pantallas`) : 'todas las pantallas'} · hasta las {new Date(a.ends_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={cancelUrgent.isPending}
                            onClick={() => cancelUrgent.mutate({ id: a.id, commerceId, notifyCodes: codes }, {
                                onSuccess: () => toast.success('Aviso quitado: las pantallas vuelven a lo programado'),
                                onError: () => toast.error('No se pudo quitar el aviso'),
                            })}
                        >
                            Quitar ya
                        </Button>
                    </div>
                );
            })}

            {/* Estado + resumen */}
            <div className="flex flex-wrap gap-5">
                <section className="flex-[2_1_420px] bg-card border border-border rounded-2xl p-5 md:p-6 space-y-4">
                    {isLoading ? (
                        <p className="text-muted-foreground">Cargando pantallas…</p>
                    ) : screens.length === 0 ? (
                        <div>
                            <p className="text-xl font-semibold">Todavía no tenés pantallas vinculadas</p>
                            <p className="text-muted-foreground mt-1">Prendé el equipo, anotá el código que aparece en la TV y vinculalo desde{' '}
                                <Link to={`${base}/screens`} className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Pantallas</Link>.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                <span className="text-4xl font-extrabold tracking-tight">{online.length} de {screens.length}</span>
                                <span className="text-lg text-muted-foreground">{screens.length === 1 ? 'pantalla funcionando' : 'pantallas funcionando'}</span>
                            </div>
                            <div className="flex gap-1 h-2.5" aria-hidden>
                                {screens.map((d, i) => (
                                    <span
                                        key={d.id}
                                        className={`flex-1 ${d.derived_status === 'online' ? 'bg-emerald-500' : 'bg-amber-500'} ${i === 0 ? 'rounded-l-full' : ''} ${i === screens.length - 1 ? 'rounded-r-full' : ''}`}
                                    />
                                ))}
                            </div>
                            {down.length === 0 ? (
                                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Todas andan bien.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {downListed.map(d => (
                                        <li key={d.id} className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5">
                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                                                <span className="font-semibold">{screenName(d)}</span>
                                                <span className="text-amber-700 dark:text-amber-300">{downText(d, nowMs)}</span>
                                                <button
                                                    onClick={() => setOpenHelp(openHelp === d.id ? null : d.id)}
                                                    className="ml-auto flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                    aria-expanded={openHelp === d.id}
                                                >
                                                    Qué hacer <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openHelp === d.id ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>
                                            {openHelp === d.id && <WhatToDo device={d} />}
                                        </li>
                                    ))}
                                    {down.length > MAX_DOWN_LISTED && (
                                        <li>
                                            <button onClick={() => setShowAllDown(!showAllDown)} className="text-sm text-muted-foreground hover:text-foreground">
                                                {showAllDown ? 'Ver menos' : `Ver las otras ${down.length - MAX_DOWN_LISTED}`}
                                            </button>
                                        </li>
                                    )}
                                </ul>
                            )}
                            {waiting > 0 && (
                                <p className="text-sm text-muted-foreground">
                                    {waiting === 1 ? '1 equipo espera que lo vincules' : `${waiting} equipos esperan que los vincules`} en{' '}
                                    <Link to={`${base}/screens`} className="text-indigo-600 dark:text-indigo-400 hover:underline">Pantallas</Link>.
                                </p>
                            )}
                            {alertSettings && (
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-sm">
                                    {alertSettings.alerts_enabled ? <Bell className="w-4 h-4 text-indigo-500" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                                    <span className="text-muted-foreground">
                                        {alertSettings.alerts_enabled && (alertSettings.alert_email || alertSettings.email)
                                            ? <>Avisos por email a <span className="text-foreground font-medium">{alertSettings.alert_email || alertSettings.email}</span> · {describeAlertSchedule(alertSettings)}</>
                                            : 'Los avisos por email están apagados'}
                                    </span>
                                    <button onClick={() => setAlertsOpen(true)} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                                        {alertSettings.alerts_enabled ? 'Cambiar' : 'Activar'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </section>

                <div className="flex-[1_1_260px] flex flex-col gap-3">
                    <Link to={`${base}/library`} className="flex-1 flex items-center gap-3.5 bg-card border border-border rounded-2xl px-4 py-4 hover:border-indigo-500/50 transition-colors">
                        <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><FolderOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></span>
                        <span className="min-w-0">
                            <span className="block font-semibold">{files.length} {files.length === 1 ? 'archivo' : 'archivos'}</span>
                            <span className="block text-sm text-muted-foreground truncate">{images} imágenes · {videos} videos · {others} apps y webs</span>
                        </span>
                    </Link>
                    <Link to={`${base}/playlists`} className="flex-1 flex items-center gap-3.5 bg-card border border-border rounded-2xl px-4 py-4 hover:border-indigo-500/50 transition-colors">
                        <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><ListVideo className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></span>
                        <span className="min-w-0">
                            <span className="block font-semibold">{campaigns.length} {campaigns.length === 1 ? 'playlist' : 'playlists'}</span>
                            <span className="block text-sm text-muted-foreground truncate">
                                {playlistsOnAir === 0 ? 'Ninguna se está mostrando' : playlistsOnAir === 1 ? '1 se está mostrando ahora' : `${playlistsOnAir} se están mostrando ahora`}
                            </span>
                        </span>
                    </Link>
                    {schedules.length === 0 ? (
                        <Link to={`${base}/schedule`} className="flex-1 flex items-center gap-3.5 bg-card border border-dashed border-border rounded-2xl px-4 py-4 hover:border-indigo-500/50 transition-colors">
                            <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></span>
                            <span className="min-w-0">
                                <span className="block font-semibold">Sin programación</span>
                                <span className="block text-sm text-indigo-600 dark:text-indigo-400">Mostrá algo distinto de mañana y de tarde →</span>
                            </span>
                        </Link>
                    ) : (
                        <Link to={`${base}/schedule`} className="flex-1 flex items-center gap-3.5 bg-card border border-border rounded-2xl px-4 py-4 hover:border-indigo-500/50 transition-colors">
                            <span className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0"><CalendarClock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></span>
                            <span className="min-w-0">
                                <span className="block font-semibold">{schedules.length} {schedules.length === 1 ? 'programación' : 'programaciones'}</span>
                                <span className="block text-sm text-muted-foreground truncate">
                                    {screensWithSchedule === 0 ? 'Ninguna pantalla la usa' : screensWithSchedule === 1 ? 'La usa 1 pantalla' : `Las usan ${screensWithSchedule} pantallas`}
                                </span>
                            </span>
                        </Link>
                    )}
                </div>
            </div>

            {setupPending && <OnboardingWizardWidget className="w-full max-w-none" />}

            {/* Pantallas */}
            {screens.length > 0 && (
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <h2 className="text-xl font-bold">Tus pantallas</h2>
                        <Link to={`${base}/screens`} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Ver todas</Link>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {screens.map(d => {
                            const content = contents.get(d.id)!;
                            const isOnline = d.derived_status === 'online';
                            return (
                                <article key={d.id} className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                                    <ScreenPhoto
                                        device={d}
                                        screen={screenShots[d.id]}
                                        className="aspect-video group"
                                        fallback={content.cover ? (
                                            <ContentThumb
                                                large
                                                item={content.cover}
                                                className={`absolute inset-0 w-full h-full ${isOnline ? '' : 'grayscale opacity-60'} group-hover:scale-[1.02] transition-transform`}
                                                iconClassName="w-8 h-8"
                                            />
                                        ) : (
                                            <span className="absolute inset-0 flex items-center justify-center text-zinc-500">
                                                <MonitorPlay className="w-10 h-10" />
                                            </span>
                                        )}
                                    >
                                        <Link to={`/admin/display/${d.id}`} className="absolute inset-0" title="Ver detalles de la pantalla" aria-label={`Ver detalles de ${screenName(d)}`} />
                                        <span className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white pointer-events-none">
                                            {isPortrait(d) ? 'Vertical' : 'Horizontal'}
                                        </span>
                                        {(nowName(d) || content.title) && (
                                            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pl-3 pr-28 pt-6 pb-2 text-sm font-medium text-white truncate pointer-events-none">
                                                {isOnline ? 'Ahora' : 'Último'}: {nowName(d) || content.title}
                                            </span>
                                        )}
                                    </ScreenPhoto>
                                    <div className="p-4 flex-1 flex flex-col gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                <h3 className="font-semibold truncate">{screenName(d)}</h3>
                                            </div>
                                            <p className={`text-sm mt-0.5 ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                                                {isOnline ? 'En línea' : downText(d, nowMs).replace(/^./, c => c.toUpperCase())}
                                            </p>
                                            <p className="text-sm text-muted-foreground truncate mt-1">{content.detail}</p>
                                        </div>
                                        <Button variant="outline" className="mt-auto w-full" onClick={() => setChanging(d)}>
                                            <RefreshCw className="w-4 h-4 mr-2" /> Cambiar contenido
                                        </Button>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>
            )}

            {urgentOpen && (
                <UrgentAlertModal
                    isOpen
                    onClose={() => setUrgentOpen(false)}
                    commerceId={commerceId}
                    screens={screens.map(d => ({ id: d.id, device_id: d.device_id, name: screenName(d) }))}
                />
            )}

            {alertSettings && alertsOpen && (
                <AlertSettingsModal isOpen onClose={() => setAlertsOpen(false)} commerceId={commerceId} settings={alertSettings} />
            )}

            <ChangeScreenContentModal
                isOpen={!!changing}
                onClose={() => setChanging(null)}
                commerceId={commerceId}
                device={changing ? { id: changing.id, name: screenName(changing) } : null}
                currentCampaignId={changing ? contents.get(changing.id)?.campaignId : null}
                currentScheduleId={changing ? contents.get(changing.id)?.scheduleId : null}
            />
        </div>
    );
}
