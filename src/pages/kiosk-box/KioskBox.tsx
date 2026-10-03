import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Camera, Sparkles, Ticket, Wifi, Settings, Loader2, AlertTriangle, Images, WifiOff, type LucideIcon } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import PinDialog from '@/components/kiosk/PinDialog';
import {
  checkinDevice, getCachedDeviceState, getDeviceCode, getVipAppPackage,
  openAndroidApp, openWifiSettings, type KioskDeviceState,
} from '@/lib/kioskDevice';
import { getGeneralSettings, getSectionLock } from '@/lib/kioskSettings';
import { isSupabaseConfigured, supabaseProjectRef } from '@/lib/supabase';

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

const roundButton = 'kiosk-glass w-16 h-16 rounded-full flex items-center justify-center text-white/90 hover:text-white focus:outline-none focus:ring-4 focus:ring-[#00d4ff] transition-transform focus:scale-110';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(t);
  }, []);
  return now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function KioskBox() {
  const navigate = useNavigate();
  const [device, setDevice] = useState<KioskDeviceState | null>(() => getCachedDeviceState());
  const [offline, setOffline] = useState(false);
  // Motivo real de la falla (sin internet, sin configurar o error del servidor)
  const [problem, setProblem] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [vipError, setVipError] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const clock = useClock();

  const refresh = useCallback(async () => {
    try {
      setDevice(await checkinDevice(await appVersion()));
      setOffline(false);
      setProblem(null);
    } catch (e) {
      setOffline(true);
      if (!isSupabaseConfigured) setProblem('Esta versión de la app no tiene configurado el servidor de EventPix.');
      else if (typeof navigator !== 'undefined' && navigator.onLine === false) setProblem(null);
      else setProblem(`No responde el servidor: ${e instanceof Error ? e.message : String(e)}`);
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

  // Con una sección bloqueada (candado en el kiosco) el inicio no se muestra: se vuelve a ella
  useEffect(() => {
    const lock = getSectionLock();
    if (!lock || device?.pairingStatus !== 'linked') return;
    const params = new URLSearchParams({ modes: lock, home: '1' });
    if (device.kioskEventId) params.set('event', device.kioskEventId);
    navigate(`/kiosco?${params.toString()}`, { replace: true });
  }, [device?.pairingStatus, device?.kioskEventId, navigate]);

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
      <div ref={rootRef} className="relative min-h-screen overflow-hidden text-white">
        <AuroraBackground />
        <div className="relative min-h-screen flex flex-col items-center justify-center gap-10 p-10">
          <EventPixLogo size={72} subtitle="Kiosco" />
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 16 }}
            className="kiosk-glass rounded-[2.5rem] px-16 py-12 text-center"
          >
            <p className="text-xl text-white/70 uppercase tracking-[0.3em]">Código de este equipo</p>
            <p className="font-mono text-[clamp(4rem,11vw,8.5rem)] font-black tracking-[0.22em] mt-4 bg-gradient-to-r from-[#ff2e93] via-[#c86bff] to-[#00d4ff] bg-clip-text text-transparent">
              {code}
            </p>
            <p className="text-lg text-white/75 mt-6">
              En el panel de EventPix entrá a <b className="text-white">Kiosco IA → Equipos</b>,<br />cargá este código y elegí el evento.
            </p>
          </motion.div>
          <div className="flex items-center gap-3 text-white/70 text-lg">
            {offline ? (
              <>
                <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0" />
                <span className="max-w-3xl">{problem ?? 'Sin conexión a internet.'}</span>
                <button onClick={openWifiSettings} className="ml-2 kiosk-glass px-5 py-3 rounded-2xl font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
                  Configurar WiFi
                </button>
              </>
            ) : (
              <>
                <Loader2 className="w-6 h-6 animate-spin text-[#00d4ff]" />
                <span>Esperando que lo vincules…</span>
              </>
            )}
          </div>
          <p className="text-white/35 text-sm">Servidor: {supabaseProjectRef ?? 'sin configurar'}</p>
        </div>
      </div>
    );
  }

  // ─── Inicio ──────────────────────────────────────────────────────
  const general = getGeneralSettings();
  const aiEnabled = !general.offline && (['enableAI', 'enableMundial', 'enableCaricatura', 'enableFiguritas', 'enablePortada'] as const)
    .some(k => general[k] !== false);
  const tiles: { key: string; label: string; hint: string; icon: LucideIcon; gradient: string; glow: string; onClick: () => void }[] = [
    ...(general.enableSelfie !== false ? [{ key: 'fotos', label: 'Fotos', hint: 'Selfie con marco', icon: Camera, gradient: 'from-[#00d4ff] via-[#2b8cff] to-[#5b3bff]', glow: 'rgba(0,212,255,0.55)', onClick: () => openExperience('selfie') }] : []),
    ...(aiEnabled ? [{ key: 'ia', label: 'Fotos IA', hint: 'Retratos, Mundial y más', icon: Sparkles, gradient: 'from-[#ff2e93] via-[#c03bff] to-[#7b2ff7]', glow: 'rgba(255,46,147,0.55)', onClick: () => openExperience('ai') }] : []),
    ...(general.enableGallery ? [{ key: 'galeria', label: 'Galería', hint: 'Las fotos del evento', icon: Images, gradient: 'from-[#2ee6a6] via-[#00b3c7] to-[#2b6cff]', glow: 'rgba(46,230,166,0.5)', onClick: () => navigate('/box/galeria') }] : []),
    ...(vipPackage ? [{ key: 'vip', label: 'Ingreso VIP', hint: 'Acceso de invitados', icon: Ticket, gradient: 'from-[#ffd23f] via-[#ff9f1c] to-[#ff4d6d]', glow: 'rgba(255,159,28,0.55)', onClick: openVip }] : []),
  ];

  return (
    <div ref={rootRef} className="relative min-h-screen overflow-hidden text-white">
      <ScreenBackground screen="home" />
      <div className="relative min-h-screen flex flex-col">
        <header className="flex items-center justify-between px-12 pt-10">
          <EventPixLogo size={60} />
          <div className="kiosk-glass rounded-full px-8 py-3 text-center">
            <p className="text-white/60 text-xs uppercase tracking-[0.3em]">{device.name || `Equipo ${device.deviceCode}`}</p>
            <p className="text-xl font-bold">{device.eventName || 'Sin evento asignado'}</p>
          </div>
          <div className="flex items-center gap-4">
            {general.offline && (
              <span className="kiosk-glass rounded-full px-4 py-2 flex items-center gap-2 text-amber-200 text-sm font-semibold">
                <WifiOff className="w-4 h-4" /> Sin conexión
              </span>
            )}
            <span className="text-3xl font-light tabular-nums text-white/85 mr-2">{clock}</span>
            <button onClick={openWifiSettings} className={roundButton} aria-label="WiFi"><Wifi className="w-7 h-7" /></button>
            <button onClick={() => setPinOpen(true)} className={roundButton} aria-label="Ajustes"><Settings className="w-7 h-7" /></button>
          </div>
        </header>

        {!general.offline && (!device.kioskEventId || offline) && (
          <div className="mx-12 mt-6 kiosk-glass rounded-2xl px-6 py-3 flex items-center gap-3 text-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            {!device.kioskEventId
              ? 'Asigná un evento a este equipo desde el panel (Kiosco IA → Equipos) para que las fotos se guarden.'
              : 'Sin conexión: usando la última configuración guardada.'}
          </div>
        )}

        <main className="flex-1 flex items-center justify-center px-12">
          <div className={`flex ${tiles.length > 3 ? 'gap-12' : 'gap-20'}`}>
            {tiles.map((t, i) => (
              <motion.button
                key={t.key}
                data-autofocus={i === 0 ? true : undefined}
                onClick={t.onClick}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 140, damping: 15 }}
                className="group flex flex-col items-center gap-6 rounded-[3rem] p-4 focus:outline-none"
              >
                <span
                  className={`relative w-64 h-64 rounded-[4rem] bg-gradient-to-br ${t.gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-focus:scale-110 group-focus:-translate-y-2`}
                  style={{ boxShadow: `0 30px 70px -20px ${t.glow}, inset 0 2px 0 rgba(255,255,255,0.45)` }}
                >
                  {/* brillo de vidrio */}
                  <span className="absolute inset-x-6 top-4 h-1/2 rounded-[3rem] bg-gradient-to-b from-white/45 to-transparent" />
                  <span className="absolute inset-0 rounded-[4rem] ring-0 group-focus:ring-[6px] ring-white/90 transition-all" />
                  <t.icon className="relative w-32 h-32 text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]" strokeWidth={1.6} />
                </span>
                <span className="text-center">
                  <span className="block text-4xl font-black tracking-tight">{t.label}</span>
                  <span className="block text-lg text-white/65 mt-1">{t.hint}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </main>

        {vipError && (
          <p className="text-center text-amber-300 pb-6">No se pudo abrir Ingreso VIP. Revisá en Ajustes que esté instalada y elegida.</p>
        )}
      </div>

      {pinOpen && (
        <PinDialog
          onCancel={() => setPinOpen(false)}
          onSuccess={() => navigate('/box/ajustes')}
        />
      )}
    </div>
  );
}
