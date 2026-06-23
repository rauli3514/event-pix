import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Monitor, Activity, Tv, Plus, Hash, FolderOpen, PlaySquare, Settings, RotateCcw, Calendar, Play, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

import { useDisplayDevices, useLinkDevice, useDisplayGroups, useDisplayCampaigns } from "@/hooks/use-display-hub";

const DisplayHubList = () => {
    const { commerceId } = useParams<{ commerceId: string }>();
    
    // States for linking
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkData, setLinkData] = useState({ device_code: '', name: '', description: '', group_id: 'none' });
    
    // States for filtering
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [search, setSearch] = useState('');

    const effectiveCommerceId = commerceId || 'unknown';

    // Data Fetching
    const { data: devices, isLoading } = useDisplayDevices(effectiveCommerceId);
    const { data: linkGroups } = useDisplayGroups(effectiveCommerceId);
    const { data: campaigns } = useDisplayCampaigns(effectiveCommerceId);
    const linkDevice = useLinkDevice();

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

    const filteredLinkedDevices = linkedDevices.filter(device => {
        const matchesFilter = filter === 'all' 
            ? true 
            : filter === 'online' ? device.derived_status === 'online' : device.derived_status === 'offline';
        const searchLower = search.toLowerCase();
        const matchesSearch = (device.name?.toLowerCase().includes(searchLower)) || 
                              (device.device_id.toLowerCase().includes(searchLower));
        return matchesFilter && matchesSearch;
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
                <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 w-full sm:w-auto">
                    <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Todas</button>
                    <button onClick={() => setFilter('online')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'online' ? 'bg-emerald-900/40 text-emerald-400' : 'text-slate-400 hover:text-emerald-400'}`}>Online</button>
                    <button onClick={() => setFilter('offline')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'offline' ? 'bg-rose-900/40 text-rose-400' : 'text-slate-400 hover:text-rose-400'}`}>Offline</button>
                </div>
                <div className="w-full sm:w-72">
                    <Input 
                        placeholder="Buscar pantalla..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-white w-full"
                    />
                </div>
            </div>

            {/* Tarjetas de Pantallas */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pt-2">
                {filteredLinkedDevices.map(device => {
                    const isOnline = device.derived_status === 'online';
                    
                    return (
                        <div key={device.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden flex flex-col transition-all group">
                            
                            {/* Card Header (Preview Mockup) */}
                            <div className="h-32 bg-slate-950 relative border-b border-slate-800/50 flex items-center justify-center overflow-hidden">
                                <div className="absolute top-3 left-3 flex items-center gap-2">
                                    <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </div>
                                </div>
                                <div className="absolute top-3 right-3">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white bg-slate-900/50 backdrop-blur-sm" title="Vista Previa">
                                        <Eye className="w-4 h-4" />
                                    </Button>
                                </div>
                                {/* Thumbnail Placeholder */}
                                <div className="flex flex-col items-center opacity-50 group-hover:opacity-100 transition-opacity">
                                    <PlaySquare className="w-10 h-10 text-slate-600" />
                                    <span className="text-xs text-slate-500 mt-2 font-medium">Contenido Actual</span>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="p-5 flex-1 flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-white group-hover:text-indigo-400 transition-colors line-clamp-1">{device.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-slate-500 font-mono">ID: {device.device_id}</span>
                                            {device.group && (
                                                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">
                                                    {device.group.name}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-sm text-slate-400 mb-4 bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-slate-500 text-xs">Playlist Actual</span>
                                    </div>
                                    <div className="font-medium text-white line-clamp-1">
                                        No hay contenido asignado
                                    </div>
                                </div>

                                <div className="mt-auto pt-2 grid grid-cols-2 gap-2">
                                    <Button variant="secondary" size="sm" className="w-full bg-slate-800 hover:bg-slate-700 text-white border-none" onClick={() => toast.info('Función en desarrollo: Cambiar Playlist')}>
                                        <Play className="w-3.5 h-3.5 mr-2" /> Asignar
                                    </Button>
                                    <Button variant="secondary" size="sm" className="w-full bg-slate-800 hover:bg-slate-700 text-white border-none" onClick={() => toast.info('Función en desarrollo: Programar Horarios')}>
                                        <Calendar className="w-3.5 h-3.5 mr-2" /> Horarios
                                    </Button>
                                    <Button variant="secondary" size="sm" className="w-full bg-slate-800 hover:bg-slate-700 text-white border-none" onClick={() => toast.info('Función en desarrollo: Reiniciar Reproductor')}>
                                        <RotateCcw className="w-3.5 h-3.5 mr-2" /> Reiniciar
                                    </Button>
                                    <Button asChild variant="secondary" size="sm" className="w-full bg-slate-800 hover:bg-slate-700 text-white border-none">
                                        <Link to={`/admin/display/${device.id}`}>
                                            <Settings className="w-3.5 h-3.5 mr-2" /> Ajustes
                                        </Link>
                                    </Button>
                                </div>
                            </div>

                        </div>
                    );
                })}

                {filteredLinkedDevices.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                        <Monitor className="w-16 h-16 text-slate-700 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">No tienes pantallas conectadas</h3>
                        <p className="text-slate-400 text-center max-w-md mb-6">
                            Descarga la aplicación EventPix en tu TV, anota el código de 6 dígitos y presiona "Agregar Pantalla" para comenzar.
                        </p>
                        <Button onClick={() => setIsLinkModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                            <Plus className="w-4 h-4 mr-2" /> Agregar Pantalla
                        </Button>
                    </div>
                )}
            </div>

        </div>
    );
};

export default DisplayHubList;
