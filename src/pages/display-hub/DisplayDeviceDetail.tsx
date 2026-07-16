import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Monitor, Save, HardDrive, Clock, Smartphone, Activity, Cpu, PlaySquare, Trash2, AlertTriangle, RotateCcw, Wifi } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDisplayDevice, useAssignContentToDevice, useUpdateDisplayDevice, useDisplayCampaigns, useDeleteAssignment } from "@/hooks/use-display-hub";
import { useDisplayMedia } from "@/hooks/use-display-media";
import { supabase } from "@/lib/supabase";

const WifiSignal = ({ dbm }: { dbm: number }) => {
    let bars = 0;
    if (dbm >= -50) bars = 4;
    else if (dbm >= -65) bars = 3;
    else if (dbm >= -80) bars = 2;
    else if (dbm > -100) bars = 1;

    return (
        <div className="flex items-end gap-[2px] h-[14px]" title={`${dbm} dBm`}>
            {[1, 2, 3, 4].map(i => (
                <div 
                    key={i} 
                    className={`w-1 rounded-sm ${i <= bars ? (bars > 2 ? 'bg-emerald-400' : bars === 2 ? 'bg-yellow-400' : 'bg-rose-400') : 'bg-slate-700'}`} 
                    style={{ height: `${(i / 4) * 100}%` }} 
                />
            ))}
        </div>
    );
};

