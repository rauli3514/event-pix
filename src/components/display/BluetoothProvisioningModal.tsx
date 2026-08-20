import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Bluetooth, Wifi, CheckCircle2, Loader2, RefreshCw, Send, Tv2, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useLinkDevice } from '@/hooks/use-display-hub';
import { bluetoothClient, BluetoothDevice, BluetoothEvent } from '@/services/BluetoothClientService';

interface BluetoothProvisioningModalProps {
    isOpen: boolean;
    onClose: () => void;
    commerceId?: string;
    initialDeviceCode?: string;
}

export const BluetoothProvisioningModal: React.FC<BluetoothProvisioningModalProps> = ({
    isOpen,
    onClose,
    commerceId,
    initialDeviceCode
}) => {
    const isNative = bluetoothClient.isAvailable();

    // Native Bluetooth states
    const [pairedDevices, setPairedDevices] = useState<BluetoothDevice[]>([]);
    const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
    const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // Form states
    const [wifiSsid, setWifiSsid] = useState('');
    const [wifiPassword, setWifiPassword] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [devicePin, setDevicePin] = useState(initialDeviceCode || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const linkDevice = useLinkDevice();

    // Refresh paired devices on native Android
    const refreshNativeDevices = useCallback(() => {
        if (isNative) {
            const found = bluetoothClient.getPairedEventPixDevices();
            setPairedDevices(found);
        }
    }, [isNative]);

    // Initial setup and listener subscription
    useEffect(() => {
        if (!isOpen) {
            setConnectionState('idle');
            setSelectedDevice(null);
            setIsSuccess(false);
            setIsSubmitting(false);
            return;
        }

        if (initialDeviceCode) {
            setDevicePin(initialDeviceCode);
            setDeviceName(`Pantalla ${initialDeviceCode}`);
        }

        if (isNative) {
            refreshNativeDevices();

            const unsub = bluetoothClient.onEvent((event: BluetoothEvent) => {
                switch (event.event) {
                    case 'connecting':
                        setConnectionState('connecting');
                        setErrorMessage('');
                        break;
                    case 'connected':
                        setConnectionState('connected');
                        toast.success(`Conectado vía Bluetooth a ${event.name}`);
                        break;
                    case 'disconnected':
                        setConnectionState('idle');
                        setSelectedDevice(null);
                        break;
                    case 'response':
                        const data = event.data as Record<string, unknown>;
                        setIsSubmitting(false);
                        if (data.status === 'success') {
                            setIsSuccess(true);
                            toast.success('¡Wi-Fi configurado en el TV correctamente!');
                        } else {
                            toast.error('El TV recibió la orden pero falló la conexión Wi-Fi.');
                        }
                        break;
                    case 'error':
                        setConnectionState('error');
                        setErrorMessage(event.message || 'Error de conexión Bluetooth');
                        setIsSubmitting(false);
                        toast.error(`Bluetooth: ${event.message}`);
                        break;
                }
            });

            return () => {
                unsub();
            };
        }
    }, [isOpen, initialDeviceCode, isNative, refreshNativeDevices]);

    const handleSelectNativeDevice = (device: BluetoothDevice) => {
        setSelectedDevice(device);
        const pin = device.name.replace('EventPix-TV-', '').trim();
        if (pin) {
            setDevicePin(pin);
            if (!deviceName) setDeviceName(`Pantalla ${pin}`);
        }
        bluetoothClient.connect(device.address);
    };

    const handleSendWifiAndLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!wifiSsid.trim()) {
            toast.error('Ingresá el nombre de la red Wi-Fi (SSID)');
            return;
        }

        setIsSubmitting(true);

        try {
            // 1. Send via Native Bluetooth if connected
            if (isNative && bluetoothClient.isConnected()) {
                bluetoothClient.sendWifiConfig(wifiSsid.trim(), wifiPassword);
            }

            // 2. Also broadcast via Realtime channel if we have a PIN
            const pinToUse = devicePin.trim() || (selectedDevice ? selectedDevice.name.replace('EventPix-TV-', '').trim() : '');
            if (pinToUse) {
                try {
                    const { supabase } = await import('@/lib/supabase');
                    const channel = supabase.channel(`device:${pinToUse}`);
                    await channel.subscribe();
                    await channel.send({
                        type: 'broadcast',
                        event: 'command',
                        payload: { action: 'connect_wifi', ssid: wifiSsid.trim(), password: wifiPassword }
                    });
                } catch (rtErr) {
                    console.warn("Realtime broadcast error:", rtErr);
                }

                // 3. Link device in Supabase database if commerceId is present
                if (commerceId) {
                    await linkDevice.mutateAsync({
                        device_code: pinToUse,
                        name: deviceName.trim() || `Pantalla ${pinToUse}`,
                        commerce_id: commerceId
                    });
                }
            }

            if (!isNative || !bluetoothClient.isConnected()) {
                setIsSubmitting(false);
                setIsSuccess(true);
                toast.success('¡Configuración enviada y pantalla vinculada con éxito!');
            }
        } catch (err: any) {
            console.error(err);
            setIsSubmitting(false);
            toast.error('Error al configurar: ' + (err.message || 'Error desconocido'));
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(openState) => { if (!openState) onClose(); }}>
            <DialogContent className="bg-zinc-950 text-white border-zinc-800 max-w-lg rounded-2xl p-6 shadow-2xl z-[100]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <Bluetooth className="w-6 h-6 text-indigo-400" />
                        Configurar TV por Bluetooth
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400 text-sm">
                        Conectate directamente al Tanix W2 para enviarle la clave Wi-Fi y vincularlo a tu negocio.
                    </DialogDescription>
                </DialogHeader>

                {isSuccess ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="font-bold text-xl text-white">¡Configuración Exitosa!</h3>
                        <p className="text-sm text-zinc-400 max-w-xs">
                            El TV recibió las credenciales Wi-Fi y ya está listo para transmitir en tu local.
                        </p>
                        <Button 
                            onClick={onClose}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white mt-4 px-8 rounded-xl font-semibold"
                        >
                            Listo
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-5 pt-2">
                        {/* Section 1: Native Bluetooth Devices List (if running on Android app) */}
                        {isNative && (
                            <div className="space-y-3 p-3 bg-zinc-900/80 rounded-xl border border-zinc-800">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                                            TVs vinculados en tu celular
                                        </span>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={refreshNativeDevices} className="h-7 text-xs text-zinc-400 hover:text-white">
                                        <RefreshCw className="w-3 h-3 mr-1" /> Actualizar
                                    </Button>
                                </div>

                                {pairedDevices.length === 0 ? (
                                    <p className="text-xs text-zinc-500 py-1">
                                        No detectamos dispositivos <span className="font-mono text-indigo-300">EventPix-TV-*</span> en tu celular. Podés vincularlo primero en Ajustes Bluetooth de Android o ingresar el PIN abajo.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {pairedDevices.map((dev) => (
                                            <button
                                                key={dev.address}
                                                type="button"
                                                onClick={() => handleSelectNativeDevice(dev)}
                                                className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                                                    selectedDevice?.address === dev.address
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                                        : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Tv2 className="w-5 h-5 text-indigo-400" />
                                                    <div>
                                                        <p className="text-sm font-semibold">{dev.name}</p>
                                                        <p className="text-[11px] text-zinc-500 font-mono">{dev.address}</p>
                                                    </div>
                                                </div>
                                                {selectedDevice?.address === dev.address && connectionState === 'connecting' && (
                                                    <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                                                )}
                                                {selectedDevice?.address === dev.address && connectionState === 'connected' && (
                                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                                        Conectado
                                                    </Badge>
                                                )}
                                                {selectedDevice?.address !== dev.address && (
                                                    <Badge variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                                                        Conectar
                                                    </Badge>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error state */}
                        {connectionState === 'error' && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800 text-xs text-red-300">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {errorMessage}
                            </div>
                        )}

                        {/* Form */}
                        <form onSubmit={handleSendWifiAndLink} className="space-y-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-300">Código PIN de la pantalla (4 dígitos)</Label>
                                <Input 
                                    placeholder="Ej: 4892"
                                    value={devicePin}
                                    onChange={(e) => setDevicePin(e.target.value)}
                                    className="bg-zinc-900 border-zinc-800 text-white font-mono text-center tracking-widest text-lg h-11"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-300">Nombre para identificarla</Label>
                                <Input 
                                    placeholder="Ej: TV Salón Principal"
                                    value={deviceName}
                                    onChange={(e) => setDeviceName(e.target.value)}
                                    className="bg-zinc-900 border-zinc-800 text-white h-10"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-300">Red Wi-Fi (SSID)</Label>
                                <div className="relative">
                                    <Wifi className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                                    <Input 
                                        placeholder="Nombre de la red Wi-Fi"
                                        value={wifiSsid}
                                        onChange={(e) => setWifiSsid(e.target.value)}
                                        className="bg-zinc-900 border-zinc-800 text-white pl-9 h-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs text-zinc-300">Contraseña del Wi-Fi</Label>
                                <Input 
                                    type="password"
                                    placeholder="••••••••"
                                    value={wifiPassword}
                                    onChange={(e) => setWifiPassword(e.target.value)}
                                    className="bg-zinc-900 border-zinc-800 text-white h-10"
                                />
                            </div>

                            <Button 
                                type="submit"
                                disabled={isSubmitting || !wifiSsid.trim()}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold h-11 rounded-xl shadow-lg shadow-indigo-600/20 mt-2"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando credenciales...</>
                                ) : (
                                    <><Send className="w-4 h-4 mr-2" /> Enviar Wi-Fi y Vincular Pantalla</>
                                )}
                            </Button>
                        </form>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};
