import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Printer, RefreshCw, Wifi, Ticket, KeyRound, Monitor } from 'lucide-react';
import { useRemoteFocus } from '@/hooks/use-remote-focus';
import {
  connectWifiDirectPrinter, discoverNativePrinters, isNativePrintAvailable, isPrintableDirect,
  printErrorMessage, printImageNative, PAPER_SIZES, type NativePrinter, type PaperSize,
} from '@/lib/nativePrint';
import {
  checkinDevice, getCachedDeviceState, getVipAppPackage, listInstalledApps, openWifiSettings,
  setBoxPin, setVipAppPackage, type InstalledApp, type KioskDeviceState,
} from '@/lib/kioskDevice';

// Ajustes del equipo (TV box), detrás del PIN del inicio. Se guardan en el
// equipo: la impresora en 'kiosk_print_settings', que es lo que lee el kiosco.

const PRINT_KEY = 'kiosk_print_settings';

interface PrintSettings {
  nativePrinter?: NativePrinter | null;
  selectedPrinter?: string;
  paper?: PaperSize;
  borderless?: boolean;
  copies?: number;
  autoPrint?: boolean;
  imageAdjust?: 'cover' | 'contain' | 'fill';
  orientation?: 'portrait' | 'landscape';
  rotation?: number;
}

const loadPrintSettings = (): PrintSettings => {
  try {
    return JSON.parse(localStorage.getItem(PRINT_KEY) || '{}');
  } catch {
    return {};
  }
};

const inputClass = 'w-full rounded-xl bg-black/30 border border-white/15 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:ring-4 focus:ring-cyan-400';
const buttonClass = 'flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold bg-white/10 hover:bg-white/20 focus:bg-white/25 focus:outline-none focus:ring-4 focus:ring-cyan-400 disabled:opacity-40';
const primaryClass = 'flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold bg-violet-600 hover:bg-violet-500 focus:outline-none focus:ring-4 focus:ring-cyan-400 disabled:opacity-40';

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/5 border border-white/10 p-6 space-y-4">
      <h2 className="flex items-center gap-3 text-xl font-bold">{icon}{title}</h2>
      {children}
    </section>
  );
}

