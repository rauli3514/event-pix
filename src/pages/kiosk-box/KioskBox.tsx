import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Sparkles, Ticket, Wifi, Settings, Loader2, AlertTriangle, Images, WifiOff, type LucideIcon } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import PinDialog from '@/components/kiosk/PinDialog';
import {
  checkinDevice, getAppVersion, getCachedDeviceState, getDeviceCode,
  openWifiSettings, type KioskDeviceState,
} from '@/lib/kioskDevice';
import { getGeneralSettings, getSectionLock } from '@/lib/kioskSettings';
import { isSupabaseConfigured, supabaseProjectRef } from '@/lib/supabase';
import { startDriveSync } from '@/lib/driveBackup';
import { getDeviceRole } from '@/lib/kioskLink';

// Inicio de la app "EventPix Kiosco" en la TV box: sin login. Si el equipo no
// está vinculado muestra su código para registrarlo en el panel; si lo está,
// muestra los íconos de cada experiencia. Ajustes queda detrás de un PIN.

const PENDING_POLL_MS = 8000;
const LINKED_POLL_MS = 60000;

const appVersion = getAppVersion;

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
  // Este equipo es la tablet que maneja otra pantalla: va directo al control
  useEffect(() => {
    if (getDeviceRole() === 'remote') navigate('/control', { replace: true });
  }, [navigate]);
  const [device, setDevice] = useState<KioskDeviceState | null>(() => getCachedDeviceState());
  const [offline, setOffline] = useState(false);
  // Motivo real de la falla (sin internet, sin configurar o error del servidor)
  const [problem, setProblem] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
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
    if (lock === 'vip') { navigate('/box/vip', { replace: true }); return; }
    const params = new URLSearchParams({ modes: lock, home: '1' });
    if (device.kioskEventId) params.set('event', device.kioskEventId);
    navigate(`/kiosco?${params.toString()}`, { replace: true });
  }, [device?.pairingStatus, device?.kioskEventId, navigate]);

  // Fotos pendientes de subir a Drive: se reintentan mientras la app está abierta
  useEffect(() => { startDriveSync(); }, []);

  // Con el PIN abierto, el foco lo maneja el diálogo
  useRemoteFocus(rootRef, [device?.pairingStatus], !pinOpen);

  const openExperience = (modes: 'selfie' | 'ai') => {
    const params = new URLSearchParams({ modes, home: '1' });
    if (device?.kioskEventId) params.set('event', device.kioskEventId);
    navigate(`/kiosco?${params.toString()}`);
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
              En el panel de EventPix entrá a <b className="text-white">Kioscos → Vincular</b>,<br />cargá este código y elegí el evento.
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
  const aiEnabled = !general.offline && ((['enableAI', 'enablePortadaAI', 'enableCaricatura', 'enableFiguritas'] as const)
    .some(k => general[k] !== false) || general.enableMundial === true);
  const tiles: { key: string; label: string; hint: string; icon: LucideIcon; gradient: string; glow: string; onClick: () => void }[] = [
    ...(general.enableSelfie !== false ? [{ key: 'fotos', label: 'Fotos', hint: general.enablePortada ? 'Selfie y Portada Fashion' : 'Selfie con marco', icon: Camera, gradient: 'from-[#00d4ff] via-[#2b8cff] to-[#5b3bff]', glow: 'rgba(0,212,255,0.55)', onClick: () => openExperience('selfie') }] : []),
    ...(aiEnabled ? [{ key: 'ia', label: 'Fotos IA', hint: 'Retratos, caricaturas y más', icon: Sparkles, gradient: 'from-[#ff2e93] via-[#c03bff] to-[#7b2ff7]', glow: 'rgba(255,46,147,0.55)', onClick: () => openExperience('ai') }] : []),
    ...(general.enableGallery ? [{ key: 'galeria', label: 'Galería', hint: 'Las fotos del evento', icon: Images, gradient: 'from-[#2ee6a6] via-[#00b3c7] to-[#2b6cff]', glow: 'rgba(46,230,166,0.5)', onClick: () => navigate('/box/galeria') }] : []),
    ...(general.enableVip ? [{ key: 'vip', label: 'Ingreso VIP', hint: 'Buscá tu mesa', icon: Ticket, gradient: 'from-[#ffd23f] via-[#ff9f1c] to-[#ff4d6d]', glow: 'rgba(255,159,28,0.55)', onClick: () => navigate('/box/vip') }] : []),
  ];

  return (
    <div ref={rootRef} className="relative min-h-screen overflow-hidden text-white">
      <ScreenBackground screen="home" brand={false} />
      <div className="relative min-h-screen flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-[5vmin] pt-[4vmin]">
          <EventPixLogo size={60} />
          <div className="kiosk-glass rounded-full px-8 py-3 text-center portrait:order-last portrait:basis-full portrait:rounded-3xl">
            <p className="text-white/60 text-xs uppercase tracking-[0.3em]">{device.name || `Equipo ${device.deviceCode}`}</p>
            <p className="text-xl font-bold">{general.eventTitle || device.eventName || 'Sin nombre de evento'}</p>
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

        {/* El equipo es autónomo: el evento es el nombre que se pone en Ajustes (no hace falta el panel) */}
        {!general.offline && (offline || (!general.eventTitle && !general.localFolder && !device.kioskEventId)) && (
          <div className="mx-12 mt-6 kiosk-glass rounded-2xl px-6 py-3 flex items-center gap-3 text-amber-100">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            {offline
              ? 'Sin conexión: usando la última configuración guardada.'
              : 'Poné el nombre del evento en Ajustes → Pantalla de inicio: es la carpeta donde se guardan las fotos.'}
          </div>
        )}

        <main className="flex-1 flex items-center justify-center px-[4vmin] py-[3vmin]">
          {/* Tamaños en vmin: entran igual con la tele horizontal o vertical */}
          <div className={`flex flex-wrap justify-center ${tiles.length > 3 ? 'gap-[3vmin]' : 'gap-[5vmin]'} portrait:gap-[4vmin]`}>
            {tiles.map((t, i) => (
              <motion.button
                key={t.key}
                data-autofocus={i === 0 ? true : undefined}
                onClick={t.onClick}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1, type: 'spring', stiffness: 140, damping: 15 }}
                className="group flex flex-col items-center gap-[2.5vmin] rounded-[3rem] p-[1.5vmin] focus:outline-none"
              >
                <span
                  className={`relative w-[min(16rem,24vmin)] h-[min(16rem,24vmin)] portrait:w-[34vmin] portrait:h-[34vmin] rounded-[25%] bg-gradient-to-br ${t.gradient} flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-focus:scale-110 group-focus:-translate-y-2`}
                  style={{ boxShadow: `0 30px 70px -20px ${t.glow}, inset 0 2px 0 rgba(255,255,255,0.45)` }}
                >
                  {/* brillo de vidrio */}
                  <span className="absolute inset-x-[9%] top-[6%] h-1/2 rounded-[20%] bg-gradient-to-b from-white/45 to-transparent" />
                  <span className="absolute inset-0 rounded-[25%] ring-0 group-focus:ring-[6px] ring-white/90 transition-all" />
                  <t.icon className="relative w-1/2 h-1/2 text-white drop-shadow-[0_6px_14px_rgba(0,0,0,0.35)]" strokeWidth={1.6} />
                </span>
                <span className="text-center max-w-[36vmin]">
                  <span className="block text-[clamp(1.4rem,4.2vmin,2.25rem)] font-black tracking-tight leading-tight">{t.label}</span>
                  <span className="block text-[clamp(0.9rem,2.2vmin,1.125rem)] text-white/65 mt-1">{t.hint}</span>
                </span>
              </motion.button>
            ))}
          </div>
        </main>

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
