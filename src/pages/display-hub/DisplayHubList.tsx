import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Monitor, ArrowLeft, Activity, Tv, ServerCrash, Layers, Plus, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from 'sonner';

import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayDevices, useLinkDevice, useCommerces, useDisplayGroups } from "@/hooks/use-display-hub";

const DisplayHubList = () => {
    const navigate = useNavigate();
    const { commerceId } = useParams<{ commerceId: string }>();
    const isSuperAdmin = useIsSuperAdmin();
    
    // States for linking
    const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
    const [linkData, setLinkData] = useState({ device_code: '', name: '', description: '', group_id: 'none' });
    
    // States for filtering
    const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
    const [search, setSearch] = useState('');

    // Si es SuperAdmin, usamos el commerceId de la URL. Si es Provider, en el futuro usaremos su propio ID.
    // Por ahora, asumimos que estamos en el flujo Super Admin explorando un commerce.
    const effectiveCommerceId = commerceId || 'unknown';

    // Data Fetching
    const { data: devices, isLoading } = useDisplayDevices(effectiveCommerceId);
    const { data: commerces } = useCommerces();
    const { data: linkGroups } = useDisplayGroups(effectiveCommerceId);
    const linkDevice = useLinkDevice();

    const commerceProfile = commerces?.find(c => c.id === effectiveCommerceId);

    // Redirección de seguridad (por ahora, luego se adaptará para providers)
    if (isSuperAdmin === false) {
        navigate('/admin', { replace: true });
        return null;
    }

    // Ya no traemos pendingDevices globalmente, porque ahora la vinculación es manual (tipeando el código).
    const linkedDevices = devices?.filter(d => d.derived_status !== 'pending') || [];

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
                toast.success('¡Pantalla vinculada exitosamente a este comercio!');
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 animate-pulse">Cargando pantallas del cliente...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 relative overflow-hidden text-slate-200">
            <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] bg-indigo-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-600/10 rounded-full mix-blend-screen filter blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto relative z-10 space-y-8">
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Button variant="ghost" asChild className="mb-4 text-slate-400 hover:text-white hover:bg-slate-800 -ml-4">
                            <Link to="/admin/display">
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Directorio
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <Monitor className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white font-[Orbitron]">
                                    {commerceProfile ? commerceProfile.name : 'Panel del Comercio'}
                                </h1>
                                <p className="text-slate-400 text-sm">Gestiona las pantallas de este local</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <Button asChild variant="outline" className="border-indigo-500 text-indigo-400 hover:bg-indigo-950">
                            <Link to={`/admin/display/commerce/${effectiveCommerceId}/campaigns`}>
                                <Layers className="w-4 h-4 mr-2" /> Gestor de Campañas
                            </Link>
                        </Button>
                        <Button onClick={() => setIsLinkModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]">
                            <Plus className="w-4 h-4 mr-2" /> Vincular Pantalla
                        </Button>
                    </div>
                </header>

                <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
                    <DialogContent className="bg-slate-900 border-slate-800 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-xl">Vincular Pantalla</DialogTitle>
                            <DialogDescription className="text-slate-400">
                                Asegúrate de que la aplicación EventPix Display esté abierta en la TV.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleLinkSubmit} className="space-y-4 mt-2">
                            
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                                <Label htmlFor="code" className="text-slate-300 font-bold">1. Código de Vinculación *</Label>
                                <p className="text-xs text-slate-500">Ingresa el código que se muestra actualmente en la pantalla del televisor.</p>
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
                                <Label htmlFor="name" className="text-slate-300">2. Nombre para la Pantalla *</Label>
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
                                <Label htmlFor="group" className="text-slate-300">3. Zona / Grupo (Opcional)</Label>
                                <Select value={linkData.group_id} onValueChange={(val) => setLinkData({ ...linkData, group_id: val })}>
                                    <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                        <SelectValue placeholder="Ninguna zona..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                        <SelectItem value="none">Sin Zona Específica</SelectItem>
                                        {linkGroups?.map(g => (
                                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 mt-2 h-12 text-lg" disabled={linkDevice.isPending}>
                                {linkDevice.isPending ? 'Verificando y Vinculando...' : 'Vincular Pantalla'}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Dashboard Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Tv className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-400 font-medium uppercase tracking-wider">Tus Pantallas</p>
                            <p className="text-3xl font-bold text-white">{linkedDevices.length}</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-emerald-900/30 rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <Activity className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-sm text-emerald-400/80 font-medium uppercase tracking-wider">Online</p>
                            <p className="text-3xl font-bold text-emerald-400">{onlineCount}</p>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 backdrop-blur-sm border border-rose-900/30 rounded-2xl p-6 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center">
                            <ServerCrash className="w-6 h-6 text-rose-400" />
                        </div>
                        <div>
                            <p className="text-sm text-rose-400/80 font-medium uppercase tracking-wider">Offline</p>
                            <p className="text-3xl font-bold text-rose-400">{offlineCount}</p>
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/30 p-2 rounded-xl border border-slate-800/50">
                    <div className="flex bg-slate-950 rounded-lg p-1 w-full md:w-auto">
                        <button onClick={() => setFilter('all')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>Todas</button>
                        <button onClick={() => setFilter('online')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'online' ? 'bg-emerald-900/40 text-emerald-400 shadow-sm' : 'text-slate-400 hover:text-emerald-400'}`}>Online</button>
                        <button onClick={() => setFilter('offline')} className={`flex-1 md:flex-none px-4 py-2 rounded-md text-sm font-medium transition-all ${filter === 'offline' ? 'bg-rose-900/40 text-rose-400 shadow-sm' : 'text-slate-400 hover:text-rose-400'}`}>Offline</button>
                    </div>
                    <div className="w-full md:w-64">
                        <Input 
                            placeholder="Buscar por nombre..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white w-full"
                        />
                    </div>
                </div>

                {/* Devices List */}
                <div className="space-y-3">
                    {filteredLinkedDevices.map(device => (
                        <div key={device.id} className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800/50 rounded-xl p-4 md:px-6 md:py-4 hover:bg-slate-900 transition-all duration-300 flex flex-col md:grid md:grid-cols-12 gap-4 items-center">
                            
                            <div className="col-span-5 w-full">
                                <Link to={`/admin/display/${device.id}`} className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">
                                    {device.name}
                                </Link>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-xs tracking-wider text-slate-500">ID: {device.device_id}</span>
                                    {device.group && (
                                        <div className="flex items-center text-[10px] text-indigo-300/80 bg-indigo-900/20 px-2 py-0.5 rounded border border-indigo-500/20">
                                            <Layers className="w-3 h-3 mr-1" />
                                            {device.group.name}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="col-span-3 w-full flex md:block justify-between items-center">
                                <span className="md:hidden text-slate-500 text-sm">Estado:</span>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${device.derived_status === 'online' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-rose-500'}`} />
                                    <span className={`text-sm font-bold ${device.derived_status === 'online' ? 'text-emerald-400' : 'text-rose-500'}`}>
                                        {device.derived_status === 'online' ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </div>
                            </div>

                            <div className="col-span-3 w-full flex md:block justify-between items-center">
                                <span className="md:hidden text-slate-500 text-sm">Últ. vez:</span>
                                <div className="text-sm text-slate-400">
                                    {device.last_seen 
                                        ? new Date(device.last_seen).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
                                        : 'Nunca conectada'
                                    }
                                </div>
                            </div>

                            <div className="col-span-1 w-full flex justify-end">
                                <Button asChild size="sm" variant="outline" className="bg-transparent border-slate-700 text-white hover:bg-indigo-600 hover:border-indigo-500 hover:text-white">
                                    <Link to={`/admin/display/${device.id}`}>
                                        Gestión
                                    </Link>
                                </Button>
                            </div>

                        </div>
                    ))}

                    {filteredLinkedDevices.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center py-20 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
                            <Monitor className="w-12 h-12 text-slate-600 mb-4" />
                            <h3 className="text-xl font-bold text-white">No hay pantallas vinculadas</h3>
                            <p className="text-slate-400 mt-2 text-center max-w-sm">
                                Dale clic al botón "+ Vincular Nueva Pantalla" e ingresa el código que ves en tu TV.
                            </p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default DisplayHubList;
