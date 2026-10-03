import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Wifi } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  checkinDevice, getCachedDeviceState, getVipAppPackage, listInstalledApps, openWifiSettings,
  setBoxPin, setVipAppPackage, type KioskDeviceState,
} from '@/lib/kioskDevice';
import { buttonClass, inputClass, Panel, primaryClass } from './ui';

export default function DeviceSection() {
  const [device, setDevice] = useState<KioskDeviceState | null>(getCachedDeviceState);
  const [apps] = useState(listInstalledApps);
  const [vipPackage, setVip] = useState(getVipAppPackage);
  const [newPin, setNewPin] = useState('');
  const [version, setVersion] = useState('');

  useEffect(() => {
    checkinDevice().then(setDevice).catch(() => { /* sin conexión: queda el último estado */ });
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.getInfo().then(info => setVersion(`${info.version} (${info.build})`)).catch(() => {});
    }
  }, []);

  const savePin = () => {
    if (!/^\d{4,8}$/.test(newPin)) {
      toast.error('La clave tiene que tener entre 4 y 8 números');
      return;
    }
    setBoxPin(newPin);
    setNewPin('');
    toast.success('Clave cambiada');
  };

  return (
    <div className="space-y-6">
      <Panel title="Este equipo" description="El nombre y el evento se cambian desde el panel: Kiosco IA → Equipos.">
        <div className="grid grid-cols-3 gap-4">
          <Info label="Código" value={device?.deviceCode || '—'} mono />
          <Info label="Nombre" value={device?.name || '—'} />
          <Info label="Evento" value={device?.eventName || 'Sin evento'} />
        </div>
        {version && <p className="text-white/40">Versión de la app: {version}</p>}
      </Panel>

      <Panel title="Internet">
        <button data-autofocus onClick={openWifiSettings} className={buttonClass}>
          <Wifi className="w-5 h-5" /> Configurar WiFi del equipo
        </button>
      </Panel>

      <Panel title="Ingreso VIP" description='Elegí la app que abre el ícono "Ingreso VIP" del inicio. Si no elegís ninguna, el ícono no aparece.'>
        <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1">
          {[{ label: 'Ninguna', packageName: '' }, ...apps].map(a => (
            <button key={a.packageName || 'none'} onClick={() => { setVip(a.packageName); setVipAppPackage(a.packageName); }}
              className={`text-left rounded-2xl px-5 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-cyan-400 ${vipPackage === a.packageName ? 'bg-violet-600' : 'bg-white/10 hover:bg-white/20'}`}>
              {a.label}
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Clave de ajustes" description="La que se pide al tocar Ajustes en el inicio.">
        <div className="flex gap-3">
          <input className={inputClass} inputMode="numeric" placeholder="Nueva clave (4 a 8 números)" value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
          <button onClick={savePin} className={primaryClass}>Cambiar</button>
        </div>
      </Panel>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl bg-black/20 border border-white/10 px-5 py-4">
      <p className="text-white/50 text-sm">{label}</p>
      <p className={`text-2xl ${mono ? 'font-mono tracking-widest' : 'font-semibold'}`}>{value}</p>
    </div>
  );
}
