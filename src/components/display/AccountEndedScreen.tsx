import { LogOut, MessageCircle } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { PosterView } from '@/components/display/posters/PosterView';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { usePriceLists } from '@/hooks/use-price-lists';
import { formatRatio, isPosterItem, type PosterConfig } from '@/lib/posters';
import { KEEP_DAYS_AFTER_END } from '@/lib/accounts';
import { contractWhatsappUrl, supportWhatsappUrl } from '@/lib/trial';

interface Props {
    commerceId: string;
    commerceName?: string | null;
    kind: 'vencida' | 'baja';
    trialEndsAt?: string | null;
    onLogout?: () => void;
}

// Lo que ve en el panel alguien cuya prueba terminó (o un negocio dado de baja):
// lo que armó, hasta cuándo se guarda y cómo seguir.
export function AccountEndedScreen({ commerceId, commerceName, kind, trialEndsAt, onLogout }: Props) {
    const { data: media = [] } = useDisplayMedia(commerceId);
    const { data: priceLists } = usePriceLists(commerceId);
    const posters = media.filter(isPosterItem);
    const lists = priceLists?.lists || [];
    const ended = kind === 'vencida';
    const keepUntil = trialEndsAt
        ? new Date(Date.parse(trialEndsAt) + KEEP_DAYS_AFTER_END * 86400000).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
        : null;

    return (
        <div className="min-h-[100dvh] w-full bg-background text-foreground overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 md:px-8 py-10 md:py-16 space-y-10">
                <div className="flex items-center justify-between gap-3">
                    <div className="font-bold text-lg font-[Orbitron]">Display <span className="text-indigo-500">Hub</span></div>
                    {onLogout && (
                        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
                            <LogOut className="w-4 h-4 mr-2" /> Salir
                        </Button>
                    )}
                </div>

                <div className="space-y-4">
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                        {ended ? 'Terminó tu prueba' : 'Tu cuenta está en pausa'}
                    </h1>
                    <p className="text-lg text-muted-foreground max-w-2xl">
                        {ended
                            ? <>Gracias por probar Display Digital{commerceName ? <> con <strong className="text-foreground">{commerceName}</strong></> : null}. Si lo contratás, lo dejamos funcionando en tu TV con el <strong className="text-foreground">equipo Display Digital</strong> y seguís con todo lo que armaste.</>
                            : <>Las pantallas{commerceName ? <> de <strong className="text-foreground">{commerceName}</strong></> : null} no están mostrando contenido. Escribinos para volver a activarla.</>}
                    </p>
                    {ended && keepUntil && (
                        <p className="text-sm text-muted-foreground">Guardamos lo que armaste hasta el <strong className="text-foreground">{keepUntil}</strong>.</p>
                    )}
                    <div className="flex flex-wrap gap-3 pt-2">
                        <a href={ended ? contractWhatsappUrl(commerceName) : supportWhatsappUrl(commerceName)} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 font-bold text-white hover:bg-[#1fb457]">
                            <FaWhatsapp className="w-5 h-5" /> {ended ? 'Quiero contratarlo' : 'Escribinos'}
                        </a>
                        <a href="tel:+5493624547382" className="inline-flex items-center gap-2 rounded-full border border-border px-6 py-3 font-semibold hover:bg-muted">
                            <MessageCircle className="w-5 h-5" /> 362 454-7382
                        </a>
                    </div>
                </div>

                {(posters.length > 0 || lists.length > 0) && (
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold">Lo que armaste</h2>
                        {lists.length > 0 && (
                            <p className="text-muted-foreground">
                                {lists.length} {lists.length === 1 ? 'lista de precios' : 'listas de precios'} con {lists.reduce((n, l) => n + l.items.length, 0)} productos.
                            </p>
                        )}
                        {posters.length > 0 && (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {posters.slice(0, 6).map(p => {
                                    const config = (p.metadata as { config?: PosterConfig } | null)?.config;
                                    if (!config) return null;
                                    return (
                                        <figure key={p.id} className="space-y-1.5">
                                            <div className="relative overflow-hidden rounded-xl border border-border bg-black" style={{ aspectRatio: String(formatRatio(config.format)) }}>
                                                <PosterView config={{ ...config, animation: 'none' }} lists={lists} />
                                            </div>
                                            <figcaption className="text-xs text-muted-foreground truncate">{p.name}</figcaption>
                                        </figure>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    );
}
