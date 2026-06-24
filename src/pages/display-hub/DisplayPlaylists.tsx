import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlaySquare, Plus, Clock, LayoutDashboard, MoreVertical, Trash2, Edit } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useCommerces, useDisplayCampaigns, useCreateCampaign, useDeleteCampaign } from "@/hooks/use-display-hub";

const DisplayPlaylists = () => {
    const navigate = useNavigate();
    const { commerceId } = useParams<{ commerceId: string }>();
    const isSuperAdmin = useIsSuperAdmin();
    
    const effectiveCommerceId = commerceId || 'unknown';

    const { data: commerces } = useCommerces();
    const { data: campaigns, isLoading } = useDisplayCampaigns(effectiveCommerceId);
    
    const createCampaign = useCreateCampaign();
    const deleteCampaign = useDeleteCampaign();

    const commerceProfile = commerces?.find(c => c.id === effectiveCommerceId);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCampaignData, setNewCampaignData] = useState({ name: '', description: '' });

    if (isSuperAdmin === false) {
        navigate('/admin', { replace: true });
        return null;
    }

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!newCampaignData.name.trim()) {
            toast.error('El nombre de la campaña es requerido');
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
                toast.success('Campaña creada');
                // Redirect to builder
                navigate(`/admin/display/commerce/${effectiveCommerceId}/playlists/${newCampaign.id}`);
            },
            onError: () => toast.error('Error al crear campaña')
        });
    };

    const handleDelete = (id: string, name: string) => {
        if (confirm(`¿Estás seguro de eliminar la playlist "${name}"? Esto detendrá la reproducción en todas las pantallas asignadas a ella.`)) {
            deleteCampaign.mutate({ id }, {
                onSuccess: () => toast.success('Playlist eliminada'),
                onError: () => toast.error('Error al eliminar')
            });
        }
    };

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative overflow-hidden text-slate-200">
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>

                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <PlaySquare className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">
                                    Playlists
                                </h1>
                                <p className="text-slate-400 text-sm">Crea listas de reproducción para {commerceProfile?.name}</p>
                            </div>
                        </div>
                    </div>

                    <Button onClick={() => setIsCreateModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                        <Plus className="w-4 h-4 mr-2" /> Crear Playlist
                    </Button>
                </header>

                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Nueva Playlist</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Una playlist es una lista de reproducción secuencial de diferentes contenidos.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-slate-300">Nombre de la Playlist *</Label>
                                <Input
                                    id="name"
                                    value={newCampaignData.name}
                                    onChange={(e) => setNewCampaignData({ ...newCampaignData, name: e.target.value })}
                                    placeholder="Ej: Promo Verano 2026"
                                    className="bg-slate-950 border-slate-700 text-white"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc" className="text-slate-300">Descripción (Opcional)</Label>
                                <Input
                                    id="desc"
                                    value={newCampaignData.description}
                                    onChange={(e) => setNewCampaignData({ ...newCampaignData, description: e.target.value })}
                                    placeholder="Breve descripción interna"
                                    className="bg-slate-950 border-slate-700 text-white"
                                />
                            </div>
                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2" disabled={createCampaign.isPending}>
                                {createCampaign.isPending ? 'Creando...' : 'Comenzar a Diseñar'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Campaigns List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                    {campaigns?.map(campaign => {
                        let totalDuration = 0;
                        let itemsCount = 0;

                        if (Array.isArray(campaign.items_json)) {
                            itemsCount = campaign.items_json.length;
                            totalDuration = campaign.items_json.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);
                        } else if (campaign.items_json?.version === '2.0') {
                            const v2 = campaign.items_json as any;
                            const playlist = v2.zones?.[0]?.playlist || [];
                            itemsCount = playlist.length;
                            totalDuration = playlist.reduce((acc: number, item: any) => acc + (item.duration || 0), 0);
                        }
                        
                        return (
                            <div key={campaign.id} className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/50 transition-all duration-300 flex flex-col">
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 bg-indigo-600/10 rounded-xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                                        <LayoutDashboard className="w-6 h-6" />
                                    </div>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white -mr-2 -mt-2">
                                                <MoreVertical className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-white">
                                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-slate-800">
                                                <Link to={`/admin/display/commerce/${effectiveCommerceId}/playlists/${campaign.id}`}>
                                                    <Edit className="w-4 h-4 mr-2" /> Editar Slides
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleDelete(campaign.id, campaign.name)} className="cursor-pointer text-rose-400 hover:bg-rose-900/20 hover:text-rose-300">
                                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Playlist
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                
                                <h3 className="text-xl font-bold text-white mb-1 line-clamp-1" title={campaign.name}>{campaign.name}</h3>
                                <p className="text-sm text-slate-500 mb-6 line-clamp-2 min-h-[40px]">{campaign.description || 'Sin descripción'}</p>
                                
                                <div className="mt-auto pt-4 border-t border-slate-800/80 flex items-center justify-between text-sm text-slate-400">
                                    <div className="flex items-center gap-1.5">
                                        <PlaySquare className="w-4 h-4" />
                                        <span>{itemsCount} slides</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4" />
                                        <span>{totalDuration} segs</span>
                                    </div>
                                </div>
                                
                                <Button asChild className="w-full mt-4 bg-slate-800 hover:bg-indigo-600 text-white border-0 transition-colors">
                                    <Link to={`/admin/display/commerce/${effectiveCommerceId}/playlists/${campaign.id}`}>
                                        Editar Contenido
                                    </Link>
                                </Button>
                            </div>
                        );
                    })}

                    {campaigns?.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
                            <PlaySquare className="w-12 h-12 text-slate-600 mb-4" />
                            <h3 className="text-xl font-bold text-white">No hay playlists</h3>
                            <p className="text-slate-400 mt-2 text-center max-w-sm">
                                Crea tu primera playlist para armar la lista de reproducción que se mostrará en los televisores de este comercio.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DisplayPlaylists;
