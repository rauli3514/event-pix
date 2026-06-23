import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Image as ImageIcon, Folder, PlaySquare, Settings2, Plus, LayoutGrid, List, Globe } from 'lucide-react';
import { useDisplayMedia } from '@/hooks/use-display-media';
import { useDisplayCampaigns } from '@/hooks/use-display-hub';
import { getIconForType } from '@/pages/display-hub/WorkspaceMedia';
import { DisplayMedia } from '@/types/display';

interface AssetSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (asset: any) => void;
}

export const AssetSelectorModal = ({ isOpen, onClose, onSelect }: AssetSelectorModalProps) => {
    const { commerceId } = useParams<{ commerceId: string }>();
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'archivos' | 'listas'>('archivos');
    const [selectedAsset, setSelectedAsset] = useState<any>(null);

    const { data: mediaFiles = [], isLoading: isLoadingMedia } = useDisplayMedia(commerceId);
    const { data: campaigns = [], isLoading: isLoadingCampaigns } = useDisplayCampaigns(commerceId);
    
    const isLoading = activeTab === 'archivos' ? isLoadingMedia : isLoadingCampaigns;

    const filteredAssets = useMemo(() => {
        if (activeTab === 'archivos') {
            return mediaFiles.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));
        } else {
            return campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => ({
                ...c,
                type: 'campaign',
                url: null,
                size_bytes: 0
            }));
        }
    }, [mediaFiles, campaigns, search, activeTab]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-5xl p-0 overflow-hidden sm:rounded-2xl h-[85vh] flex flex-col">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <Folder className="w-5 h-5 text-slate-500" />
                            Seleccionar Recurso
                        </DialogTitle>
                        <p className="text-sm text-slate-500 mt-1">Busca y selecciona un archivo o recurso para mostrar.</p>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel - Grid */}
                    <div className="flex-1 flex flex-col border-r border-slate-100 bg-slate-50/50">
                        {/* Toolbar */}
                        <div className="p-4 flex gap-3 items-center border-b border-slate-100 bg-white">
                            <div className="flex bg-slate-100 p-1 rounded-md">
                                <Button variant="ghost" size="sm" className={`h-8 px-4 ${activeTab === 'archivos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => { setActiveTab('archivos'); setSelectedAsset(null); }}>Archivos</Button>
                                <Button variant="ghost" size="sm" className={`h-8 px-4 ${activeTab === 'listas' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => { setActiveTab('listas'); setSelectedAsset(null); }}>Listas de Reproducción</Button>
                            </div>
                            
                            <div className="flex-1 relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <Input 
                                    placeholder="Buscar recursos..." 
                                    className="pl-9 h-9 shadow-sm"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-1">
                                <Button variant="outline" size="icon" className="h-9 w-9"><Settings2 className="w-4 h-4" /></Button>
                                <div className="w-px h-9 bg-slate-200 mx-1" />
                                <Button variant="outline" size="icon" className="h-9 w-9 bg-slate-100"><LayoutGrid className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400"><List className="w-4 h-4" /></Button>
                            </div>

                            <Button className="h-9 bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm ml-2">
                                <Plus className="w-4 h-4 mr-1" /> Crear
                            </Button>
                        </div>

                        {/* Grid Area */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="mb-4">
                                <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                                    Inicio
                                </h3>
                            </div>
                            
                            <div className="mb-4 flex items-center text-xs font-semibold text-slate-500 gap-1">
                                <ChevronDownIcon className="w-4 h-4" />
                                {activeTab === 'archivos' ? 'Archivos / Recursos' : 'Listas de Reproducción'} ({filteredAssets.length})
                            </div>

                            {isLoading ? (
                                <div className="flex justify-center items-center h-32 text-slate-500">Cargando recursos...</div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {filteredAssets.map(asset => {
                                        const FileIcon = getIconForType(asset.type);
                                        return (
                                        <div 
                                            key={asset.id} 
                                            onClick={() => setSelectedAsset(asset)}
                                            className={`bg-white rounded-xl border ${selectedAsset?.id === asset.id ? 'border-emerald-500 ring-1 ring-emerald-500 shadow-md' : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'} overflow-hidden cursor-pointer transition-all flex flex-col group`}
                                        >
                                            <div className="aspect-video bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                                {asset.type === 'image' && asset.url ? (
                                                    <img src={asset.url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                ) : (
                                                    <FileIcon className="w-10 h-10 text-slate-300" />
                                                )}
                                                
                                                {asset.type === 'video' && (
                                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                        <PlaySquare className="w-8 h-8 text-white opacity-80" />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 flex items-center gap-2">
                                                <FileIcon className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-sm font-medium text-slate-700 truncate" title={asset.name}>{asset.name}</span>
                                            </div>
                                        </div>
                                    )})}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Panel - Preview */}
                    <div className="w-80 bg-white flex flex-col">
                        {selectedAsset ? (
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b border-slate-100">
                                    <h3 className="font-bold text-slate-800 text-lg truncate" title={selectedAsset.name}>{selectedAsset.name}</h3>
                                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                        <Folder className="w-3.5 h-3.5" /> Medios
                                    </p>
                                </div>
                                <div className="p-6 flex-1 flex flex-col items-center">
                                    <div className="w-full aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shadow-sm mb-6 flex justify-center items-center">
                                        {selectedAsset.type === 'image' && selectedAsset.url ? (
                                            <img src={selectedAsset.url} alt={selectedAsset.name} className="w-full h-full object-contain" />
                                        ) : selectedAsset.type === 'video' && selectedAsset.url ? (
                                            <video src={selectedAsset.url} className="w-full h-full object-contain bg-black" controls />
                                        ) : selectedAsset.type === 'campaign' ? (
                                            <div className="text-emerald-500 flex flex-col items-center">
                                                <PlaySquare className="w-16 h-16 mb-2" />
                                                <span className="text-sm font-medium">Lista de Reproducción</span>
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 flex flex-col items-center">
                                                <Globe className="w-12 h-12 mb-2" />
                                                <span className="text-sm">Vista no disponible</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="w-full space-y-4">
                                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                                            <div className="text-slate-500">Tipo</div>
                                            <div className="font-medium text-slate-800 capitalize">{selectedAsset.type === 'campaign' ? 'Lista de Rep.' : selectedAsset.type}</div>
                                            
                                            <div className="text-slate-500">Añadido</div>
                                            <div className="font-medium text-slate-800">
                                                {new Date(selectedAsset.created_at).toLocaleDateString('es-ES')}
                                            </div>
                                            
                                            <div className="text-slate-500">Tamaño/Duración</div>
                                            <div className="font-medium text-slate-800">
                                                {selectedAsset.type === 'campaign' ? 
                                                    `${selectedAsset.items_json?.length || 0} items` : 
                                                    formatBytes(selectedAsset.size_bytes)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                                <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                    <ImageIcon className="w-8 h-8 text-slate-300" />
                                </div>
                                <h3 className="font-medium text-slate-700 mb-1">Ningún recurso seleccionado</h3>
                                <p className="text-sm text-slate-400">Haz clic en un recurso para ver su vista previa aquí.</p>
                            </div>
                        )}
                        
                        <div className="p-4 border-t border-slate-100 bg-slate-50 mt-auto flex justify-end">
                            <Button 
                                onClick={() => {
                                    if (selectedAsset) {
                                        onSelect({
                                            id: selectedAsset.id,
                                            type: selectedAsset.type,
                                            content: selectedAsset.url,
                                            name: selectedAsset.name
                                        });
                                        onClose();
                                    }
                                }}
                                disabled={!selectedAsset}
                                className="bg-emerald-400 hover:bg-emerald-500 text-white w-full shadow-sm"
                            >
                                Seleccionar
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// Helper for the small arrow icon
function ChevronDownIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    );
}
