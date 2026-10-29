import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, MoreVertical, Trash2, Edit2, Send, ListVideo, Image as ImageIcon, Video, Globe, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SendToScreensModal } from '@/components/display/SendToScreensModal';

import { useDisplayCampaigns, useCreateCampaign, useDeleteCampaign, useDisplayDevices } from "@/hooks/use-display-hub";
import { formatDuration, loopDuration, playlistItems } from '@/lib/playlistItems';
import type { DisplayCampaign } from '@/types/display';

type Filter = 'all' | 'live' | 'unused';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyItem = any;

function Thumb({ item }: { item: AnyItem }) {
    const url = item?.imageUrl || item?.url;
    const type = item?.type;
    if ((type === 'image' || type === 'image_ad') && url) {
        return <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />;
    }
    if ((type === 'video' || type === 'video_ad') && url) {
        return <video src={`${url}#t=0.5`} className="w-full h-full object-cover" muted playsInline preload="metadata" />;
    }
    const Icon = type === 'video' ? Video : type === 'url' || type === 'external_url' || type === 'web' ? Globe : type === 'image' ? ImageIcon : LayoutGrid;
    return (
        <div className="w-full h-full flex items-center justify-center bg-muted">
            <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
    );
}

// Playlists: qué pasa cada pantalla. Cada tarjeta muestra el contenido, cuánto
// dura una vuelta y en qué pantallas se está viendo.
const DisplayPlaylists = () => {
    const navigate = useNavigate();
    const { commerceId } = useParams<{ commerceId: string }>();
    const effectiveCommerceId = commerceId || 'unknown';

    const { data: campaigns = [], isLoading } = useDisplayCampaigns(effectiveCommerceId);
    const { data: devices = [] } = useDisplayDevices(effectiveCommerceId);
    const createCampaign = useCreateCampaign();
    const deleteCampaign = useDeleteCampaign();

    const [filter, setFilter] = useState<Filter>('all');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCampaignData, setNewCampaignData] = useState({ name: '', description: '' });
    const [sending, setSending] = useState<DisplayCampaign | null>(null);

    // Pantallas que muestran cada playlist (directo o en alguna franja de su programación).
    const screensByPlaylist = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const device of devices as AnyItem[]) {
            if (device.pairing_status !== 'linked') continue;
            const a = device.assignment;
            if (!a) continue;
            const ids = new Set<string>();
            if (a.campaign_id) ids.add(a.campaign_id);
            if (a.schedule?.default_campaign_id) ids.add(a.schedule.default_campaign_id);
            for (const ev of a.schedule?.events || []) if (ev?.campaign_id) ids.add(ev.campaign_id);
            for (const id of ids) map.set(id, [...(map.get(id) || []), device.name || `Pantalla ${device.device_id}`]);
        }
        return map;
    }, [devices]);

    const liveCount = campaigns.filter(c => screensByPlaylist.has(c.id)).length;
    const visible = campaigns.filter(c =>
        filter === 'all' ? true : filter === 'live' ? screensByPlaylist.has(c.id) : !screensByPlaylist.has(c.id)
    );

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCampaignData.name.trim()) {
            toast.error('Poné un nombre para la playlist');
            return;
        }
        createCampaign.mutate({
            commerceId: effectiveCommerceId,
            name: newCampaignData.name.trim(),
            description: newCampaignData.description
        }, {
            onSuccess: (newCampaign) => {
                setIsCreateModalOpen(false);
                setNewCampaignData({ name: '', description: '' });
                toast.success('Playlist creada');
                navigate(`/admin/display/commerce/${effectiveCommerceId}/playlists/${newCampaign.id}`);
            },
            onError: () => toast.error('No se pudo crear la playlist')
        });
    };

    const handleDelete = (campaign: DisplayCampaign) => {
        const screens = screensByPlaylist.get(campaign.id);
        const warning = screens?.length ? `\n\nAhora se muestra en: ${screens.join(', ')}.` : '';
        if (!window.confirm(`¿Eliminar la playlist "${campaign.name}"?${warning}`)) return;
        deleteCampaign.mutate({ id: campaign.id }, { onSuccess: () => toast.success('Playlist eliminada') });
    };

    if (isLoading) return (
        <div className="min-h-[60vh] flex items-center justify-center bg-background text-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
    );

    const filters: { id: Filter; label: string; count: number }[] = [
        { id: 'all', label: 'Todas', count: campaigns.length },
        { id: 'live', label: 'En pantalla', count: liveCount },
        { id: 'unused', label: 'Sin usar', count: campaigns.length - liveCount },
    ];

    return (
        <div className="min-h-full bg-background text-foreground px-4 md:px-8 pt-6 pb-10 flex flex-col gap-5">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="space-y-1 max-w-2xl">
                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Playlists</h1>
                    <p className="text-sm md:text-base text-muted-foreground">
                        Una playlist es lo que pasa una pantalla: tus fotos y videos en orden, una y otra vez.
                    </p>
                </div>
                <Button onClick={() => setIsCreateModalOpen(true)} className="h-11 px-5 bg-indigo-600 hover:bg-indigo-700 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Nueva playlist
                </Button>
            </header>

            {campaigns.length > 0 && (
                <div role="group" aria-label="Filtrar playlists" className="flex flex-wrap gap-1.5">
                    {filters.map(f => (
                        <button
                            key={f.id}
                            type="button"
                            aria-pressed={filter === f.id}
                            onClick={() => setFilter(f.id)}
                            className={`h-10 px-3.5 rounded-full text-sm border transition-colors ${filter === f.id
                                ? 'border-indigo-500 bg-indigo-500/10 text-foreground font-semibold'
                                : 'border-border text-muted-foreground hover:text-foreground hover:border-indigo-500/40'}`}
                        >
                            {f.label} · {f.count}
                        </button>
                    ))}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {visible.map(campaign => {
                    const items = playlistItems(campaign.items_json);
                    const { seconds, exact } = loopDuration(items);
                    const screens = screensByPlaylist.get(campaign.id) || [];
                    const editUrl = `/admin/display/commerce/${effectiveCommerceId}/playlists/${campaign.id}`;
                    const preview = items.slice(0, 4);
                    const more = items.length - preview.length;

                    return (
                        <article key={campaign.id} className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col hover:border-indigo-500/40 transition-colors">
                            <Link to={editUrl} aria-label={`Editar ${campaign.name}`} className="grid grid-cols-4 gap-0.5 h-24 bg-background">
                                {preview.map((item, i) => (
                                    <div key={item?.id || i} className="relative overflow-hidden bg-muted">
                                        <Thumb item={item} />
                                        {i === preview.length - 1 && more > 0 && (
                                            <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-sm font-bold text-white">+{more}</span>
                                        )}
                                    </div>
                                ))}
                                {Array.from({ length: Math.max(0, 4 - preview.length) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="bg-muted/60" />
                                ))}
                            </Link>

                            <div className="p-4 flex flex-col gap-3 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-bold truncate" title={campaign.name}>{campaign.name}</h2>
                                        <p className="text-sm text-muted-foreground">
                                            {items.length === 0
                                                ? 'Vacía: agregale contenido'
                                                : `${items.length} ${items.length === 1 ? 'elemento' : 'elementos'} · ${exact ? '' : '~'}${formatDuration(seconds)} por vuelta`}
                                        </p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" aria-label={`Opciones de ${campaign.name}`} className="text-muted-foreground hover:text-foreground -mr-2 -mt-1 shrink-0">
                                                <MoreVertical className="w-5 h-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                                            <DropdownMenuItem asChild className="cursor-pointer">
                                                <Link to={editUrl}><Edit2 className="w-4 h-4 mr-2" /> Editar</Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(campaign)} className="text-destructive focus:text-destructive cursor-pointer">
                                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <p className={`flex items-start gap-2 text-sm ${screens.length ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
                                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${screens.length ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                                    {screens.length ? `En pantalla: ${screens.join(', ')}` : 'No está en ninguna pantalla'}
                                </p>

                                <div className="flex gap-2 mt-auto pt-1">
                                    <Button asChild variant="secondary" className="flex-1 h-10">
                                        <Link to={editUrl}><Edit2 className="w-4 h-4 mr-2" /> Editar</Link>
                                    </Button>
                                    <Button variant="outline" className="flex-1 h-10 border-border" disabled={items.length === 0} onClick={() => setSending(campaign)}>
                                        <Send className="w-4 h-4 mr-2" /> Enviar a pantallas
                                    </Button>
                                </div>
                            </div>
                        </article>
                    );
                })}

                {campaigns.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-card/40 gap-2">
                        <ListVideo className="w-12 h-12 text-muted-foreground" />
                        <h2 className="text-xl font-bold">Todavía no tenés playlists</h2>
                        <p className="text-muted-foreground max-w-sm">
                            Creá una, sumale fotos y videos de Medios y elegí en qué pantallas se ve.
                        </p>
                        <Button onClick={() => setIsCreateModalOpen(true)} className="mt-4 h-11 bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="w-4 h-4 mr-2" /> Crear mi primera playlist
                        </Button>
                    </div>
                )}
                {campaigns.length > 0 && visible.length === 0 && (
                    <p className="col-span-full text-muted-foreground py-8 text-center">
                        {filter === 'live' ? 'Ninguna playlist se está mostrando ahora.' : 'Todas las playlists están en alguna pantalla.'}
                    </p>
                )}
            </div>

            <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogContent className="bg-card border-border text-foreground">
                    <DialogHeader>
                        <DialogTitle>Nueva playlist</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Ponele un nombre. En el paso siguiente le sumás el contenido.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre</Label>
                            <Input
                                id="name"
                                value={newCampaignData.name}
                                onChange={e => setNewCampaignData({ ...newCampaignData, name: e.target.value })}
                                placeholder="Ej.: Promociones de verano"
                                className="bg-background border-border"
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="desc">Descripción (opcional)</Label>
                            <Input
                                id="desc"
                                value={newCampaignData.description}
                                onChange={e => setNewCampaignData({ ...newCampaignData, description: e.target.value })}
                                placeholder="Para qué es o dónde se usa"
                                className="bg-background border-border"
                            />
                        </div>
                        <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={createCampaign.isPending}>
                            {createCampaign.isPending ? 'Creando…' : 'Crear y agregar contenido'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <SendToScreensModal
                isOpen={!!sending}
                onClose={() => setSending(null)}
                selectedAssets={sending ? [{ id: sending.id, type: 'campaign', name: sending.name }] : []}
                commerceId={effectiveCommerceId}
                onSuccess={() => setSending(null)}
            />
        </div>
    );
};

export default DisplayPlaylists;
