import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PlaySquare, Plus, Clock, MoreVertical, Trash2, Edit2, FileVideo, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

import { useDisplayCampaigns, useCreateCampaign, useDeleteCampaign } from "@/hooks/use-display-hub";

const DisplayPlaylists = () => {
    const navigate = useNavigate();
    const { commerceId } = useParams<{ commerceId: string }>();
    
    const effectiveCommerceId = commerceId || 'unknown';


    const { data: campaigns, isLoading } = useDisplayCampaigns(effectiveCommerceId);
    
    const createCampaign = useCreateCampaign();
    const deleteCampaign = useDeleteCampaign();


    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newCampaignData, setNewCampaignData] = useState({ name: '', description: '' });



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


    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-6 md:p-10 relative overflow-hidden text-foreground transition-colors duration-300">
            {/* Banner Superior */}
            <div className="max-w-7xl mx-auto">
                <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-xl flex items-center min-h-[140px] px-8 py-6 mb-8 transition-colors duration-300">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-background/20 to-secondary/10 pointer-events-none">
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-48 h-48 bg-secondary/10 rounded-full blur-[60px]"></div>
                        <div className="absolute right-32 bottom-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px]"></div>
                    </div>
                    
                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-6">
                        <div className="flex flex-col gap-1 w-full max-w-2xl">
                            <h1 className="text-3xl font-extrabold text-foreground flex items-center gap-3">
                                <PlaySquare className="w-8 h-8 text-primary" />
                                Tus Playlists
                            </h1>
                            <p className="text-muted-foreground font-medium max-w-xl mt-1">
                                Administrá y organizá el contenido que se reproducirá en tus pantallas.
                            </p>
                        </div>
                        <div className="shrink-0 flex items-center gap-3">
                            <Button variant="outline" onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace`)} className="bg-background/50 hover:bg-muted text-foreground border-border rounded-full px-6 py-5 shadow-sm">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver
                            </Button>
                            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 py-5 text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:scale-105">
                                <Plus className="w-4 h-4 mr-2" /> Crear Playlist
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Create Playlist Modal */}
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogContent className="bg-card border-border text-foreground">
                        <DialogHeader>
                            <DialogTitle>Nueva Playlist</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
                                Ingresá un nombre para tu nueva lista de reproducción.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateSubmit} className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-foreground">Nombre de la Playlist *</Label>
                                <Input 
                                    id="name" 
                                    value={newCampaignData.name} 
                                    onChange={e => setNewCampaignData({ ...newCampaignData, name: e.target.value })} 
                                    placeholder="Ej: Promociones de Verano"
                                    className="bg-background border-border text-foreground"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="desc" className="text-foreground">Descripción (Opcional)</Label>
                                <Input 
                                    id="desc" 
                                    value={newCampaignData.description} 
                                    onChange={e => setNewCampaignData({ ...newCampaignData, description: e.target.value })} 
                                    placeholder="Breve descripción del contenido"
                                    className="bg-background border-border text-foreground"
                                />
                            </div>
                            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 mt-2" disabled={createCampaign.isPending}>
                                {createCampaign.isPending ? 'Creando...' : 'Comenzar a Diseñar'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Grid of Playlists */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns?.map(campaign => {
                        let itemsCount = 0;

                        if (Array.isArray(campaign.items_json)) {
                            itemsCount = campaign.items_json.length;
                        } else if (campaign.items_json?.version === '2.0') {
                            const v2 = campaign.items_json as any;
                            const playlist = v2.zones?.[0]?.playlist || [];
                            itemsCount = playlist.length;
                        }
                        
                        return (
                            <div key={campaign.id} className="group bg-card border border-border rounded-2xl p-6 hover:border-primary/50 transition-all duration-300 flex flex-col shadow-sm hover:shadow-md">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                                            <PlaySquare className="w-6 h-6" />
                                        </div>
                                        <h3 className="font-bold text-lg text-foreground line-clamp-1">{campaign.name}</h3>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-muted -mr-2 -mt-2">
                                                <MoreVertical className="w-5 h-5" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="bg-card border-border text-foreground">
                                            <DropdownMenuItem asChild className="cursor-pointer hover:bg-accent">
                                                <Link to={`/admin/display/commerce/${effectiveCommerceId}/playlists/${campaign.id}`}>
                                                    <Edit2 className="w-4 h-4 mr-2" /> Editar
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => {
                                                if (window.confirm("¿Seguro que deseas eliminar esta playlist?")) {
                                                    deleteCampaign.mutate({ id: campaign.id }, {
                                                        onSuccess: () => toast.success("Playlist eliminada")
                                                    });
                                                }
                                            }} className="text-destructive focus:text-destructive cursor-pointer hover:bg-destructive/10">
                                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <p className="text-sm text-muted-foreground mb-6 line-clamp-2 min-h-[40px]">{campaign.description || 'Sin descripción'}</p>
                                
                                <div className="mt-auto pt-4 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <FileVideo className="w-4 h-4" />
                                        <span>{itemsCount} Elementos</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                <Button asChild className="w-full mt-4 bg-muted text-foreground hover:bg-primary hover:text-primary-foreground border-0 transition-colors">
                                    <Link to={`/admin/display/commerce/${effectiveCommerceId}/playlists/${campaign.id}`}>
                                        Abrir Playlist
                                    </Link>
                                </Button>
                            </div>
                        )
                    })}

                    {(!campaigns || campaigns.length === 0) && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-muted/30 rounded-2xl border border-dashed border-border">
                            <PlaySquare className="w-12 h-12 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-bold text-foreground">No tienes playlists</h3>
                            <p className="text-muted-foreground mt-2 text-center max-w-sm">
                                Creá tu primera playlist para empezar a mostrar contenido en tus pantallas.
                            </p>
                            <Button onClick={() => setIsCreateModalOpen(true)} className="mt-6">
                                Crear mi primera Playlist
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DisplayPlaylists;
