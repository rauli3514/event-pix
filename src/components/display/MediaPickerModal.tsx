import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search, Folder, ArrowLeft, ListVideo } from 'lucide-react';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { useDisplayCampaigns } from '@/hooks/use-display-hub';
import { DisplayMedia, DisplayCampaign } from '@/types/display';
import { ContentThumb } from '@/components/display/ContentThumb';
import { contentKindLabel, isAppItem, isWebItem } from '@/lib/appCovers';
import { cn } from '@/lib/utils';

interface MediaPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    onSelect: (item: DisplayMedia | DisplayCampaign, type: 'media' | 'playlist') => void;
}

type Kind = 'all' | 'image' | 'video' | 'app' | 'web';

const KINDS: { id: Kind; label: string }[] = [
    { id: 'all', label: 'Todo' },
    { id: 'image', label: 'Imágenes' },
    { id: 'video', label: 'Videos' },
    { id: 'app', label: 'Apps' },
    { id: 'web', label: 'Webs' },
];

const kindOf = (file: DisplayMedia): Kind | 'folder' | 'other' => {
    if (file.type === 'folder') return 'folder';
    if (file.type === 'image') return 'image';
    if (file.type === 'video') return 'video';
    if (isAppItem(file)) return 'app';
    if (isWebItem(file)) return 'web';
    return 'other';
};

