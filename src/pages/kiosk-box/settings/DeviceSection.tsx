import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Download, Power, RefreshCw, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  calibrateTouch, canCalibrateTouch, checkinDevice, getAutostartStatus, getDiagnostics, getTapStabilize, isTouchCalibrated,
  resetTouchCalibration, setTapStabilize, TOUCH_CALIBRATED_EVENT, getCachedDeviceState, openHomeAppSettings, openStartOnBootSettings,
  renameDevice, setBoxPin, type KioskDeviceState, canSelfUpdate, checkForUpdate, startUpdate, canInstallUpdates,
  openInstallPermission, KIOSK_UPDATE_EVENT, type KioskUpdateStatus,
} from '@/lib/kioskDevice';
import { eventFolder } from '@/lib/kioskStorage';
import { formatArs, getCachedStore, loadStore, whatsappLink } from '@/lib/kioskStore';
import { buttonClass, inputClass, Panel, primaryClass, Toggle } from './ui';
import { BluetoothPanel, RemoteControlPanel, WifiPanel } from './NetPanels';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { applyLiteMode } from '@/lib/liteMode';

export default function DeviceSection() {
  const [device, setDevice] = useState<KioskDeviceState | null>(getCachedDeviceState);
  const [newPin, setNewPin] = useState('');
  const [version, setVersion] = useState('');
  const [store, setStore] = useState(getCachedStore);
  const [refreshing, setRefreshing] = useState(false);
  const [newName, setNewName] = useState(getCachedDeviceState()?.name || '');
  const [savingName, setSavingName] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try { setDevice(await checkinDevice()); } catch { toast.error('Sin conexión: se muestra el último saldo conocido'); }
    setRefreshing(false);
  };

  useEffect(() => {
    checkinDevice().then(d => { setDevice(d); setNewName(d.name || ''); }).catch(() => { /* sin conexión: queda el último estado */ });
    loadStore().then(setStore).catch(() => { /* sin conexión: precios guardados */ });
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.getInfo().then(info => setVersion(`${info.version} (${info.build})`)).catch(() => {});
    }
  }, []);

  const saveName = async () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (name.length > 60) { toast.error('El nombre puede tener hasta 60 caracteres'); return; }
    setSavingName(true);
    try {
      const saved = await renameDevice(name);
      setDevice(d => d ? { ...d, name: saved } : d);
      setNewName(saved || '');
      toast.success(saved ? `Equipo renombrado: ${saved}` : 'Se quitó el nombre del equipo');
    } catch (e) {
      toast.error(e instanceof Error && /no autorizado/i.test(e.message)
        ? 'El equipo todavía no está registrado: conectalo a internet y probá de nuevo'
        : `No se pudo cambiar el nombre${navigator.onLine ? `: ${e instanceof Error ? e.message : ''}` : ' (sin internet)'}`);
    }
    setSavingName(false);
  };

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
      <CreditsPanel credits={device?.aiCredits ?? null} account={device?.accountName ?? null} deviceCode={device?.deviceCode || ''}
        store={store} refreshing={refreshing} onRefresh={refresh} />

      <Panel title="Este equipo" description="El nombre del equipo es para reconocerlo en el panel (por ejemplo, el local o el dueño). El nombre del evento se cambia en Pantalla de inicio: es también la carpeta de las fotos (en el equipo y en Drive).">
        <div className="grid grid-cols-3 gap-4">
          <Info label="Código" value={device?.deviceCode || '—'} mono />
          <Info label="Nombre" value={device?.name || '—'} />
          <Info label="Carpeta del evento" value={eventFolder()} />
        </div>
        <div className="flex gap-3">
          <input className={inputClass} maxLength={60} placeholder="Nombre del equipo (ej. Salón Los Robles)" value={newName}
            onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveName(); }} />
          <button onClick={saveName} disabled={savingName || newName.trim() === (device?.name || '')} className={`${primaryClass} disabled:opacity-40`}>
            {savingName ? 'Guardando…' : 'Renombrar'}
          </button>
        </div>
        {version && <p className="text-white/40">Versión de la app: {version}</p>}
      </Panel>

      <UpdatePanel />

      <AutostartPanel />

      <WifiPanel />

      <BluetoothPanel />

      <RemoteControlPanel />

      <TouchPanel />

      <DiagnosticsPanel />

      <LitePanel />

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

