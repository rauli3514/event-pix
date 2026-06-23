import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Monitor, Activity, Tv, Plus, Hash, FolderOpen, PlaySquare, Eye, ChevronDown, MoreVertical, Edit2, Info, Move, Trash2, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { EditScreenModal } from "@/components/display/EditScreenModal";

import { toast } from 'sonner';

import { useDisplayDevices, useLinkDevice, useDisplayGroups, useDisplayCampaigns, useUpdateDisplayDevice, useAssignContentToDevice } from "@/hooks/use-display-hub";
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

const DisplayHubList = () => {
    const { commerceId } = useParams<{ commerceId: string }>();
    
    // States for linking
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkData, setLinkData] = useState({ device_code: '', name: '', description: '', group_id: 'none' });
    
    // States for filtering
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [groupFilter, setGroupFilter] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<any>(null);

    const effectiveCommerceId = commerceId || 'unknown';

    // Data Fetching
    const { data: devices, isLoading } = useDisplayDevices(effectiveCommerceId);
    const { data: linkGroups } = useDisplayGroups(effectiveCommerceId);
    const { data: campaigns } = useDisplayCampaigns(effectiveCommerceId);
    const linkDevice = useLinkDevice();
    const updateDevice = useUpdateDisplayDevice();
    const assignContent = useAssignContentToDevice();
    const queryClient = useQueryClient();

    // Preview state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<any>(null);

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];
    const activeCampaignsCount = campaigns?.length || 0; // Using total campaigns for now

    const handleLinkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!linkData.device_code.trim()) {
            toast.error('Debes ingresar el código de la TV');
            return;
        }

        linkDevice.mutate({ 
            device_code: linkData.device_code.trim(), 
            name: linkData.name, 
            description: linkData.description,
            commerce_id: effectiveCommerceId,
            group_id: linkData.group_id === 'none' ? undefined : linkData.group_id
        }, {
            onSuccess: () => {
                setIsLinkModalOpen(false);
                setLinkData({ device_code: '', name: '', description: '', group_id: 'none' });
                toast.success('¡Pantalla vinculada exitosamente!');
            },
            onError: (error: any) => {
                toast.error(error.message || 'Error al vincular pantalla');
            }
        });
    };

    const handleDeleteDevice = async (deviceId: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta pantalla?')) return;
        const { error } = await supabase.from('display_devices').delete().eq('id', deviceId);
        if (error) {
            toast.error('Error al eliminar pantalla');
        } else {
            toast.success('Pantalla eliminada');
            queryClient.invalidateQueries({ queryKey: ["display_devices"] });
        }
    };

    const filteredLinkedDevices = linkedDevices.filter(device => {
        const matchesStatus = filter === 'all' 
            ? true 
            : filter === 'online' ? device.derived_status === 'online' : device.derived_status === 'offline';
        const matchesGroup = groupFilter === 'all' ? true : device.group_id === groupFilter;
        const searchLower = search.toLowerCase();
        const matchesSearch = (device.name?.toLowerCase().includes(searchLower)) || 
                              (device.device_id.toLowerCase().includes(searchLower));
        return matchesStatus && matchesGroup && matchesSearch;
    });

    const onlineCount = linkedDevices.filter(d => d.derived_status === 'online').length;
    const offlineCount = linkedDevices.filter(d => d.derived_status === 'offline').length;

    if (isLoading) return (
        <div className="h-full flex items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 animate-pulse">Cargando pantallas...</p>
            </div>
        </div>
    );

    return (
        <div className="p-6 md:p-8 space-y-6">
            
            {/* Header: Resumen General */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Tus Pantallas</h1>
                    <p className="text-slate-400 text-sm">Administra los dispositivos y el contenido que reproducen.</p>
                </div>
                <Button onClick={() => setIsLinkModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                    <Plus className="w-4 h-4 mr-2" /> Agregar Pantalla
                </Button>
            </div>

            {/* Metrics Top Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Tv className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 font-medium">Totales</p>
                        <p className="text-2xl font-bold text-white">{linkedDevices.length}</p>
                    </div>
                </div>
                <div className="bg-slate-900 border border-emerald-900/50 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Activity className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 font-medium">Online / Offline</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-bold text-emerald-400">{onlineCount}</p>
                            <span className="text-slate-500">/</span>
                            <p className="text-lg font-bold text-rose-400">{offlineCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                        <FolderOpen className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 font-medium">Archivos</p>
                        <p className="text-2xl font-bold text-white">0</p>
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                        <PlaySquare className="w-6 h-6 text-purple-400" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-400 font-medium">Playlists Activas</p>
                        <p className="text-2xl font-bold text-white">{activeCampaignsCount}</p>
                    </div>
                </div>
            </div>

            {/* Modal de Vinculación */}
            <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
                <DialogContent className="bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Vincular Nueva Pantalla</DialogTitle>
                        <DialogDescription className="text-slate-400">
                            Abre la aplicación de EventPix en la TV para obtener el código.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLinkSubmit} className="space-y-4 mt-2">
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                            <Label htmlFor="code" className="text-slate-300 font-bold">1. Código de Vinculación *</Label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                                <Input
                                    id="code"
                                    value={linkData.device_code}
                                    onChange={(e) => setLinkData({ ...linkData, device_code: e.target.value.toUpperCase() })}
                                    placeholder="Ej: MX9-K7P2A"
                                    className="pl-9 bg-slate-900 border-indigo-500/50 text-white font-mono uppercase tracking-widest text-lg h-12"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2 pt-2">
                            <Label htmlFor="name" className="text-slate-300">2. Nombre *</Label>
                            <Input
                                id="name"
                                value={linkData.name}
                                onChange={(e) => setLinkData({ ...linkData, name: e.target.value })}
                                placeholder="Ej: TV Salón Principal"
                                className="bg-slate-950 border-slate-700 text-white"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="group" className="text-slate-300">3. Grupo (Opcional)</Label>
                            <Select value={linkData.group_id} onValueChange={(val) => setLinkData({ ...linkData, group_id: val })}>
                                <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                    <SelectValue placeholder="Ninguna zona..." />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                    <SelectItem value="none">Sin Grupo</SelectItem>
                                    {linkGroups?.map(g => (
                                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2 h-12 text-lg" disabled={linkDevice.isPending}>
                            {linkDevice.isPending ? 'Vinculando...' : 'Vincular Pantalla'}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mt-8">
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 w-full sm:w-auto">
                        <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Todas</button>
                        <button onClick={() => setFilter('online')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'online' ? 'bg-emerald-900/40 text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`}>Online</button>
                        <button onClick={() => setFilter('offline')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'offline' ? 'bg-rose-900/40 text-rose-400' : 'text-slate-400 hover:text-rose-400'}`}>Offline</button>
                    </div>

                    <div className="w-full sm:w-48">
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="w-full bg-slate-900 border-slate-800 text-white h-10">
                                <SelectValue placeholder="Filtrar por Zona..." />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                <SelectItem value="all">Todas las Zonas</SelectItem>
                                {linkGroups?.map(g => (
                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="w-full sm:w-72">
                    <Input 
                        placeholder="Buscar pantalla..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-white w-full h-10"
                    />
                </div>
            </div>

            {/* Lista de Pantallas */}
            <div className="mt-8 space-y-8">
                {Object.entries(
                    filteredLinkedDevices.reduce((acc, device) => {
                        const groupName = device.group?.name || 'Sin Zona Asignada';
                        if (!acc[groupName]) acc[groupName] = [];
                        acc[groupName].push(device);
                        return acc;
                    }, {} as Record<string, typeof filteredLinkedDevices>)
                ).map(([groupName, groupDevices]) => (
                    <div key={groupName} className="space-y-3">
                        <div className="flex items-center gap-2 text-slate-300 font-semibold px-2">
                            <ChevronDown className="w-4 h-4" />
                            {groupName} <span className="text-slate-500 font-normal text-sm ml-1">({groupDevices.length})</span>
                        </div>
                        
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/50">
                            {groupDevices.map(device => {
                                const isOnline = device.derived_status === 'online';
                                return (
                                    <div key={device.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 hover:bg-slate-800/30 transition-colors group gap-4 sm:gap-0">
                                        {/* Izquierda: Checkbox, Estado y Nombre */}
                                        <div className="flex items-center gap-4">
                                            <input type="checkbox" className="w-4.5 h-4.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500/20" />
                                            
                                            <div className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 w-[110px] justify-center ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
                                                {isOnline && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                                {isOnline ? 'En línea' : 'Desconectado'}
                                            </div>
                                            
                                            <div>
                                                <h4 className="font-semibold text-slate-200 cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}>
                                                    {device.name}
                                                </h4>
                                                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                    Recurso: <span className="text-slate-400">
                                                        {device.assignment?.media?.name || device.assignment?.campaign?.name || 'Sin asignar'}
                                                    </span>
                                                    <ChevronDown className="w-3 h-3" />
                                                </p>
                                            </div>
                                        </div>

                                        {/* Derecha: Botones de Acción */}
                                        <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity w-full sm:w-auto justify-end">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                                                onClick={() => { setPreviewDevice(device); setPreviewModalOpen(true); }}
                                            >
                                                <Eye className="w-3.5 h-3.5 mr-1.5" /> Avance
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
                                                onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}
                                            >
                                                <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
                                            </Button>
                                            
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-56 bg-white text-slate-800 border-0 shadow-xl rounded-xl">
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100" onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}>
                                                        <Info className="w-4 h-4 mr-2 text-slate-500" /> Ver información del dispositivo
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Monitor className="w-4 h-4 mr-2 text-slate-500" /> Pantalla de identificación
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Move className="w-4 h-4 mr-2 text-slate-500" /> Mover
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="cursor-pointer py-2 focus:bg-slate-100">
                                                        <Power className="w-4 h-4 mr-2 text-slate-500" /> Trasladar a espera
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator className="bg-slate-100" />
                                                    <DropdownMenuItem className="cursor-pointer py-2 text-rose-600 focus:bg-rose-50 focus:text-rose-700" onClick={() => handleDeleteDevice(device.id)}>
                                                        <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                
                {filteredLinkedDevices.length === 0 && (
                    <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                        <Monitor className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white">No se encontraron pantallas</h3>
                        <p className="text-slate-400 text-sm mt-2">Prueba cambiando los filtros o agrega una nueva pantalla.</p>
                    </div>
                )}
            </div>

            <EditScreenModal 
                isOpen={editModalOpen} 
                onClose={() => setEditModalOpen(false)} 
                device={selectedDevice}
                linkGroups={linkGroups || []}
                onSave={(id, updates, assetId) => {
                    updateDevice.mutate({ id, updates }, {
                        onSuccess: () => {
                            if (assetId !== undefined) {
                                assignContent.mutate({ deviceId: id, mediaId: assetId }, {
                                    onSuccess: () => {
                                        toast.success('Pantalla y contenido actualizados');
                                        setEditModalOpen(false);
                                    }
                                });
                            } else {
                                toast.success('Pantalla actualizada');
                                setEditModalOpen(false);
                            }
                        }
                    });
                }}
            />

            <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
                <DialogContent className="bg-slate-950 border-slate-800 text-white shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-2xl h-[80vh] flex flex-col">
                    <DialogHeader className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex flex-row items-center justify-between shrink-0">
                        <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                            <Eye className="w-5 h-5 text-indigo-400" />
                            Vista Previa: {previewDevice?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                        {previewDevice?.assignment?.media ? (
                            previewDevice.assignment.media.type.startsWith('video/') ? (
                                <video 
                                    src={previewDevice.assignment.media.url} 
                                    controls 
                                    autoPlay 
                                    loop 
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <img 
                                    src={previewDevice.assignment.media.url} 
                                    alt="Preview" 
                                    className="max-w-full max-h-full object-contain"
                                />
                            )
                        ) : previewDevice?.assignment?.campaign ? (
                            <div className="text-slate-400 text-center">
                                <Monitor className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                <p className="text-lg">Reproduciendo Lista: {previewDevice.assignment.campaign.name}</p>
                                <p className="text-sm mt-2 opacity-70">La vista previa de listas completas estará disponible pronto.</p>
                            </div>
                        ) : (
                            <div className="text-slate-500 text-center">
                                <Monitor className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p>Esta pantalla no tiene ningún recurso asignado.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default DisplayHubList;
