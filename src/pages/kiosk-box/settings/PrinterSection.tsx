import { useState } from 'react';
import { toast } from 'sonner';
import { Printer, RefreshCw } from 'lucide-react';
import {
  connectWifiDirectPrinter, discoverNativePrinters, isNativePrintAvailable, isPrintableDirect,
  printErrorMessage, printImageNative, PAPER_SIZES, type NativePrinter, type PaperSize,
} from '@/lib/nativePrint';
import { getPrintSettings, savePrintSettings } from '@/lib/kioskSettings';
import { buttonClass, Choice, inputClass, Panel, primaryClass, Toggle } from './ui';

export default function PrinterSection() {
  const [settings, setSettings] = useState(getPrintSettings);
  const [ssid, setSsid] = useState(settings.nativePrinter?.wifiDirect?.ssid || '');
  const [passphrase, setPassphrase] = useState(settings.nativePrinter?.wifiDirect?.passphrase || '');
  const [networkPrinters, setNetworkPrinters] = useState<NativePrinter[]>([]);
  const [busy, setBusy] = useState<'' | 'wifi' | 'scan' | 'test'>('');
  const native = isNativePrintAvailable();
  const printer = settings.nativePrinter;

  const update = (patch: Parameters<typeof savePrintSettings>[0]) => setSettings(savePrintSettings(patch));
  const choosePrinter = (p: NativePrinter | null) => update({ nativePrinter: p, selectedPrinter: p?.name || '' });

  const run = async (kind: 'wifi' | 'scan' | 'test', action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
    } catch (err) {
      toast.error(printErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const connectWifiDirect = () => run('wifi', async () => {
    const { printer: p, result } = await connectWifiDirectPrinter({ ssid: ssid.trim(), passphrase });
    choosePrinter(p);
    toast.success(result.mode === 'p2p'
      ? `Conectada a ${p.name} por Wi-Fi Direct${result.internet ? ', con internet' : ', pero sin internet'}`
      : `Conectada a ${p.name}. Este equipo no permite impresora e internet a la vez: al imprimir se desconecta de internet unos segundos.`);
    if (!isPrintableDirect(p)) toast.error(`La impresora no acepta un formato compatible (${p.pdl})`);
  });

  const scan = () => run('scan', async () => {
    const found = await discoverNativePrinters();
    setNetworkPrinters(found);
    if (!found.length) toast.info('No se encontraron impresoras en esta WiFi.');
  });

  const testPrint = () => run('test', async () => {
    const res = await printImageNative({
      image: '/ai-themes/jugador-seleccion.jpg',
      printer: printer || null,
      paper: settings.paper || '4x6',
      orientation: settings.orientation || 'portrait',
      rotation: settings.rotation || 0,
      scaleMode: settings.imageAdjust || 'cover',
      copies: 1,
      borderless: !!settings.borderless,
      jobName: 'EventPix - prueba',
    });
    if (res.mode === 'silent') toast.success('Prueba enviada a la impresora');
  });

  return (
    <div className="space-y-6">
      {!native && <p className="text-amber-300 text-lg">La impresión directa solo funciona en la app de Android.</p>}

      <Panel title="Impresora elegida">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-black/20 border border-white/10 px-6 py-5">
          <div>
            <p className="text-2xl font-bold">{printer?.name || 'Ninguna'}</p>
            {printer && (
              <p className="text-white/55">
                {printer.wifiDirect
                  ? (printer.wifiDirect.mode === 'temporary' ? 'Wi-Fi Direct · sin internet unos segundos al imprimir' : 'Wi-Fi Direct · impresora e internet a la vez')
                  : `En la red · ${printer.host}`}
              </p>
            )}
          </div>
          <button data-autofocus onClick={testPrint} disabled={!native || !!busy || !printer} className={primaryClass}>
            {busy === 'test' ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />} Imprimir prueba
          </button>
        </div>
      </Panel>

      <Panel title="Conectar por Wi-Fi Direct (sin router)" description="El nombre (DIRECT-…) y la clave están en la hoja de estado de red de la impresora.">
        <div className="grid grid-cols-2 gap-4">
          <input className={inputClass} placeholder="DIRECT-xx-EPSON-..." value={ssid} onChange={e => setSsid(e.target.value)} />
          <input className={inputClass} type="password" placeholder="Clave" value={passphrase} onChange={e => setPassphrase(e.target.value)} />
        </div>
        <button onClick={connectWifiDirect} disabled={!native || !!busy || !ssid.trim() || passphrase.length < 8} className={primaryClass}>
          {busy === 'wifi' && <RefreshCw className="w-5 h-5 animate-spin" />} Conectar y probar
        </button>
      </Panel>

      <Panel title="O buscar en la misma WiFi">
        <button onClick={scan} disabled={!native || !!busy} className={buttonClass}>
          <RefreshCw className={`w-5 h-5 ${busy === 'scan' ? 'animate-spin' : ''}`} /> Buscar impresoras
        </button>
        {networkPrinters.map(p => (
          <button key={p.serviceName} onClick={() => choosePrinter(p)}
            className={`w-full text-left rounded-2xl px-6 py-4 text-lg focus:outline-none focus:ring-4 focus:ring-cyan-400 ${printer?.serviceName === p.serviceName ? 'bg-violet-600' : 'bg-white/10 hover:bg-white/20'}`}>
            {p.name} — {p.host}{isPrintableDirect(p) ? '' : ' (formato no compatible)'}
          </button>
        ))}
      </Panel>

      <Panel title="Papel">
        <Choice label="Tamaño" value={settings.paper || '4x6'}
          options={PAPER_SIZES.map(p => ({ value: p.value, label: p.label }))}
          onChange={(paper: PaperSize) => update({ paper })} />
        <Toggle label="Sin bordes" hint="La foto ocupa toda la hoja (papel fotográfico 10×15)."
          checked={!!settings.borderless} onChange={borderless => update({ borderless })} />
        <Choice label="Copias por foto" value={settings.copies || 1}
          options={[1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))}
          onChange={copies => update({ copies })} />
      </Panel>
    </div>
  );
}