/** Créditos de IA del cliente de este equipo y cómo comprar más (precios del panel). */
function CreditsPanel({ credits, account, deviceCode, store, refreshing, onRefresh }: {
  credits: number | null;
  account: string | null;
  deviceCode: string;
  store: ReturnType<typeof getCachedStore>;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const phone = store.contact_phone?.replace(/\D/g, '') || '';
  return (
    <Panel title="Créditos de IA" description="Cada foto con IA (retratos, portada, caricatura, figurita) usa 1 crédito. Las fotos clásicas son libres.">
      <div className="flex flex-wrap items-center gap-6">
        <div className="rounded-3xl bg-gradient-to-br from-[#ff2e93]/30 to-[#7b2ff7]/30 border border-white/15 px-8 py-5 text-center">
          <p className="text-white/60 text-sm uppercase tracking-widest">Disponibles</p>
          <p className={`text-6xl font-black ${credits === 0 ? 'text-red-300' : ''}`}>{credits == null ? '—' : credits}</p>
        </div>
        <div className="space-y-2">
          <p className="text-xl font-semibold"><Sparkles className="inline w-5 h-5 mr-2 text-[#ff7ac0]" />{account || 'Este equipo todavía no tiene cliente asignado'}</p>
          {credits === 0 && <p className="text-red-200">Sin créditos: las experiencias con IA avisan al invitado y la cabina clásica sigue funcionando.</p>}
          <button onClick={onRefresh} disabled={refreshing} className={buttonClass}>
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} /> Actualizar saldo
          </button>
        </div>
      </div>

      <div>
        <p className="text-lg font-bold mb-3">Comprar créditos</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {store.packs.map(p => (
            <div key={p.credits} className="rounded-2xl bg-black/25 border border-white/10 px-5 py-4 text-center">
              <p className="text-3xl font-black">{p.credits}</p>
              <p className="text-white/60 text-sm -mt-1 mb-2">créditos</p>
              <p className="text-xl font-bold">{formatArs(p.ars)}</p>
              <p className="text-white/60">USD {p.usd}</p>
            </div>
          ))}
        </div>
        {store.contact_note && <p className="text-white/50 text-sm mt-3">{store.contact_note}</p>}
      </div>

      {phone ? (
        <div className="flex flex-wrap items-center gap-6 rounded-2xl bg-black/25 border border-white/10 p-5">
          <div className="bg-white p-3 rounded-2xl"><QRCodeSVG value={whatsappLink(phone, deviceCode)} size={150} /></div>
          <div className="space-y-1">
            <p className="text-xl font-bold">Escaneá con el celular para pedirlos por WhatsApp</p>
            <p className="text-white/70">o escribí al <b className="text-white">+{phone}</b> con el código de este equipo: <b className="font-mono text-white">{deviceCode}</b></p>
            <p className="text-white/50 text-sm">Los créditos se cargan a tu cuenta y aparecen acá en un minuto.</p>
          </div>
        </div>
      ) : (
        <p className="text-white/60">Para comprar créditos, contactá a tu proveedor de EventPix con el código de este equipo: <b className="font-mono text-white">{deviceCode}</b></p>
      )}
    </Panel>
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

/** Que el kiosco se abra solo al prender el equipo (cortes de luz, reinicios). */
/** Actualizar la app desde el equipo, con la última versión publicada en GitHub. */
function UpdatePanel() {
  const [available] = useState(canSelfUpdate);
  const [status, setStatus] = useState<KioskUpdateStatus>({ state: 'idle' });
  const [permission, setPermission] = useState(canInstallUpdates);
  useEffect(() => {
    if (!available) return;
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<KioskUpdateStatus>).detail;
      // Se guardan las versiones aunque el evento nuevo no las traiga (p. ej. 'confirm')
      setStatus(prev => ({ ...prev, progress: undefined, message: undefined, ...detail }));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') setPermission(canInstallUpdates()); };
    window.addEventListener(KIOSK_UPDATE_EVENT, onUpdate);
    document.addEventListener('visibilitychange', onVisible);
    checkForUpdate();
    return () => {
      window.removeEventListener(KIOSK_UPDATE_EVENT, onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [available]);
  if (!available) return null;

  const { state, current, latest } = status;
  const busy = state === 'checking' || state === 'downloading' || state === 'installing';
  const message =
    state === 'idle' || state === 'checking' ? 'Buscando si hay una versión nueva…'
    : state === 'available' ? `Hay una versión nueva: ${latest?.name}`
    : state === 'up_to_date' ? `Tenés la última versión (${current?.name})`
    : state === 'downloading' ? `Descargando la versión ${latest?.name}… ${status.progress ?? 0}%`
    : state === 'installing' ? 'Verificada. Abriendo el instalador…'
    : state === 'confirm' ? 'Tocá "Instalar" (o "Actualizar") en el cartel de Android. La app se cierra y vuelve a abrir sola.'
    : `No se pudo actualizar: ${status.message || 'error'}`;
  const tone = state === 'available' || state === 'confirm' ? 'bg-sky-500/15 text-sky-200'
    : state === 'up_to_date' ? 'bg-emerald-500/15 text-emerald-200'
    : state === 'error' ? 'bg-amber-500/15 text-amber-200'
    : 'bg-black/20 text-white/80';

  return (
    <Panel title="Actualización" description="La app se fija sola si hay una versión nueva. La descarga, verifica que el archivo esté completo y sea el oficial, y abre la instalación: solo tenés que tocar Instalar. Se necesita internet; no se borran las fotos ni los ajustes.">
      <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${tone}`}>
        {state === 'up_to_date' ? <CheckCircle2 className="w-6 h-6 shrink-0" />
          : state === 'error' ? <AlertTriangle className="w-6 h-6 shrink-0" />
          : busy ? <RefreshCw className="w-6 h-6 shrink-0 animate-spin" />
          : <Download className="w-6 h-6 shrink-0" />}
        <p className="text-lg font-semibold">{message}</p>
      </div>
      {state === 'downloading' && (
        <div className="h-3 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-sky-400 transition-all" style={{ width: `${status.progress ?? 0}%` }} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {state === 'available' || (state === 'error' && latest && current && latest.code > current.code) ? (
          <button onClick={startUpdate} className={primaryClass}><Download className="w-5 h-5" /> Actualizar ahora</button>
        ) : (
          <button onClick={checkForUpdate} disabled={busy} className={`${buttonClass} disabled:opacity-40`}>
            <RefreshCw className="w-5 h-5" /> Buscar de nuevo
          </button>
        )}
        {permission === false && (
          <button onClick={openInstallPermission} className={buttonClass}>Permitir instalar actualizaciones</button>
        )}
      </div>
      {permission === false && (
        <p className="text-white/50">
          La primera vez Android puede pedir permiso para que <b className="text-white/80">EventPix Kiosco</b> instale actualizaciones
          ("Instalar apps desconocidas" / "Permitir de esta fuente"). Se activa una sola vez.
        </p>
      )}
      {current && <p className="text-white/40">Versión instalada: {current.name} ({current.code})</p>}
    </Panel>
  );
}

function AutostartPanel() {
  const [status, setStatus] = useState(getAutostartStatus);
  // Al volver de los ajustes de Android se revisa de nuevo
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') setStatus(getAutostartStatus()); };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  if (!status) {
    return (
      <Panel title="Arranque automático" description="Que el kiosco se abra solo al prender el equipo.">
        <p className="text-white/60">No se pudo leer el estado. Cerrá y volvé a abrir la app; si sigue igual, actualizala a la última versión.</p>
      </Panel>
    );
  }
  const ok = status.isHome || status.canStartOnBoot;
  return (
    <Panel title="Arranque automático" description="Si se corta la luz o se reinicia el equipo, el kiosco vuelve a aparecer solo, sin tocar nada.">
      <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${ok ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
        {ok ? <CheckCircle2 className="w-6 h-6 shrink-0" /> : <AlertTriangle className="w-6 h-6 shrink-0" />}
        <p className="text-lg font-semibold">
          {status.isHome ? 'Listo: el kiosco es la pantalla de inicio del equipo y arranca solo.'
            : status.canStartOnBoot ? 'Listo: el kiosco se abre solo al prender el equipo.'
            : 'Todavía no: al prender el equipo puede quedar en la pantalla de Android.'}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button onClick={openHomeAppSettings} className={status.isHome ? buttonClass : primaryClass}>
          <Power className="w-5 h-5" /> {status.isHome ? 'Cambiar pantalla de inicio' : 'Usar como pantalla de inicio (recomendado)'}
        </button>
        {!status.canStartOnBoot && (
          <button onClick={openStartOnBootSettings} className={buttonClass}>
            Permitir abrir al prender
          </button>
        )}
      </div>
      {!status.isHome && (
        <p className="text-white/50">
          En "Pantalla de inicio" elegí <b className="text-white/80">EventPix Kiosco</b> (si pregunta, "Siempre"). La otra opción es activar
          "Mostrar sobre otras apps" para EventPix Kiosco.
        </p>
      )}
    </Panel>
  );
}

// Motivos de cierre de Android (ApplicationExitInfo.REASON_*)
const EXIT_REASONS: Record<number, string> = {
  0: 'Motivo desconocido', 1: 'La app se cerró sola', 2: 'El sistema la cerró', 3: 'Falta de memoria',
  4: 'Error de la app', 5: 'Error interno (nativo)', 6: 'Se colgó (no respondía)', 7: 'No pudo arrancar',
  8: 'Cambio de permisos', 9: 'Usó demasiados recursos', 10: 'La cerró una persona', 11: 'La detuvo una persona',
  12: 'Se cerró otro proceso del que dependía', 13: 'Otro motivo', 14: 'Congelada por el sistema', 15: 'Se reinició el equipo',
};

const ago = (ms: number) => {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h ${min % 60} min` : `${Math.floor(h / 24)} días`;
};

/** Reinicios: cuánto hace que está prendido el equipo y por qué se cerró la app. */
function DiagnosticsPanel() {
  const [diag, setDiag] = useState(getDiagnostics);
  if (!diag) return null;
  return (
    <Panel title="Diagnóstico" description="Si el equipo o la app se reinician solos, esto ayuda a saber por qué. Sacale una foto y mandala al soporte.">
      <div className="grid grid-cols-3 gap-4">
        <Info label="Equipo prendido hace" value={ago(diag.uptimeMs)} />
        <Info label="App abierta hace" value={ago(diag.appUptimeMs)} />
        <Info label="Memoria libre" value={diag.memAvailMb != null ? `${diag.memAvailMb} de ${diag.memTotalMb} MB${diag.lowMemory ? ' (¡poca!)' : ''}` : '—'} />
      </div>
      {diag.exits.length > 0 ? (
        <div className="space-y-2">
          <p className="text-white/60">Últimos cierres de la app:</p>
          {diag.exits.map((e, i) => (
            <div key={i} className="rounded-xl bg-white/5 px-4 py-3">
              <p className="font-semibold">{new Date(e.time).toLocaleString('es-AR')} · {EXIT_REASONS[e.reason] ?? `Motivo ${e.reason}`}</p>
              {(e.description || e.pssMb > 0) && (
                <p className="text-white/50 text-sm break-words">{e.description}{e.pssMb > 0 ? ` · memoria usada ${e.pssMb} MB` : ''}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-white/50">Sin cierres registrados.</p>
      )}
      <button onClick={() => setDiag(getDiagnostics())} className={buttonClass}><RefreshCw className="w-5 h-5" /> Actualizar</button>
    </Panel>
  );
}

/** Marco táctil infrarrojo: el toque se toma donde se apoya el dedo. */
function TouchPanel() {
  const [on, setOn] = useState(getTapStabilize);
  const [calibrated, setCalibrated] = useState(isTouchCalibrated);
  useEffect(() => {
    const done = (e: Event) => {
      setCalibrated(isTouchCalibrated());
      if ((e as CustomEvent).detail) toast.success('Pantalla táctil calibrada');
      else toast.error('No salió bien: probá de nuevo tocando justo el centro de cada cruz');
    };
    window.addEventListener(TOUCH_CALIBRATED_EVENT, done);
    return () => window.removeEventListener(TOUCH_CALIBRATED_EVENT, done);
  }, []);
  if (on === null) return null;
  return (
    <Panel title="Marco táctil" description="Si el toque cae corrido, primero revisá que la tele no agrande la imagen (Imagen → Tamaño → Ajuste de pantalla / Just Scan / Píxel a píxel). Si sigue corrido, calibrá: aparece una cruz en cada esquina y tocás el centro de cada una.">
      {canCalibrateTouch() && (
        <>
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${calibrated ? 'bg-emerald-500/15 text-emerald-200' : 'bg-black/20 text-white/80'}`}>
            <p className="text-lg font-semibold">{calibrated ? 'Calibrada' : 'Sin calibrar'}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={calibrateTouch} className={primaryClass}>Calibrar pantalla táctil</button>
            {calibrated && (
              <button onClick={() => { resetTouchCalibration(); setCalibrated(false); toast.success('Calibración borrada'); }} className={buttonClass}>
                Borrar calibración
              </button>
            )}
          </div>
        </>
      )}
      <Toggle label="Estabilizar toques" hint={on ? 'El toque se toma donde se apoyó el dedo y se ignoran los toques dobles (rebote del marco).' : 'Desactivado: los toques llegan tal cual.'}
        checked={on} onChange={v => { setOn(v); setTapStabilize(v); }} />
    </Panel>
  );
}

/** Modo liviano: para probar si al equipo le pesan los efectos. */
function LitePanel() {
  const [on, setOn] = useState(() => getGeneralSettings().liteMode === true);
  return (
    <Panel title="Modo liviano" description="Si el equipo se traba, probalo: saca el efecto de vidrio esmerilado, las sombras y las animaciones de fondo, y la cámara en Automática pasa a HD (720p). Se ve un poco más simple pero anda más fluido.">
      <Toggle label="Usar modo liviano" hint={on ? 'Activado: menos efectos visuales.' : 'Desactivado: todos los efectos.'}
        checked={on} onChange={v => { setOn(v); saveGeneralSettings({ liteMode: v }); applyLiteMode(); }} />
    </Panel>
  );
}
