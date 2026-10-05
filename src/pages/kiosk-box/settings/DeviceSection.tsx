import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, AlertTriangle, Power, RefreshCw, Sparkles, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  checkinDevice, getAutostartStatus, getCachedDeviceState, openHomeAppSettings, openStartOnBootSettings, openWifiSettings,
  renameDevice, setBoxPin, type KioskDeviceState,
} from '@/lib/kioskDevice';
import { eventFolder } from '@/lib/kioskStorage';
import { formatArs, getCachedStore, loadStore, whatsappLink } from '@/lib/kioskStore';
import { buttonClass, inputClass, Panel, primaryClass } from './ui';

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

      <AutostartPanel />

      <Panel title="Internet">
        <button data-autofocus onClick={openWifiSettings} className={buttonClass}>
          <Wifi className="w-5 h-5" /> Configurar WiFi del equipo
        </button>
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
        <p className="text-white/60">Se configura en la app del equipo (versión 2 o más nueva).</p>
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