// Cartelito con el tipo, arriba a la izquierda de cada portada.
const badgeOf = (file: DisplayMedia): string | null =>
    contentKindLabel(file) || (file.type === 'video' ? 'Video' : null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const playlistItems = (playlist: DisplayCampaign): any[] => {
    const raw = playlist.items_json as unknown;
    if (Array.isArray(raw)) return raw;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (raw as any)?.zones?.[0]?.playlist || [];
};

export const MediaPickerModal = ({ isOpen, onClose, commerceId, onSelect }: MediaPickerModalProps) => {
    const { data: mediaFiles = [], isLoading: isLoadingMedia } = useDisplayMedia(commerceId);
    const { data: campaigns = [], isLoading: isLoadingCampaigns } = useDisplayCampaigns(commerceId);

    const [activeTab, setActiveTab] = useState<'media' | 'playlists'>('media');
    const [search, setSearch] = useState('');
    const [kind, setKind] = useState<Kind>('all');
    const [currentFolder, setCurrentFolder] = useState('/');

    // Buscando o filtrando por tipo se ve todo, de cualquier carpeta.
    const browsingAll = !!search || kind !== 'all';

    const filteredFiles = useMemo(() => {
        const q = search.trim().toLowerCase();
        return mediaFiles.filter(file => {
            const k = kindOf(file);
            if (browsingAll) {
                if (k === 'folder') return false;
                if (q && !file.name.toLowerCase().includes(q)) return false;
                if (kind !== 'all' && k !== kind) return false;
                return true;
            }
            return (file.folder_path || '/') === currentFolder;
        }).sort((a, b) => {
            if (a.type === 'folder' && b.type !== 'folder') return -1;
            if (a.type !== 'folder' && b.type === 'folder') return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [mediaFiles, search, kind, browsingAll, currentFolder]);

    const filteredPlaylists = useMemo(() => {
        const q = search.trim().toLowerCase();
        return campaigns.filter(p => !q || p.name.toLowerCase().includes(q));
    }, [campaigns, search]);

    const openFolder = (name: string) => {
        setCurrentFolder(currentFolder === '/' ? `/${name}` : `${currentFolder}/${name}`);
        setSearch('');
    };
    const goUp = () => {
        const parts = currentFolder.split('/');
        parts.pop();
        setCurrentFolder(parts.join('/') || '/');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0A101D] text-slate-200 border-slate-800 shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-2xl h-[80vh] flex flex-col z-[100]">
                {/* La X para cerrar la pone el propio diálogo (antes había dos). */}
                <div className="px-6 py-4 pr-14 border-b border-slate-800 bg-slate-900/80 shrink-0">
                    <DialogTitle className="text-xl text-white font-semibold">Seleccionar contenido</DialogTitle>
                </div>

                <div className="flex border-b border-slate-800 bg-slate-900/50 shrink-0">
                    {(['media', 'playlists'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSearch(''); }}
                            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                        >
                            {tab === 'media' ? 'Archivos y apps' : 'Listas de reproducción'}
                        </button>
                    ))}
                </div>

                <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/30 shrink-0 space-y-3">
                    <div className="flex gap-2 items-center">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input
                            placeholder={activeTab === 'media' ? 'Buscar por nombre…' : 'Buscar playlists…'}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-transparent border-0 focus-visible:ring-0 px-0 text-slate-200"
                        />
                    </div>
                    {activeTab === 'media' && (
                        <div className="flex flex-wrap gap-2">
                            {KINDS.map(k => (
                                <button
                                    key={k.id}
                                    type="button"
                                    onClick={() => setKind(k.id)}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                        kind === k.id ? 'border-indigo-500 bg-indigo-500/20 text-indigo-200' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    {k.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'media' ? (
                        <>
                            {currentFolder !== '/' && !browsingAll && (
                                <button
                                    type="button"
                                    className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg text-sm text-slate-300 hover:bg-slate-800/60"
                                    onClick={goUp}
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Volver <span className="text-slate-500">· {currentFolder}</span>
                                </button>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {filteredFiles.map(file => {
                                    const isFolder = file.type === 'folder';
                                    const badge = badgeOf(file);
                                    const folder = file.folder_path && file.folder_path !== '/' ? file.folder_path : null;
                                    return (
                                        <button
                                            key={file.id}
                                            type="button"
                                            className="group flex flex-col gap-1.5 text-left"
                                            onClick={() => (isFolder ? openFolder(file.name) : onSelect(file, 'media'))}
                                        >
                                            <div className="aspect-video w-full bg-slate-900 rounded-lg border border-slate-800 overflow-hidden group-hover:border-indigo-500 transition-colors relative">
                                                {isFolder ? (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/10">
                                                        <Folder className="w-10 h-10 text-indigo-400" />
                                                    </div>
                                                ) : (
                                                    <ContentThumb item={file} large className="absolute inset-0 w-full h-full" iconClassName="w-8 h-8" />
                                                )}
                                                {badge && (
                                                    <span className="absolute top-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                                        {badge}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-slate-200 truncate px-0.5" title={file.name}>{file.name}</span>
                                            {browsingAll && folder && (
                                                <span className="-mt-1 text-[10px] text-slate-500 truncate px-0.5">{folder}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {filteredFiles.length === 0 && !isLoadingMedia && (
                                <div className="flex items-center justify-center text-slate-500 pt-10 text-sm">
                                    {browsingAll ? 'No hay nada que coincida.' : 'No hay archivos en esta carpeta.'}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {filteredPlaylists.map(playlist => {
                                const items = playlistItems(playlist);
                                return (
                                    <button
                                        key={playlist.id}
                                        type="button"
                                        className="group flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg text-left hover:border-indigo-500 hover:bg-slate-800/50 transition-colors"
                                        onClick={() => onSelect(playlist, 'playlist')}
                                    >
                                        <div className="w-20 aspect-video rounded-md overflow-hidden relative bg-indigo-500/10 shrink-0">
                                            {items[0] ? (
                                                <ContentThumb item={items[0]} className="absolute inset-0 w-full h-full" iconClassName="w-5 h-5" />
                                            ) : (
                                                <ListVideo className="absolute inset-0 m-auto w-6 h-6 text-indigo-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-slate-200 truncate">{playlist.name}</h4>
                                            <p className="text-xs text-slate-500">{items.length} {items.length === 1 ? 'elemento' : 'elementos'}</p>
                                        </div>
                                    </button>
                                );
                            })}

                            {filteredPlaylists.length === 0 && !isLoadingCampaigns && (
                                <div className="col-span-full flex items-center justify-center text-slate-500 pt-10 text-sm">
                                    No hay playlists creadas.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
