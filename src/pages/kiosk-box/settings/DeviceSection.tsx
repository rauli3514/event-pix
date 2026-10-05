import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Sparkles, Wifi } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import {
  checkinDevice, getCachedDeviceState, getVipAppPackage, listInstalledApps, openWifiSettings,
  setBoxPin, setVipAppPackage, type KioskDeviceState,
} from '@/lib/kioskDevice';
import { eventFolder } from '@/lib/kioskStorage';
import { formatArs, getCachedStore, loadStore, whatsappLink } from '@/lib/kioskStore';
import { buttonClass, inputClass, Panel, primaryClass } from './ui';

export default function DeviceSection() {
  const [device, setDevice] = useState<KioskDeviceState | null>(getCachedDeviceState);
  const [apps] = useState(listInstalledApps);
  const [vipPackage, setVip] = useState(getVipAppPackage);
  const [newPin, setNewPin] = useState('');
  const [version, setVersion] = useState('');
  const [store, setStore] = useState(getCachedStore);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    try { setDevice(await checkinDevice()); } catch { toast.error('Sin conexión: se muestra el último saldo conocido'); }
    setRefreshing(false);
  };

  useEffect(() => {
    checkinDevice().then(setDevice).catch(() => { /* sin conexión: queda el último estado */ });
    loadStore().then(setStore).catch(() => { /* sin conexión: precios guardados */ });
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
      <CreditsPanel credits={device?.aiCredits ?? null} account={device?.accountName ?? null} deviceCode={device?.deviceCode || ''}
        store={store} refreshing={refreshing} onRefresh={refresh} />

      <Panel title="Este equipo" description="El nombre del evento se cambia en Pantalla de inicio: es también la carpeta de las fotos (en el equipo y en Drive).">
        <div className="grid grid-cols-3 gap-4">
          <Info label="Código" value={device?.deviceCode || '—'} mono />
          <Info label="Nombre" value={device?.name || '—'} />
          <Info label="Carpeta del evento" value={eventFolder()} />
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
              className={`text-left rounded-2xl px-5 py-3 text-lg focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${vipPackage === a.packageName ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10 hover:bg-white/20'}`}>
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