const DisplayDeviceDetail = () => {
    const { id } = useParams<{ id: string }>();

    const { data: deviceData, isLoading } = useDisplayDevice(id);
    const assignContent = useAssignContentToDevice();
    const updateDevice = useUpdateDisplayDevice();
    const deleteAssignment = useDeleteAssignment();

    const commerceId = deviceData?.commerce_id || undefined;
    const { data: campaigns, isLoading: isLoadingCampaigns } = useDisplayCampaigns(commerceId);
    const { data: mediaFiles, isLoading: isLoadingMedia } = useDisplayMedia(commerceId);

    const [activeTab, setActiveTab] = useState<'assignment' | 'setup'>('assignment');
    
    const [contentType, setContentType] = useState<'campaign' | 'media'>('campaign');
    const [campaignId, setCampaignId] = useState<string>('none');
    const [mediaId, setMediaId] = useState<string>('none');
    const [isScheduled, setIsScheduled] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [name, setName] = useState('');
    const [desc, setDesc] = useState('');
    const [wifiSsid, setWifiSsid] = useState('');
    const [wifiPass, setWifiPass] = useState('');
    const [volume, setVolume] = useState('50');

    useEffect(() => {
        if (deviceData) {
            setName(deviceData.name || '');
            setDesc(deviceData.description || '');
        }
        if (deviceData?.assignment) {
            if (deviceData.assignment.media_id) {
                setContentType('media');
                setMediaId(deviceData.assignment.media_id);
            } else if (deviceData.assignment.campaign_id) {
                setContentType('campaign');
                setCampaignId(deviceData.assignment.campaign_id);
            }
        }
    }, [deviceData]);

    const handleSaveAssignment = () => {
        if (!id) return;
        
        if (contentType === 'campaign' && campaignId === 'none') {
            toast.error('Selecciona una campaña primero');
            return;
        }

        if (contentType === 'media' && mediaId === 'none') {
            toast.error('Selecciona un archivo multimedia primero');
            return;
        }

        if (isScheduled && (!startTime || !endTime)) {
            toast.error('Debes seleccionar fecha de inicio y fin para programar.');
            return;
        }
        
        assignContent.mutate({ 
            deviceId: id, 
            campaignId: contentType === 'campaign' ? campaignId : null,
            mediaId: contentType === 'media' ? mediaId : null,
            startTime: isScheduled && startTime ? new Date(startTime).toISOString() : null,
            endTime: isScheduled && endTime ? new Date(endTime).toISOString() : null
        }, {
            onSuccess: () => {
                toast.success('Campaña asignada correctamente.');
                setIsScheduled(false);
                setStartTime('');
                setEndTime('');
            },
            onError: () => toast.error('Error al asignar la campaña')
        });
    };

    const handleDeleteAssignment = (assignmentId: string) => {
        if (!id) return;
        deleteAssignment.mutate({ id: assignmentId, deviceId: id }, {
            onSuccess: () => toast.success('Programación eliminada'),
            onError: () => toast.error('Error al eliminar')
        });
    };

    const handleForceReload = async () => {
        if (!deviceData?.device_id) return;
        const channel = supabase.channel(`device:${deviceData.device_id}`);
        await channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { action: 'reload' },
        });
        toast.success("Comando de recarga enviado a la pantalla");
    };

    const handleClearCache = async () => {
        if (!deviceData?.device_id) return;
        const channel = supabase.channel(`device:${deviceData.device_id}`);
        await channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { action: 'clear_cache' },
        });
        toast.success("Comando de limpieza de caché enviado a la pantalla");
    };

    const handleConnectWifi = async () => {
        if (!deviceData?.device_id || !wifiSsid || !wifiPass) {
            toast.error("Ingresa el SSID y la contraseña");
            return;
        }
        const channel = supabase.channel(`device:${deviceData.device_id}`);
        await channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { action: 'connect_wifi', ssid: wifiSsid, password: wifiPass },
        });
        toast.success(`Comando para conectar a ${wifiSsid} enviado`);
        setWifiSsid('');
        setWifiPass('');
    };

    const handleSetVolume = async () => {
        if (!deviceData?.device_id) return;
        const channel = supabase.channel(`device:${deviceData.device_id}`);
        await channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { action: 'set_volume', volume: parseInt(volume, 10) },
        });
        toast.success(`Comando de volumen (${volume}%) enviado`);
    };

    const handleResetTelemetry = async () => {
        if (!deviceData?.device_id) return;
        const channel = supabase.channel(`device:${deviceData.device_id}`);
        await channel.send({
            type: 'broadcast',
            event: 'command',
            payload: { action: 'reset_telemetry' },
        });
        toast.success("Comando de reseteo de telemetría enviado a la pantalla");
    };

    const handleSaveInfo = () => {
        if (!id) return;
        updateDevice.mutate({ id, updates: { name: name || null, description: desc || null } }, {
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
                            <Link to={`/admin/display/commerce/${deviceData.commerce_id}/workspace/screens`}>
                                <ArrowLeft className="w-4 h-4 mr-2" /> Volver a las Pantallas
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

                <div className="flex border-b border-slate-800 mb-6">
                    <button 
                        className={`px-6 py-3 font-medium text-sm transition-all border-b-2 ${activeTab === 'assignment' ? 'border-orange-500 text-orange-500' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setActiveTab('assignment')}
                    >
                        Contenido y Asignación
                    </button>
                    <button 
                        className={`px-6 py-3 font-medium text-sm transition-all border-b-2 flex items-center gap-2 ${activeTab === 'setup' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                        onClick={() => setActiveTab('setup')}
                    >
                        <Cpu className="w-4 h-4" /> Setup Screen
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Left Col */}
                    <div className="md:col-span-2 space-y-6">
                        
                        {activeTab === 'assignment' && (
                            <>
                            {/* Campaign Assignment */}
                        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-6">
                                <PlaySquare className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-xl font-bold text-white">Contenido en Pantalla (Campaña)</h2>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Tipo de Contenido *</Label>
                                        <Select value={contentType} onValueChange={(v: 'campaign' | 'media') => setContentType(v)}>
                                            <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                <SelectItem value="campaign">Playlist (Campaña)</SelectItem>
                                                <SelectItem value="media">Archivo Directo (Media)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Contenido Seleccionado *</Label>
                                        
                                        {contentType === 'campaign' ? (
                                            isLoadingCampaigns ? (
                                                <div className="h-10 bg-slate-800 animate-pulse rounded-md"></div>
                                            ) : (
                                                <Select value={campaignId} onValueChange={setCampaignId}>
                                                    <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                        <SelectValue placeholder="Seleccionar campaña..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                        <SelectItem value="none">-- Sin Asignar --</SelectItem>
                                                        {campaigns?.map(c => (
                                                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )
                                        ) : (
                                            isLoadingMedia ? (
                                                <div className="h-10 bg-slate-800 animate-pulse rounded-md"></div>
                                            ) : (
                                                <Select value={mediaId} onValueChange={setMediaId}>
                                                    <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                        <SelectValue placeholder="Seleccionar archivo..." />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                        <SelectItem value="none">-- Sin Asignar --</SelectItem>
                                                        {mediaFiles?.filter(m => m.type !== 'folder').map(m => (
                                                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )
                                        )}
                                    </div>
                                </div>

                                    <div className="flex items-center gap-2 mt-4 mb-2">
                                        <input 
                                            type="checkbox" 
                                            id="isScheduled" 
                                            checked={isScheduled} 
                                            onChange={(e) => setIsScheduled(e.target.checked)}
                                            className="rounded border-slate-700 bg-slate-950 text-indigo-600"
                                        />
                                        <Label htmlFor="isScheduled" className="text-slate-300">Programar para una fecha específica</Label>
                                    </div>

                                    {isScheduled && (
                                        <div className="grid grid-cols-2 gap-4 mt-2 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                                            <div className="space-y-2">
                                                <Label className="text-slate-400 text-xs">Fecha de Inicio</Label>
                                                <Input 
                                                    type="datetime-local" 
                                                    value={startTime}
                                                    onChange={e => setStartTime(e.target.value)}
                                                    className="bg-slate-900 border-slate-700 text-white text-sm" 
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-400 text-xs">Fecha de Fin</Label>
                                                <Input 
                                                    type="datetime-local" 
                                                    value={endTime}
                                                    onChange={e => setEndTime(e.target.value)}
                                                    className="bg-slate-900 border-slate-700 text-white text-sm" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <p className="text-xs text-slate-500 mt-2">
                                        Si la pantalla está online, el cambio se reflejará en la TV en menos de 30 segundos.
                                    </p>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <Button asChild variant="link" className="text-indigo-400 p-0">
                                        <Link to={`/admin/display/commerce/${deviceData.commerce_id}/campaigns`}>
                                            Ir al Gestor de Campañas
                                        </Link>
                                    </Button>
                                    <Button onClick={handleSaveAssignment} disabled={assignContent.isPending || (contentType === 'campaign' && campaignId === 'none') || (contentType === 'media' && mediaId === 'none')} className="bg-emerald-500 hover:bg-emerald-600">
                                        <Save className="w-4 h-4 mr-2" /> {assignContent.isPending ? 'Enviando...' : 'Enviar a TV'}
                                    </Button>
                                </div>
                            </div>

                        {/* Scheduled Campaigns List */}
                        {deviceData.allAssignments && deviceData.allAssignments.filter(a => a.start_time).length > 0 && (
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-400" /> Programaciones Vigentes
                                </h2>
                                <div className="space-y-3">
                                    {deviceData.allAssignments.filter(a => a.start_time).map(assignment => (
                                        <div key={assignment.id} className="flex justify-between items-center bg-slate-950 p-3 rounded-lg border border-slate-800">
                                            <div>
                                                <p className="text-sm font-medium text-white">{assignment.campaign?.name || 'Campaña Desconocida'}</p>
                                                <p className="text-xs text-slate-400">
                                                    Del {new Date(assignment.start_time!).toLocaleString('es-AR')} al {new Date(assignment.end_time!).toLocaleString('es-AR')}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteAssignment(assignment.id)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-400/10 h-8 w-8 p-0">
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

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
                        </>
                        )}

                        {activeTab === 'setup' && (
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-6">
                                    <Cpu className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-xl font-bold text-white">Configuración Avanzada (Setup)</h2>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <Label className="text-slate-300">Rotación de Pantalla (Grados)</Label>
                                        <Select value={deviceData.orientation || '0'} onValueChange={(v) => updateDevice.mutate({ id: deviceData.id, updates: { orientation: v } })}>
                                            <SelectTrigger className="w-full bg-slate-950 border-slate-700 text-white">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                                <SelectItem value="0">0° (Horizontal/Normal)</SelectItem>
                                                <SelectItem value="90">90° (Vertical Derecha)</SelectItem>
                                                <SelectItem value="180">180° (Horizontal Invertido)</SelectItem>
                                                <SelectItem value="270">270° (Vertical Izquierda)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800">
                                        <h3 className="text-sm font-medium text-slate-300 mb-4">Control de Red (Wi-Fi)</h3>
                                        <div className="grid grid-cols-2 gap-3 mb-3">
                                            <Input 
                                                placeholder="Nombre de red (SSID)" 
                                                value={wifiSsid} 
                                                onChange={e => setWifiSsid(e.target.value)}
                                                className="bg-slate-950 border-slate-700 text-white text-sm"
                                            />
                                            <Input 
                                                placeholder="Contraseña" 
                                                type="password"
                                                value={wifiPass} 
                                                onChange={e => setWifiPass(e.target.value)}
                                                className="bg-slate-950 border-slate-700 text-white text-sm"
                                            />
                                        </div>
                                        <Button onClick={handleConnectWifi} variant="outline" className="w-full justify-center border-slate-700 bg-slate-950 text-indigo-400 hover:text-white hover:bg-slate-800">
                                            Cambiar Red Wi-Fi Remotamente
                                        </Button>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800">
                                        <h3 className="text-sm font-medium text-slate-300 mb-4">Control de Volumen</h3>
                                        <div className="flex gap-3 mb-3">
                                            <Input 
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={volume}
                                                onChange={e => setVolume(e.target.value)}
                                                className="flex-1"
                                            />
                                            <span className="text-slate-300 w-12 text-right">{volume}%</span>
                                        </div>
                                        <Button onClick={handleSetVolume} variant="outline" className="w-full justify-center border-slate-700 bg-slate-950 text-emerald-400 hover:text-white hover:bg-slate-800">
                                            Establecer Volumen
                                        </Button>
                                    </div>

                                    <div className="pt-4 border-t border-slate-800">
                                        <h3 className="text-sm font-medium text-slate-300 mb-4">Acciones del Sistema</h3>
                                        <div className="flex flex-col gap-3">
                                            <Button onClick={handleForceReload} variant="outline" className="w-full justify-start border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800">
                                                <Activity className="w-4 h-4 mr-2 text-indigo-400" /> Forzar Recarga de la App
                                            </Button>
                                            <Button onClick={handleClearCache} variant="outline" className="w-full justify-start border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800">
                                                <Trash2 className="w-4 h-4 mr-2 text-rose-400" /> Limpiar Caché Remotamente
                                            </Button>
                                            <Button onClick={handleResetTelemetry} variant="outline" className="w-full justify-start border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800">
                                                <RotateCcw className="w-4 h-4 mr-2 text-amber-400" /> Resetear Contadores (Crash/Reinicio)
                                            </Button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-3">
                                            Las acciones remotas se ejecutan instantáneamente si la pantalla está online.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
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
                                {deviceData.telemetry?.hardware && (
                                    <>
                                        <div className="flex items-start gap-3">
                                            <Monitor className="w-5 h-5 text-slate-500 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-slate-300">Resolución Nativa</p>
                                                <p className="text-sm text-slate-500">{deviceData.telemetry.hardware.resolution}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Activity className="w-5 h-5 text-slate-500 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-slate-300">Uptime (Tiempo Encendido)</p>
                                                <p className="text-sm text-slate-500">{Math.floor(deviceData.telemetry.hardware.uptime_hours)} horas</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {deviceData.telemetry?.network && (
                                    <div className="flex items-start gap-3">
                                        <Activity className="w-5 h-5 text-slate-500 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-slate-300">Red Activa</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {deviceData.telemetry.network.type === 'wifi' ? (
                                                    <>
                                                        <WifiSignal dbm={deviceData.telemetry.network.wifi_rssi_dbm || -100} />
                                                        <span className="text-sm text-slate-500">Wi-Fi</span>
                                                    </>
                                                ) : (
                                                    <span className="text-sm text-slate-500 capitalize">{deviceData.telemetry.network.type}</span>
                                                )}
                                                {deviceData.telemetry.network.ip && (
                                                    <>
                                                        <span className="text-slate-600">•</span>
                                                        <span className="text-sm text-slate-500">IP: {deviceData.telemetry.network.ip}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Telemetry Status */}
                        {deviceData.telemetry && (
                            <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
                                <h2 className="text-lg font-bold text-white mb-4">Rendimiento y Diagnóstico</h2>
                                
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                                            <div className="flex items-center gap-2 mb-1">
                                                <RotateCcw className="w-4 h-4 text-slate-400" />
                                                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Reinicios Totales</p>
                                            </div>
                                            <p className="text-2xl font-bold text-white">{deviceData.telemetry.boot_count || 0}</p>
                                        </div>
                                        
                                        <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50">
                                            <div className="flex items-center gap-2 mb-1">
                                                <AlertTriangle className={`w-4 h-4 ${(deviceData.telemetry.crash_count || 0) > 0 ? 'text-rose-500' : 'text-slate-400'}`} />
                                                <p className={`text-xs font-medium uppercase tracking-wider ${(deviceData.telemetry.crash_count || 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>Fallos (Crashes)</p>
                                            </div>
                                            <p className={`text-2xl font-bold ${(deviceData.telemetry.crash_count || 0) > 0 ? 'text-rose-400' : 'text-white'}`}>{deviceData.telemetry.crash_count || 0}</p>
                                        </div>
                                    </div>

                                    {deviceData.telemetry.memory && (
                                        <div className="flex items-start gap-3 pt-2">
                                            <Cpu className="w-5 h-5 text-indigo-400 mt-0.5" />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-sm font-medium text-slate-300">Memoria RAM (Usada / Libre)</p>
                                                    <p className="text-xs text-slate-400">{deviceData.telemetry.memory.used_mb}MB / {deviceData.telemetry.memory.free_mb}MB</p>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (deviceData.telemetry.memory.used_mb / deviceData.telemetry.memory.max_mb) * 100))}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {deviceData.telemetry.storage && (
                                        <div className="flex items-start gap-3 pt-2">
                                            <HardDrive className="w-5 h-5 text-emerald-400 mt-0.5" />
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center mb-1">
                                                    <p className="text-sm font-medium text-slate-300">Almacenamiento Libre</p>
                                                    <p className="text-xs text-slate-400">{deviceData.telemetry.storage.free_mb}MB / {deviceData.telemetry.storage.total_mb}MB</p>
                                                </div>
                                                <div className="w-full bg-slate-800 rounded-full h-1.5">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, ((deviceData.telemetry.storage.total_mb - deviceData.telemetry.storage.free_mb) / deviceData.telemetry.storage.total_mb) * 100))}%` }}></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
};

export default DisplayDeviceDetail;
