import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListPlus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCreateCampaign, useDisplayCampaigns, useUpdateCampaign } from '@/hooks/use-display-hub';
import { appendMediaToPlaylist, playlistItems } from '@/lib/playlistItems';
import type { DisplayMedia } from '@/types/display';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    media: DisplayMedia[];
    onSuccess: () => void;
}

// "Agregar a una playlist" desde Medios: suma los archivos elegidos al final
// de una playlist existente o crea una nueva con ellos y abre el editor.
export function AddToPlaylistModal({ isOpen, onClose, commerceId, media, onSuccess }: Props) {
    const navigate = useNavigate();
    const { data: campaigns = [] } = useDisplayCampaigns(commerceId);
    const updateCampaign = useUpdateCampaign();
    const createCampaign = useCreateCampaign();
    const [search, setSearch] = useState('');
    const [newName, setNewName] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    const files = media.filter(m => m.type !== 'folder');
    const visible = useMemo(
        () => campaigns.filter(c => c.name.toLowerCase().includes(search.trim().toLowerCase())),
        [campaigns, search]
    );

    const addTo = async (campaignId: string, name: string, itemsJson: unknown) => {
        setBusyId(campaignId);
        try {
            await updateCampaign.mutateAsync({ id: campaignId, updates: { items_json: appendMediaToPlaylist(itemsJson, files) } });
            toast.success(`${files.length === 1 ? 'Se agregó 1 archivo' : `Se agregaron ${files.length} archivos`} a "${name}"`);
            onSuccess();
            onClose();
        } catch {
            toast.error('No se pudo agregar a la playlist');
        } finally {
            setBusyId(null);
        }
    };

    const createWith = async () => {
        const name = newName.trim();
        if (!name) {
            toast.error('Poné un nombre para la playlist');
            return;
        }
        setBusyId('new');
        try {
            const campaign = await createCampaign.mutateAsync({
                commerceId,
                name,
                description: '',
                items_json: appendMediaToPlaylist(null, files),
            });
            toast.success(`Playlist "${name}" creada`);
            onSuccess();
            onClose();
            navigate(`/admin/display/commerce/${commerceId}/playlists/${campaign.id}`);
        } catch {
            toast.error('No se pudo crear la playlist');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ListPlus className="w-5 h-5 text-indigo-500" />
                        Agregar {files.length === 1 ? '1 archivo' : `${files.length} archivos`} a una playlist
                    </DialogTitle>
                    <DialogDescription>
                        Se suman al final. Después podés cambiar el orden y cuánto dura cada uno desde la playlist.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                    {campaigns.length > 5 && (
                        <Input
                            placeholder="Buscar playlist…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-background border-border"
                        />
                    )}
                    <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                        {visible.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                disabled={busyId !== null}
                                onClick={() => addTo(c.id, c.name, c.items_json)}
                                className="w-full flex items-center justify-between gap-3 rounded-lg border border-border bg-background/60 px-4 py-3 text-left hover:border-indigo-500/60 hover:bg-indigo-500/5 disabled:opacity-60 transition-colors"
                            >
                                <span className="min-w-0">
                                    <span className="block font-medium truncate">{c.name}</span>
                                    <span className="block text-xs text-muted-foreground">{playlistItems(c.items_json).length} elementos</span>
                                </span>
                                <span className="text-sm font-medium text-indigo-500 shrink-0">{busyId === c.id ? 'Agregando…' : 'Agregar'}</span>
                            </button>
                        ))}
                        {visible.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2">{campaigns.length === 0 ? 'Todavía no tenés playlists.' : 'Ninguna playlist con ese nombre.'}</p>
                        )}
                    </div>

                    <div className="border-t border-border pt-3 space-y-2">
                        <label htmlFor="new-playlist-name" className="text-sm font-medium">O creá una playlist nueva con estos archivos</label>
                        <div className="flex gap-2">
                            <Input
                                id="new-playlist-name"
                                placeholder="Ej.: Promos de verano"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') createWith(); }}
                                className="bg-background border-border"
                            />
                            <Button onClick={createWith} disabled={busyId !== null} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                                <Plus className="w-4 h-4 mr-1" /> {busyId === 'new' ? 'Creando…' : 'Crear'}
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
