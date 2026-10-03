import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Camera, Sparkles, Ticket, Wifi, Settings, Delete, Loader2, AlertTriangle } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import {
  checkinDevice, getCachedDeviceState, getDeviceCode, getBoxPin, getVipAppPackage,
  openAndroidApp, openWifiSettings, type KioskDeviceState,
} from '@/lib/kioskDevice';

// Inicio de la app "EventPix Kiosco" en la TV box: sin login. Si el equipo no
// está vinculado muestra su código para registrarlo en el panel; si lo está,
// muestra los íconos de cada experiencia. Ajustes queda detrás de un PIN.

const PENDING_POLL_MS = 8000;
const LINKED_POLL_MS = 60000;

const appVersion = async () => {
  if (!Capacitor.isNativePlatform()) return undefined;
  try {
    return (await CapacitorApp.getInfo()).version;
  } catch {
    return undefined;
  }
};

export default function KioskBox() {
  const navigate = useNavigate();
  const [device, setDevice] = useState<KioskDeviceState | null>(() => getCachedDeviceState());
  const [offline, setOffline] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [vipError, setVipError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      setDevice(await checkinDevice(await appVersion()));
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    const linked = device?.pairingStatus === 'linked';
    const first = window.setTimeout(refresh, 0);
    const timer = window.setInterval(refresh, linked ? LINKED_POLL_MS : PENDING_POLL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [refresh, device?.pairingStatus]);

  // Con el PIN abierto, el foco lo maneja el diálogo
  useRemoteFocus(rootRef, [device?.pairingStatus], !pinOpen);

  const openExperience = (modes: 'selfie' | 'ai') => {
    const params = new URLSearchParams({ modes, home: '1' });
    if (device?.kioskEventId) params.set('event', device.kioskEventId);
    navigate(`/kiosco?${params.toString()}`);
  };

  const vipPackage = getVipAppPackage();
  const openVip = () => {
    if (!openAndroidApp(vipPackage)) setVipError(true);
  };

  // ─── Equipo sin vincular ─────────────────────────────────────────
  if (!device || device.pairingStatus !== 'linked') {
    const code = device?.deviceCode ?? getDeviceCode();
    return (
      <div ref={rootRef} className="min-h-screen bg-gradient-to-br from-[#0b1026] via-[#151a4a] to-[#3b0f5c] text-white flex flex-col items-center justify-center gap-10 p-10">
        <h1 className="carlmarx-bold text-5xl text-center">EventPix Kiosco</h1>
        <div className="text-center space-y-4">
          <p className="text-xl text-white/70">Código de este equipo</p>
          <p className="font-mono text-[clamp(4rem,12vw,9rem)] font-bold tracking-[0.25em] text-cyan-300 drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">
            {code}
          </p>
        </div>
        <div className="max-w-2xl text-center text-lg text-white/80 space-y-2">
          <p>Para usarlo, en el panel de EventPix entrá a <b>Kiosco IA → Equipos</b>,</p>
          <p>cargá este código y elegí el evento.</p>
        </div>
        <div className="flex items-center gap-3 text-white/60">
          {offline ? (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Sin conexión a internet.</span>
              <button onClick={openWifiSettings} className="ml-2 px-4 py-2 rounded-xl bg-white/10 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-400">
                Configurar WiFi
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Esperando que lo vincules…</span>
            </>
          )}
        </div>
      </div>
    );
  }

  // ─── Inicio ──────────────────────────────────────────────────────
  const tiles = [
    { key: 'fotos', label: 'Fotos', hint: 'Selfie con marco', icon: Camera, color: 'from-cyan-500 to-blue-600', onClick: () => openExperience('selfie') },
    { key: 'ia', label: 'Fotos IA', hint: 'Retratos, Mundial y más', icon: Sparkles, color: 'from-violet-500 to-fuchsia-600', onClick: () => openExperience('ai') },
    ...(vipPackage ? [{ key: 'vip', label: 'Ingreso VIP', hint: 'Acceso de invitados', icon: Ticket, color: 'from-amber-400 to-orange-600', onClick: openVip }] : []),
  ];

  return (
    <div ref={rootRef} className="min-h-screen bg-gradient-to-br from-[#0b1026] via-[#151a4a] to-[#3b0f5c] text-white flex flex-col">
      <header className="flex items-center justify-between px-10 pt-8">
        <div>
          <p className="text-white/50 text-sm uppercase tracking-widest">{device.name || `Equipo ${device.deviceCode}`}</p>
          <p className="text-2xl font-bold">{device.eventName || 'Sin evento asignado'}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={openWifiSettings} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-400">
            <Wifi className="w-5 h-5" /> WiFi
          </button>
          <button onClick={() => setPinOpen(true)} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-400">
            <Settings className="w-5 h-5" /> Ajustes
          </button>
        </div>
      </header>

      {!device.kioskEventId && (
        <div className="mx-10 mt-6 flex items-center gap-3 rounded-2xl bg-amber-500/15 border border-amber-400/40 px-5 py-3 text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          Asigná un evento a este equipo desde el panel (Kiosco IA → Equipos) para que las fotos se guarden.
        </div>
      )}
      {offline && (
        <div className="mx-10 mt-4 flex items-center gap-3 rounded-2xl bg-white/5 border border-white/15 px-5 py-3 text-white/70">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" /> Sin conexión: usando la última configuración guardada.
        </div>
      )}

      <main className="flex-1 flex items-center justify-center p-10">
        <div className={`grid gap-10 w-full ${tiles.length === 3 ? 'grid-cols-3 max-w-6xl' : 'grid-cols-2 max-w-4xl'}`}>
          {tiles.map((t, i) => (
            <button
              key={t.key}
              data-autofocus={i === 0 ? true : undefined}
              onClick={t.onClick}
              className={`group aspect-square rounded-[2.5rem] bg-gradient-to-br ${t.color} p-8 flex flex-col items-center justify-center gap-6 shadow-2xl transition-transform focus:outline-none focus:ring-8 focus:ring-white/80 focus:scale-105 hover:scale-105`}
            >
              <t.icon className="w-28 h-28 drop-shadow-lg" />
              <span className="carlmarx-bold text-4xl">{t.label}</span>
              <span className="text-white/80 text-lg">{t.hint}</span>
            </button>
          ))}
        </div>
      </main>

      {vipError && (
        <p className="text-center text-amber-300 pb-6">No se pudo abrir Ingreso VIP. Revisá en Ajustes que esté instalada y elegida.</p>
      )}

      {pinOpen && (
        <PinDialog
          onCancel={() => setPinOpen(false)}
          onSuccess={() => navigate('/box/ajustes')}
        />
      )}
    </div>
  );
}

function PinDialog({ onCancel, onSuccess }: { onCancel: () => void; onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useRemoteFocus(ref);

  const press = (digit: string) => {
    setError(false);
    const next = (pin + digit).slice(0, 8);
    setPin(next);
  };
  const submit = () => {
    if (pin === getBoxPin()) onSuccess();
    else {
      setError(true);
      setPin('');
    }
  };

  const keyClass = 'h-16 rounded-2xl bg-white/10 text-2xl font-bold hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-400';
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center">
      <div ref={ref} className="w-[22rem] rounded-3xl bg-[#121640] border border-white/15 p-6 space-y-4">
        <p className="text-center text-lg">Clave de ajustes</p>
        <p className="text-center font-mono text-4xl tracking-[0.5em] h-12">{'•'.repeat(pin.length)}</p>
        {error && <p className="text-center text-red-400">Clave incorrecta</p>}
        <div className="grid grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
            <button key={d} onClick={() => press(d)} className={keyClass}>{d}</button>
          ))}
          <button onClick={() => setPin(pin.slice(0, -1))} className={`${keyClass} flex items-center justify-center`} aria-label="Borrar">
            <Delete className="w-6 h-6" />
          </button>
          <button onClick={() => press('0')} className={keyClass}>0</button>
          <button onClick={submit} className="h-16 rounded-2xl text-lg font-bold bg-violet-600 hover:bg-violet-500 focus:outline-none focus:ring-4 focus:ring-cyan-400">OK</button>
        </div>
        <button onClick={onCancel} className="w-full py-3 rounded-2xl text-white/70 hover:text-white focus:outline-none focus:ring-4 focus:ring-cyan-400">
          Cancelar
        </button>
      </div>
    </div>
  );
}
