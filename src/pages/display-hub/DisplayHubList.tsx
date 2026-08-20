import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Monitor, Plus, Hash, Eye, ChevronDown, MoreVertical, Edit2, Info, Move, Trash2, Play, Bluetooth } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { EditScreenModal } from "@/components/display/EditScreenModal";
import { ZoneManagerSidebar } from "@/components/display/ZoneManagerSidebar";
import { MoveDeviceModal } from "@/components/display/MoveDeviceModal";
import { BluetoothProvisioningModal } from "@/components/display/BluetoothProvisioningModal";
import { Layers } from 'lucide-react';
import { useEffect } from 'react';

import { toast } from 'sonner';

import { useDisplayDevices, useLinkDevice, useDisplayGroups, useUpdateDisplayDevice, useAssignContentToDevice } from "@/hooks/use-display-hub";
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { DisplayDevice } from '@/types/display';

const DisplayHubList = () => {
    const { commerceId } = useParams<{ commerceId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    const urlCode = searchParams.get('code') || searchParams.get('bt')?.replace('EventPix-TV-', '');
    
    // States for linking
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [isBluetoothModalOpen, setIsBluetoothModalOpen] = useState(!!urlCode);
    const [initialDeviceCode, setInitialDeviceCode] = useState<string | undefined>(urlCode || undefined);
    
    useEffect(() => {
        if (urlCode) {
            setInitialDeviceCode(urlCode);
            setIsBluetoothModalOpen(true);
        }
    }, [urlCode]);
    const [linkData, setLinkData] = useState({ device_code: '', name: '', description: '', group_id: 'none', orientation: 'landscape' as 'landscape' | 'portrait' });
    
    // States for filtering & sidebar
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [search, setSearch] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string | 'all' | 'unassigned'>('all');
    
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<any>(null);

    const effectiveCommerceId = commerceId || 'unknown';

    // Data Fetching
    const { data: devices, isLoading } = useDisplayDevices(effectiveCommerceId);
    const { data: linkGroups } = useDisplayGroups(effectiveCommerceId);
    const linkDevice = useLinkDevice();
    const updateDevice = useUpdateDisplayDevice();
    const assignContent = useAssignContentToDevice();
    const queryClient = useQueryClient();

    // Preview state
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<any>(null);

    // Move Device state
    const [moveDeviceModalOpen, setMoveDeviceModalOpen] = useState(false);
    const [moveDeviceTarget, setMoveDeviceTarget] = useState<DisplayDevice | null>(null);

    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];
    
    const unassignedCount = linkedDevices.filter(d => !d.group_id).length;

    const handleLinkSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!linkData.device_code.trim()) {
            toast.error('Debes ingresar el código de la TV');
            return;
        }

        // Si estamos adentro de una zona, pre-asignarla
        const targetGroup = linkData.group_id !== 'none' 
            ? linkData.group_id 
            : (selectedGroupId !== 'all' && selectedGroupId !== 'unassigned' ? selectedGroupId : undefined);

        linkDevice.mutate({ 
            device_code: linkData.device_code.trim(), 
            name: linkData.name, 
            description: linkData.description,
            orientation: linkData.orientation,
            commerce_id: effectiveCommerceId,
            group_id: targetGroup || undefined
        }, {
            onSuccess: () => {
                setIsLinkModalOpen(false);
                setLinkData({ device_code: '', name: '', description: '', group_id: 'none', orientation: 'landscape' });
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
        // Status filter
        const matchesStatus = filter === 'all' 
            ? true 
            : filter === 'online' ? device.derived_status === 'online' : device.derived_status === 'offline';
        
        // Group filter
        let matchesGroup = true;
        if (selectedGroupId === 'unassigned') matchesGroup = !device.group_id;
        else if (selectedGroupId !== 'all') {
            // Include devices in this group OR sub-groups. For simplicity, just exact match or build tree logic.
            // A more advanced version would check if device.group_id is a descendant.
            matchesGroup = device.group_id === selectedGroupId;
        }
        
        // Search filter
        const searchLower = search.toLowerCase();
        const matchesSearch = (device.name?.toLowerCase().includes(searchLower)) || 
                              (device.device_id.toLowerCase().includes(searchLower));
                              
        return matchesStatus && matchesGroup && matchesSearch;
    });


    if (isLoading) return (
        <div className="h-full flex items-center justify-center bg-background text-foreground">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-muted-foreground animate-pulse">Cargando pantallas...</p>
            </div>
        </div>
    );

    return (
        <div className="flex h-full w-full min-h-0 overflow-hidden bg-background text-foreground flex-col transition-colors duration-300">
            {/* Descriptive Top Banner */}
            <div className="p-4 sm:p-6 md:px-8 pt-4 sm:pt-6 pb-2 shrink-0">
                <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-card border border-border shadow-xl flex items-center px-4 py-4 sm:px-8 sm:py-6 transition-colors duration-300">
                    {/* Decorative Background for Banner */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-background/20 to-secondary/10 pointer-events-none">
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px]"></div>
                        <div className="absolute right-32 bottom-0 w-32 h-32 bg-sky-500/10 rounded-full blur-[40px]"></div>
                    </div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between w-full gap-4 sm:gap-6">
                        <div className="flex flex-col gap-1 w-full max-w-2xl">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-3">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" size="icon" className="lg:hidden border-border bg-muted/50 text-muted-foreground w-9 h-9 shrink-0 hover:text-foreground">
                                            <Layers className="w-4 h-4" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="left" className="p-0 bg-card border-r-border w-72 flex flex-col transition-colors duration-300">
                                        <SheetTitle className="sr-only">Zonas y Pantallas</SheetTitle>
                                        <ZoneManagerSidebar 
                                            commerceId={effectiveCommerceId}
                                            groups={linkGroups || []}
                                            selectedGroupId={selectedGroupId}
                                            onSelectGroup={setSelectedGroupId}
                                            unassignedCount={unassignedCount}
                                            totalCount={linkedDevices.length}
                                        />
                                    </SheetContent>
                                </Sheet>
                                Tus Pantallas
                            </h1>
                            <p className="text-muted-foreground font-medium max-w-xl mt-1">
                                Administrá los dispositivos y el contenido que reproducen, agrupándolos en zonas para un mayor control.
                            </p>
                        </div>
                        
                        <div className="shrink-0 flex flex-wrap items-center gap-2 sm:gap-3">
                            <Button variant="outline" className="border-border text-foreground hover:bg-muted rounded-full px-4 py-2 sm:px-5 sm:py-5 text-xs sm:text-sm font-bold shadow-sm transition-all" onClick={() => setIsBluetoothModalOpen(true)}>
                                <Bluetooth className="w-4 h-4 mr-1.5 sm:mr-2 text-blue-500" /> Configurar por Bluetooth
                            </Button>
                            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 py-2 sm:px-6 sm:py-5 text-xs sm:text-sm font-bold shadow-lg shadow-primary/10 transition-all hover:scale-105" onClick={() => setIsLinkModalOpen(true)}>
                                <Plus className="w-4 h-4 mr-1.5 sm:mr-2" /> Agregar Pantalla
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area: Sidebar + Grid */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar de Zonas (Desktop > 1024px) */}
                <div className="hidden lg:block shrink-0 h-full">
                    <ZoneManagerSidebar 
                        commerceId={effectiveCommerceId}
                        groups={linkGroups || []}
                        selectedGroupId={selectedGroupId}
                        onSelectGroup={setSelectedGroupId}
                        unassignedCount={unassignedCount}
                        totalCount={linkedDevices.length}
                    />
                </div>

                {/* Contenido Principal */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:px-8 bg-background min-w-0">
                    {/* Filters & Search */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <div className="flex bg-muted border border-border rounded-lg p-1 w-full sm:w-auto">
                            <button onClick={() => setFilter('all')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Todas</button>
                            <button onClick={() => setFilter('online')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'online' ? 'bg-emerald-500/10 text-emerald-600' : 'text-muted-foreground hover:text-emerald-500'}`}>Online</button>
                            <button onClick={() => setFilter('offline')} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'offline' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:text-destructive'}`}>Offline</button>
                        </div>
                    </div>
                    
                    <div className="w-full sm:w-72">
                        <Input 
                            placeholder="Buscar pantalla..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-card border-border text-foreground w-full h-10 shadow-sm"
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
                            <div className="flex items-center gap-2 text-foreground font-semibold px-2">
                                <ChevronDown className="w-4 h-4" />
                                {groupName} <span className="text-muted-foreground font-normal text-sm ml-1">({groupDevices.length})</span>
                            </div>
                            
                            <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border shadow-sm">
                                {groupDevices.map(device => {
                                    const isOnline = device.derived_status === 'online';
                                    return (
                                        <div key={device.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-3 sm:p-4 hover:bg-muted/50 transition-colors group gap-3 md:gap-4 min-w-0 w-full">
                                            {/* Izquierda: Checkbox, Estado y Nombre */}
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0 flex-1">
                                                <input type="checkbox" className="w-4.5 h-4.5 rounded border-border bg-background text-emerald-500 focus:ring-emerald-500/20 shrink-0" />
                                                
                                                <div className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 shrink-0 ${isOnline ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                                                    {isOnline && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                                                    {isOnline ? 'En línea' : 'Desconectado'}
                                                </div>
                                                
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-semibold text-foreground cursor-pointer hover:text-primary transition-colors truncate" onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}>
                                                        {device.name}
                                                    </h4>
                                                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                                                        Recurso: <span className="text-muted-foreground font-medium truncate">
                                                            {device.assignment?.schedule?.name || device.assignment?.media?.name || device.assignment?.campaign?.name || 'Sin asignar'}
                                                        </span>
                                                        <ChevronDown className="w-3 h-3 shrink-0" />
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Derecha: Botones de Acción */}
                                            <div className="flex items-center gap-2 opacity-100 sm:opacity-70 group-hover:opacity-100 transition-opacity w-full md:w-auto justify-start md:justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                                    onClick={() => { setPreviewDevice(device); setPreviewModalOpen(true); }}
                                                >
                                                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Avance
                                                </Button>
                                                <Button 
                                                    variant="outline" 
                                                    size="sm" 
                                                    className="h-8 bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                                                    onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Editar
                                                </Button>
                                                
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-56 bg-card text-foreground border border-border shadow-xl rounded-xl">
                                                        <DropdownMenuItem className="cursor-pointer py-2 focus:bg-accent focus:text-accent-foreground" onClick={() => { setSelectedDevice(device); setEditModalOpen(true); }}>
                                                            <Info className="w-4 h-4 mr-2 text-muted-foreground" /> Ver información del dispositivo
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="cursor-pointer py-2 focus:bg-accent focus:text-accent-foreground" onClick={() => navigate(`/admin/display/${device.id}`)}>
                                                            <Monitor className="w-4 h-4 mr-2 text-muted-foreground" /> Rendimiento y Diagnóstico
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-border" />
                                                        <DropdownMenuItem className="cursor-pointer py-2 focus:bg-accent focus:text-accent-foreground" onClick={() => { setMoveDeviceTarget(device); setMoveDeviceModalOpen(true); }}>
                                                            <Move className="w-4 h-4 mr-2 text-muted-foreground" /> Mover
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator className="bg-border" />
                                                        <DropdownMenuItem className="cursor-pointer py-2 text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleDeleteDevice(device.id)}>
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
                        <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl bg-card/50">
                            <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-bold text-foreground">No se encontraron pantallas</h3>
                            <p className="text-muted-foreground text-sm mt-2">Prueba cambiando los filtros o agrega una nueva pantalla.</p>
                        </div>
                    )}
                </div>

                {/* Modal de Vinculación */}
                <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
                    <DialogContent className="sm:max-w-[700px] bg-card border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[100dvh] sm:max-h-[90vh]">
                        <div className="p-4 sm:p-6 border-b border-border bg-muted/30 shrink-0">
                            <DialogTitle className="text-xl">Vincular Nueva Pantalla</DialogTitle>
                            <DialogDescription className="text-muted-foreground mt-1">
                                Abre la aplicación de EventPix en la TV para obtener el código.
                            </DialogDescription>
                        </div>
                        <div className="overflow-y-auto flex-1">
                            <form id="link-device-form" onSubmit={handleLinkSubmit} className="flex flex-col md:flex-row h-full">
                                {/* Left Side: Basic Info */}
                                <div className="flex-1 p-4 sm:p-6 space-y-5 border-b md:border-b-0 md:border-r border-border">
                                    <div className="space-y-2">
                                        <Label htmlFor="code" className="text-foreground font-bold">1. Código de Vinculación *</Label>
                                        <div className="relative">
                                            <Hash className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                id="code"
                                                value={linkData.device_code}
                                                onChange={(e) => setLinkData({ ...linkData, device_code: e.target.value.toUpperCase() })}
                                                placeholder="Ej: MX9-K7P2A"
                                                className="pl-9 bg-background border-primary/50 text-foreground font-mono uppercase tracking-widest text-lg h-11 focus-visible:ring-primary"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="name" className="text-foreground font-bold">2. Nombre *</Label>
                                        <Input
                                            id="name"
                                            value={linkData.name}
                                            onChange={(e) => setLinkData({ ...linkData, name: e.target.value })}
                                            placeholder="Ej: TV Salón Principal"
                                            className="bg-background border-border text-foreground h-11 focus-visible:ring-primary"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="group" className="text-foreground font-bold">3. Ubicación / Grupo</Label>
                                        <Select value={linkData.group_id} onValueChange={(val) => setLinkData({ ...linkData, group_id: val })}>
                                            <SelectTrigger className="w-full bg-background border-border text-foreground h-11 focus:ring-primary">
                                                <SelectValue placeholder="Ninguna zona..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-card border-border text-foreground">
                                                <SelectItem value="none">Sin Grupo</SelectItem>
                                                {linkGroups?.map(g => (
                                                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Right Side: Orientation */}
                                <div className="flex-1 p-4 sm:p-6 bg-background">
                                    <Label className="text-foreground font-bold mb-4 block">4. Orientación Inicial</Label>
                                    <div className="grid grid-cols-2 gap-4">
                                        {/* Horizontal */}
                                        <button 
                                            type="button"
                                            onClick={() => setLinkData({ ...linkData, orientation: 'landscape' })}
                                            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                                linkData.orientation === 'landscape' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted'
                                            }`}
                                        >
                                            <div className="w-16 h-10 border-2 border-current rounded flex items-center justify-center mb-3">
                                                <Play className="w-4 h-4 ml-1" />
                                            </div>
                                            <span className="font-semibold text-sm">Horizontal</span>
                                            <span className="text-xs opacity-70 mt-1 hidden sm:block">FHD 1080p</span>
                                        </button>

                                        {/* Vertical */}
                                        <button 
                                            type="button"
                                            onClick={() => setLinkData({ ...linkData, orientation: 'portrait' })}
                                            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                                                linkData.orientation === 'portrait' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:bg-muted'
                                            }`}
                                        >
                                            <div className="w-10 h-16 border-2 border-current rounded flex items-center justify-center mb-3">
                                                <Play className="w-4 h-4 ml-1" />
                                            </div>
                                            <span className="font-semibold text-sm">Vertical</span>
                                            <span className="text-xs opacity-70 mt-1 hidden sm:block">FHD 1080p</span>
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-4 text-center">
                                        Podrás cambiarla luego desde los ajustes de la pantalla.
                                    </p>
                                </div>
                            </form>
                        </div>
                        <div className="p-4 border-t border-border flex justify-end gap-3 bg-muted/20 shrink-0">
                            <Button type="button" variant="ghost" onClick={() => setIsLinkModalOpen(false)}>Cancelar</Button>
                            <Button type="submit" form="link-device-form" className="bg-primary hover:bg-primary/90 min-w-[140px] h-10" disabled={linkDevice.isPending}>
                                {linkDevice.isPending ? 'Vinculando...' : 'Vincular Pantalla'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <EditScreenModal 
                    isOpen={editModalOpen} 
                    onClose={() => setEditModalOpen(false)} 
                    device={selectedDevice}
                    linkGroups={linkGroups || []}
                    commerceId={commerceId}
                    onSave={(id, updates, asset) => {
                        updateDevice.mutate({ id, updates }, {
                            onSuccess: () => {
                                if (asset) {
                                    let payload: any = { deviceId: id, mediaId: null, campaignId: null, scheduleId: null };
                                    if (asset.type === 'campaign') {
                                        payload.campaignId = asset.id;
                                    } else if (asset.type === 'schedule') {
                                        payload.scheduleId = asset.id;
                                    } else {
                                        payload.mediaId = asset.id;
                                    }

                                    assignContent.mutate(payload, {
                                        onSuccess: () => {
                                            toast.success('Pantalla y contenido actualizados');
                                            setEditModalOpen(false);
                                        },
                                        onError: (err: any) => {
                                            console.error("Assign content failed:", err);
                                            toast.error(`Error al asignar: ${err.message || "Error desconocido"}`);
                                        }
                                    });
                                } else {
                                    toast.success('Pantalla actualizada');
                                    setEditModalOpen(false);
                                }
                            },
                            onError: (err: any) => {
                                console.error("Update device failed:", err);
                                toast.error(`Error al actualizar pantalla: ${err.message || "Error desconocido"}`);
                            }
                        });
                    }}
                />

                <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
                    <DialogContent className="bg-card border-border text-foreground shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-2xl h-[80vh] flex flex-col">
                        <DialogHeader className="px-6 py-4 border-b border-border bg-muted flex flex-row items-center justify-between shrink-0">
                            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                                <Eye className="w-5 h-5 text-primary" />
                                Vista Previa: {previewDevice?.name}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                            {previewDevice ? (
                                <iframe 
                                    src={`/tv/${previewDevice.device_id}`}
                                    className="w-full h-full border-0"
                                    title="Vista Previa TV"
                                    allow="autoplay; fullscreen"
                                />
                            ) : (
                                <div className="text-muted-foreground text-center">
                                    <Monitor className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                    <p>Cargando vista previa...</p>
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Modal de Mover */}
                <MoveDeviceModal 
                    isOpen={moveDeviceModalOpen}
                    onClose={() => setMoveDeviceModalOpen(false)}
                    device={moveDeviceTarget}
                    groups={linkGroups || []}
                    commerceId={effectiveCommerceId}
                />

                {/* Modal de Aprovisionamiento Bluetooth */}
                <BluetoothProvisioningModal 
                    isOpen={isBluetoothModalOpen}
                    onClose={() => {
                        setIsBluetoothModalOpen(false);
                        setInitialDeviceCode(undefined);
                    }}
                    commerceId={effectiveCommerceId}
                    initialDeviceCode={initialDeviceCode}
                />
            </div>
        </div>
    </div>
    );
};

export default DisplayHubList;
