import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Save, HardDrive, Clock, Smartphone, Activity, Cpu, PlaySquare } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsSuperAdmin } from "@/hooks/use-roles";
import { useDisplayDevice, useAssignContentToDevice, useUpdateDisplayDevice, useDisplayCampaigns } from "@/hooks/use-display-hub";

const DisplayDeviceDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isSuperAdmin = useIsSuperAdmin();

    const { data: deviceData, isLoading } = useDisplayDevice(id);
    const assignContent = useAssignContentToDevice();
    const updateDevice = useUpdateDisplayDevice();

    const { data: campaigns, isLoading: isLoadingCampaigns } = useDisplayCampaigns(deviceData?.commerce_id || undefined);

    const [campaignId, setCampaignId] = useState<string>('none');
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');

    if (isSuperAdmin === false) {
        navigate('/admin', { replace: true });
        return null;
    }

    useEffect(() => {
        if (deviceData) {
            setName(deviceData.name || '');
            setDesc(deviceData.description || '');
            if (deviceData.assignment?.campaign_id) {
                setCampaignId(deviceData.assignment.campaign_id);
            } else {
                setCampaignId('none');
            }
        }
    }, [deviceData]);

    const handleSaveAssignment = () => {
        if (!id) return;
        if (campaignId === 'none') {
            toast.error('Selecciona una campaña primero');
            return;
        }
        
        assignContent.mutate({ deviceId: id, campaignId }, {
            onSuccess: () => toast.success('Campaña asignada correctamente. La pantalla se actualizará en breve.'),
            onError: () => toast.error('Error al asignar la campaña')
        });
    };

    const handleSaveInfo = () => {
        if (!id) return;
        updateDevice.mutate({ id, updates: { name, description: desc } }, {
            onSuccess: () => toast.success('Información actualizada'),
            onError: () => toast.error('Error al actualizar la información')
        });
    };

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (!deviceData) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white flex-col gap-4">
            <h2 className="text-2xl font-bold">Pantalla no encontrada</h2>
            <Button asChild><Link to="/admin/display">Volver al listado</Link></Button>
        </div>
    );

    const isOnline = deviceData.derived_status === 'online';

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-slate-200">
            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Button variant="ghost" asChild className="mb-2 text-slate-400 hover:text-white hover:bg-slate-800 -ml-4">
                            <Link to={`/admin/display/commerce/${deviceData.commerce_id}`}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Comercio
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
                                <Monitor className="w-6 h-6 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                    {deviceData.name || 'Sin Nombre'}
                                    <span className={`text-xs px-2 py-1 rounded-full border ${isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
                                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                                    </span>
                                </h1>
                                <p className="text-slate-400 text-sm font-mono mt-1">ID Hardware: {deviceData.device_id}</p>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Left Col: Setup & Assignment */}
                    <div className="md:col-span-2 space-y-6">
                        
                        {/* Campaign Assignment */}
                        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <PlaySquare className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-xl font-bold text-white">Contenido en Pantalla (Campaña)</h2>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Seleccionar Campaña / Playlist</Label>
                                    
                                    {isLoadingCampaigns ? (
                                        <div className="h-10 bg-slate-800 animate-pulse rounded-md"></div>
                                    ) : (
                                        <Select value={campaignId} onValueChange={setCampaignId}>
                                            <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                <SelectValue placeholder="Seleccionar campaña..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                <SelectItem value="none">-- Sin Contenido (Pantalla en negro) --</SelectItem>
                                                {campaigns?.map(c => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <p className="text-xs text-slate-500">
                                        Si la pantalla está online, el cambio de campaña se reflejará en la TV en menos de 30 segundos.
                                    </p>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <Button asChild variant="link" className="text-indigo-400 p-0">
                                        <Link to={`/admin/display/commerce/${deviceData.commerce_id}/campaigns`}>
                                            Ir al Gestor de Campañas
                                        </Link>
                                    </Button>
                                    <Button onClick={handleSaveAssignment} disabled={assignContent.isPending || campaignId === 'none' && !deviceData.assignment?.campaign_id} className="bg-indigo-600 hover:bg-indigo-700">
                                        <Save className="w-4 h-4 mr-2" /> {assignContent.isPending ? 'Guardando...' : 'Asignar a TV'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* General Info */}
                        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <HardDrive className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-xl font-bold text-white">Información General</h2>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Nombre de la Pantalla</Label>
                                    <Input 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-300">Ubicación / Descripción</Label>
                                    <Input 
                                        value={desc}
                                        onChange={(e) => setDesc(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button onClick={handleSaveInfo} variant="outline" disabled={updateDevice.isPending} className="border-slate-700 text-white hover:bg-slate-800">
                                        Actualizar Info
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Col: Device Status */}
                    <div className="space-y-6">
                        
                        {/* Hardware Status */}
                        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                            <h2 className="text-lg font-bold text-white mb-4">Estado del Hardware</h2>
                            
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <Clock className="w-5 h-5 text-slate-500 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">Último Ping (Heartbeat)</p>
                                        <p className="text-sm text-slate-500">
                                            {deviceData.last_seen 
                                                ? new Date(deviceData.last_seen).toLocaleString('es-AR')
                                                : 'Nunca conectado'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Activity className="w-5 h-5 text-slate-500 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">Modelo del Equipo</p>
                                        <p className="text-sm text-slate-500">{deviceData.device_model || 'Desconocido'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Cpu className="w-5 h-5 text-slate-500 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">Android OS</p>
                                        <p className="text-sm text-slate-500">{deviceData.android_version ? `Versión ${deviceData.android_version}` : 'Desconocida'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <Smartphone className="w-5 h-5 text-slate-500 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-slate-300">Versión APK EventPix</p>
                                        <p className="text-sm text-slate-500">{deviceData.app_version || 'Desconocida'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisplayDeviceDetail;
