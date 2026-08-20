import { useState, useEffect, useCallback } from 'react';
import { Bluetooth, BluetoothOff, Wifi, Tv2, CheckCircle2, AlertCircle, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { bluetoothClient, BluetoothDevice, BluetoothEvent } from '@/services/BluetoothClientService';
import { toast } from 'sonner';

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

interface BluetoothSetupModalProps {
  open: boolean;
  onClose: () => void;
}

export function BluetoothSetupModal({ open, onClose }: BluetoothSetupModalProps) {
  const [devices, setDevices] = useState<BluetoothDevice[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [connectedDevice, setConnectedDevice] = useState<BluetoothDevice | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Wi-Fi form state
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [sendingWifi, setSendingWifi] = useState(false);

  const isAvailable = bluetoothClient.isAvailable();

  // Refresh paired devices
  const refreshDevices = useCallback(() => {
    const found = bluetoothClient.getPairedEventPixDevices();
    setDevices(found);
  }, []);

  // Subscribe to BT events
  useEffect(() => {
    if (!open) return;
    refreshDevices();

    const unsub = bluetoothClient.onEvent((event: BluetoothEvent) => {
      switch (event.event) {
        case 'connecting':
          setConnectionState('connecting');
          setErrorMessage('');
          break;
        case 'connected':
          setConnectionState('connected');
          setConnectedDevice(devices.find(d => d.address === event.address) || null);
          toast.success(`Conectado a ${event.name}`);
          break;
        case 'disconnected':
          setConnectionState('idle');
          setConnectedDevice(null);
          break;
        case 'response':
          const data = event.data as Record<string, unknown>;
          setSendingWifi(false);
          if (data.status === 'success') {
            toast.success('Wi-Fi configurado en el TV ✓');
          } else {
            toast.error('Error configurando Wi-Fi en el TV');
          }
          break;
        case 'error':
          setConnectionState('error');
          setErrorMessage(event.message || 'Error desconocido');
          toast.error(`Bluetooth: ${event.message}`);
          break;
      }
    });

    return () => {
      unsub();
    };
  }, [open, devices, refreshDevices]);

  const handleConnect = (device: BluetoothDevice) => {
    bluetoothClient.connect(device.address);
  };

  const handleDisconnect = () => {
    bluetoothClient.disconnect();
    setConnectionState('idle');
    setConnectedDevice(null);
  };

  const handleSendWifi = () => {
    if (!ssid.trim()) {
      toast.error('Ingresá el nombre de la red Wi-Fi (SSID)');
      return;
    }
    setSendingWifi(true);
    bluetoothClient.sendWifiConfig(ssid.trim(), password);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-zinc-950 border border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Bluetooth className="w-5 h-5 text-indigo-400" />
            Configurar TV vía Bluetooth
          </DialogTitle>
        </DialogHeader>

        {/* No disponible en web */}
        {!isAvailable && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <BluetoothOff className="w-12 h-12 text-zinc-600" />
            <p className="text-zinc-400 text-sm">
              Bluetooth solo está disponible en la app instalada en tu celular Android.
            </p>
            <p className="text-zinc-600 text-xs">
              Instalá la APK de EventPix para usar esta función.
            </p>
          </div>
        )}

        {/* Disponible en nativo */}
        {isAvailable && (
          <div className="space-y-5">
            {/* Estado conexión */}
            {connectionState === 'connected' && connectedDevice && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-950/50 border border-emerald-700/50">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">{connectedDevice.name}</p>
                    <p className="text-xs text-emerald-600">{connectedDevice.address}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-zinc-400 hover:text-white h-8">
                  <X className="w-3.5 h-3.5 mr-1" /> Desconectar
                </Button>
              </div>
            )}

            {connectionState === 'error' && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-700/50 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {errorMessage}
              </div>
            )}

            {/* Lista de TVs vinculados */}
            {connectionState !== 'connected' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide">
                    TVs EventPix vinculados
                  </Label>
                  <Button variant="ghost" size="sm" onClick={refreshDevices} className="h-7 text-zinc-500 hover:text-white">
                    <RefreshCw className="w-3 h-3 mr-1" /> Actualizar
                  </Button>
                </div>

                {devices.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <Tv2 className="w-8 h-8 text-zinc-700" />
                    <p className="text-zinc-500 text-sm">No hay TVs EventPix vinculados</p>
                    <p className="text-zinc-700 text-xs">
                      Vinculá el Tanix en Ajustes → Bluetooth de tu celular.<br />
                      El dispositivo aparece como <span className="font-mono">EventPix-TV-XXXX</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {devices.map(device => (
                      <button
                        key={device.address}
                        onClick={() => handleConnect(device)}
                        disabled={connectionState === 'connecting'}
                        className="w-full flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-indigo-500/50 hover:bg-zinc-800/80 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/20 flex items-center justify-center">
                            <Tv2 className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{device.name}</p>
                            <p className="text-xs text-zinc-500 font-mono">{device.address}</p>
                          </div>
                        </div>
                        {connectionState === 'connecting' ? (
                          <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                        ) : (
                          <Badge className="bg-indigo-600/20 text-indigo-300 border-indigo-500/30 group-hover:bg-indigo-600/30 text-xs">
                            Conectar
                          </Badge>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Configuración Wi-Fi (solo si está conectado) */}
            {connectionState === 'connected' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-indigo-400" />
                  <Label className="text-xs text-zinc-400 uppercase tracking-wide">
                    Enviar Wi-Fi al TV
                  </Label>
                </div>
                <p className="text-xs text-zinc-500">
                  El TV no necesita internet — le enviás la contraseña directamente vía Bluetooth.
                </p>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor="bt-ssid" className="text-xs text-zinc-400 mb-1 block">Red Wi-Fi (SSID)</Label>
                    <Input
                      id="bt-ssid"
                      value={ssid}
                      onChange={e => setSsid(e.target.value)}
                      placeholder="NombreDeLaRed"
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bt-pass" className="text-xs text-zinc-400 mb-1 block">Contraseña</Label>
                    <Input
                      id="bt-pass"
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600 h-9 text-sm"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleSendWifi}
                  disabled={sendingWifi || !ssid.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white h-9"
                >
                  {sendingWifi ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Enviar configuración al TV</>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