export default function KioskBoxSettings() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<PrintSettings>(loadPrintSettings);
  const [device, setDevice] = useState<KioskDeviceState | null>(getCachedDeviceState);
  const [ssid, setSsid] = useState(settings.nativePrinter?.wifiDirect?.ssid || '');
  const [passphrase, setPassphrase] = useState(settings.nativePrinter?.wifiDirect?.passphrase || '');
  const [networkPrinters, setNetworkPrinters] = useState<NativePrinter[]>([]);
  const [busy, setBusy] = useState<'' | 'wifi' | 'scan' | 'test'>('');
  const [apps] = useState<InstalledApp[]>(listInstalledApps);
  const [vipPackage, setVip] = useState(getVipAppPackage);
  const [newPin, setNewPin] = useState('');
  const native = isNativePrintAvailable();

  useRemoteFocus(rootRef);

  useEffect(() => {
    checkinDevice().then(setDevice).catch(() => { /* sin conexión: queda el último estado */ });
  }, []);

  // Se guarda al instante: no hay botón "Guardar" que olvidarse de tocar
  const update = (patch: Partial<PrintSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      localStorage.setItem(PRINT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const choosePrinter = (printer: NativePrinter | null) =>
    update({ nativePrinter: printer, selectedPrinter: printer?.name || '' });

  const connectWifiDirect = async () => {
    setBusy('wifi');
    try {
      const { printer, result } = await connectWifiDirectPrinter({ ssid: ssid.trim(), passphrase });
      choosePrinter(printer);
      if (result.mode === 'p2p') {
        toast.success(`Conectada a ${printer.name} por Wi-Fi Direct${result.internet ? ', con internet' : ', pero sin internet'}`);
      } else {
        toast.success(`Conectada a ${printer.name}. Este equipo no permite impresora e internet a la vez: al imprimir se desconecta de internet unos segundos.`);
      }
      if (!isPrintableDirect(printer)) toast.error(`La impresora no acepta un formato compatible (${printer.pdl})`);
    } catch (err) {
      toast.error(printErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const scanNetwork = async () => {
    setBusy('scan');
    try {
      const found = await discoverNativePrinters();
      setNetworkPrinters(found);
      if (!found.length) toast.info('No se encontraron impresoras en esta WiFi.');
    } catch (err) {
      toast.error(printErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const testPrint = async () => {
    setBusy('test');
    try {
      const res = await printImageNative({
        image: '/ai-themes/jugador-seleccion.jpg',
        printer: settings.nativePrinter || null,
        paper: settings.paper || '4x6',
        orientation: settings.orientation || 'portrait',
        rotation: settings.rotation || 0,
        scaleMode: settings.imageAdjust || 'cover',
        copies: 1,
        borderless: !!settings.borderless,
        jobName: 'EventPix - prueba',
      });
      if (res.mode === 'silent') toast.success('Prueba enviada a la impresora');
    } catch (err) {
      toast.error(printErrorMessage(err));
    } finally {
      setBusy('');
    }
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

  const printer = settings.nativePrinter;

  return (
    <div ref={rootRef} className="min-h-screen bg-gradient-to-br from-[#0b1026] via-[#151a4a] to-[#3b0f5c] text-white">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Ajustes del equipo</h1>
          <button onClick={() => navigate('/box')} className={buttonClass}>
            <ArrowLeft className="w-5 h-5" /> Volver al inicio
          </button>
        </header>

        <Section icon={<Monitor className="w-6 h-6 text-cyan-300" />} title="Equipo">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><p className="text-white/50">Código</p><p className="font-mono text-2xl">{device?.deviceCode || '—'}</p></div>
            <div><p className="text-white/50">Nombre</p><p className="text-lg">{device?.name || '—'}</p></div>
            <div><p className="text-white/50">Evento</p><p className="text-lg">{device?.eventName || 'Sin evento'}</p></div>
          </div>
          <p className="text-white/50 text-sm">El nombre y el evento se cambian desde el panel: Kiosco IA → Equipos.</p>
          <button onClick={openWifiSettings} className={buttonClass}><Wifi className="w-5 h-5" /> Configurar WiFi del equipo</button>
        </Section>

        <Section icon={<Printer className="w-6 h-6 text-violet-300" />} title="Impresora">
          {!native && <p className="text-amber-300">La impresión directa solo funciona en la app de Android.</p>}
          <p className="text-white/70">
            Elegida: <b>{printer?.name || 'ninguna'}</b>
            {printer?.wifiDirect && (printer.wifiDirect.mode === 'temporary'
              ? ' · Wi-Fi Direct (temporal: sin internet unos segundos al imprimir)'
              : ' · Wi-Fi Direct (impresora e internet a la vez)')}
          </p>

          <div className="space-y-3">
            <p className="font-semibold">Por Wi-Fi Direct (sin router)</p>
            <p className="text-white/50 text-sm">El nombre (DIRECT-…) y la clave están en la hoja de estado de red de la impresora.</p>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} placeholder="DIRECT-xx-EPSON-..." value={ssid} onChange={e => setSsid(e.target.value)} />
              <input className={inputClass} type="password" placeholder="Clave" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
            </div>
            <button onClick={connectWifiDirect} disabled={!native || !!busy || !ssid.trim() || passphrase.length < 8} className={primaryClass}>
              {busy === 'wifi' && <RefreshCw className="w-5 h-5 animate-spin" />} Conectar y probar
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <p className="font-semibold">O en la misma WiFi</p>
            <button onClick={scanNetwork} disabled={!native || !!busy} className={buttonClass}>
              {busy === 'scan' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />} Buscar impresoras
            </button>
            {networkPrinters.map(p => (
              <button key={p.serviceName} onClick={() => choosePrinter(p)} className={`${buttonClass} w-full justify-start`}>
                {p.name} — {p.host}{isPrintableDirect(p) ? '' : ' (formato no compatible)'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <label className="space-y-1">
              <span className="text-white/60 text-sm">Papel</span>
              <select className={inputClass} value={settings.paper || '4x6'} onChange={e => update({ paper: e.target.value as PaperSize })}>
                {PAPER_SIZES.map(p => <option key={p.value} value={p.value} className="bg-[#121640]">{p.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-white/60 text-sm">Copias por foto</span>
              <select className={inputClass} value={settings.copies || 1} onChange={e => update({ copies: Number(e.target.value) })}>
                {[1, 2, 3, 4].map(n => <option key={n} value={n} className="bg-[#121640]">{n}</option>)}
              </select>
            </label>
            <button onClick={() => update({ borderless: !settings.borderless })} className={settings.borderless ? primaryClass : buttonClass}>
              Sin bordes: {settings.borderless ? 'Sí' : 'No'}
            </button>
            <button onClick={() => update({ autoPrint: !settings.autoPrint })} className={settings.autoPrint ? primaryClass : buttonClass}>
              Imprimir automáticamente: {settings.autoPrint ? 'Sí' : 'No'}
            </button>
          </div>

          <button onClick={testPrint} disabled={!native || !!busy || !printer} className={`${primaryClass} w-full`}>
            {busy === 'test' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />} Imprimir prueba
          </button>
        </Section>

        <Section icon={<Ticket className="w-6 h-6 text-amber-300" />} title="Ingreso VIP">
          <p className="text-white/50 text-sm">Elegí la app que abre el ícono "Ingreso VIP" del inicio. Si no elegís ninguna, el ícono no aparece.</p>
          <select className={inputClass} value={vipPackage} onChange={e => { setVip(e.target.value); setVipAppPackage(e.target.value); }}>
            <option value="" className="bg-[#121640]">Ninguna</option>
            {apps.map(a => <option key={a.packageName} value={a.packageName} className="bg-[#121640]">{a.label}</option>)}
          </select>
        </Section>

        <Section icon={<KeyRound className="w-6 h-6 text-emerald-300" />} title="Clave de ajustes">
          <div className="flex gap-3">
            <input className={inputClass} inputMode="numeric" placeholder="Nueva clave (4 a 8 números)" value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
            <button onClick={savePin} className={primaryClass}>Cambiar</button>
          </div>
        </Section>
      </div>
    </div>
  );
}
