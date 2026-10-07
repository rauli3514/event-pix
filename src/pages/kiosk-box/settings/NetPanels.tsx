import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Bluetooth, Keyboard, Loader2, Lock, Printer, Smartphone, Speaker, Tablet, Wifi, WifiOff } from 'lucide-react';
import { openWifiSettings } from '@/lib/kioskDevice';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { KioskLink, linkAvailable, REMOTE_HOST_EVENT, type LinkState } from '@/lib/kioskLink';
import { errorText, KioskNet, netAvailable, type BtDevice, type BtStatus, type WifiNetwork, type WifiStatus } from '@/lib/kioskNet';
import { buttonClass, inputClass, Panel, primaryClass, Toggle } from './ui';

// WiFi y Bluetooth desde Ajustes → Equipo: sin entrar a los ajustes de Android, que con
// la tele vertical se ven de costado.

const POLL_MS = 2000;
const POLL_TRIES = 15;

function Bars({ n }: { n: number }) {
  return (
    <span className="flex items-end gap-0.5 h-4" aria-label={`Señal ${n} de 4`}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className={`w-1 rounded-sm ${i <= n ? 'bg-white' : 'bg-white/25'}`} style={{ height: `${i * 25}%` }} />
      ))}
    </span>
  );
}

export function WifiPanel() {
  const available = netAvailable();
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [locationOff, setLocationOff] = useState(false);
  const [selected, setSelected] = useState<WifiNetwork | null>(null);
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [hint, setHint] = useState('');
  const polls = useRef(0);

  const refresh = useCallback(async () => {
    if (!available) return null;
    try {
      const s = await KioskNet.wifiStatus();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, [available]);

  useEffect(() => {
    const t = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const scan = async () => {
    setScanning(true);
    setHint('');
    try {
      const r = await KioskNet.wifiScan();
      setNetworks(r.networks.slice(0, 20));
      setLocationOff(r.locationOff);
    } catch (e) {
      toast.error(errorText(e));
    }
    setScanning(false);
  };

  const connect = async () => {
    if (!selected) return;
    if (selected.security !== 'open' && password.length < 8) {
      toast.error('La clave del WiFi tiene al menos 8 caracteres');
      return;
    }
    setConnecting(true);
    try {
      const r = await KioskNet.wifiConnect({ ssid: selected.ssid, password, security: selected.security });
      setHint(r.method === 'dialog'
        ? 'Android muestra un cartel con la red: tocá "Guardar" (o "Conectar"). Después vuelve solo acá.'
        : r.method === 'suggestion'
          ? 'Red guardada: el equipo se conecta en unos segundos. Si Android muestra un aviso, aceptalo.'
          : 'Conectando…');
      // Se espera a que el equipo quede conectado a esa red
      polls.current = 0;
      const tick = async () => {
        const s = await refresh();
        if (s?.connected && s.ssid === selected.ssid) {
          toast.success(`Conectado a ${selected.ssid}`);
          setSelected(null);
          setPassword('');
          setHint('');
          setConnecting(false);
          return;
        }
        if (++polls.current < POLL_TRIES) window.setTimeout(tick, POLL_MS);
        else setConnecting(false);
      };
      window.setTimeout(tick, POLL_MS);
    } catch (e) {
      toast.error(errorText(e));
      setConnecting(false);
    }
  };

  if (!available) {
    return (
      <Panel title="Internet (WiFi)" description="Desde la APK 2.1 el WiFi se configura acá mismo.">
        <button data-autofocus onClick={openWifiSettings} className={buttonClass}>
          <Wifi className="w-5 h-5" /> Abrir WiFi de Android
        </button>
      </Panel>
    );
  }

  return (
    <Panel title="Internet (WiFi)" description="Elegí la red y escribí la clave, sin salir de la app.">
      <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${status?.connected ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>
        {status?.connected ? <Wifi className="w-6 h-6 shrink-0" /> : <WifiOff className="w-6 h-6 shrink-0" />}
        <p className="text-lg font-semibold">
          {!status ? 'Revisando…'
            : status.connected
              ? `${status.ethernet ? 'Conectado por cable' : `Conectado${status.ssid ? ` a ${status.ssid}` : ''}`}${status.internet ? ' · con internet' : ' · sin internet'}`
              : status.enabled ? 'Sin conexión' : 'WiFi apagado'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button data-autofocus onClick={scan} disabled={scanning} className={primaryClass}>
          {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wifi className="w-5 h-5" />} {scanning ? 'Buscando redes…' : 'Buscar redes'}
        </button>
        <button onClick={openWifiSettings} className={buttonClass}>Ajustes de Android</button>
      </div>

      {locationOff && (
        <p className="text-amber-300">Android necesita la <b>ubicación</b> activada para mostrar las redes. Activala en los ajustes de Android (Ubicación) y buscá de nuevo.</p>
      )}

      {networks && (
        <div className="space-y-2 max-h-[28rem] overflow-y-auto p-1">
          {networks.length === 0 && <p className="text-white/60">No se encontraron redes. Probá de nuevo en unos segundos.</p>}
          {networks.map(n => (
            <div key={n.ssid} className={`rounded-2xl border ${selected?.ssid === n.ssid ? 'border-[#00d4ff] bg-white/10' : 'border-white/10 bg-black/20'}`}>
              <button onClick={() => { setSelected(n); setPassword(''); setHint(''); }}
                className="w-full flex items-center gap-4 px-5 py-3 text-left text-lg focus:outline-none focus:ring-4 focus:ring-[#00d4ff] rounded-2xl">
                <Bars n={n.bars} />
                <span className="flex-1 font-semibold truncate">{n.ssid}</span>
                {n.security !== 'open' && <Lock className="w-4 h-4 text-white/60" />}
                {status?.ssid === n.ssid && status.connected && <span className="text-emerald-300 text-sm">Conectado</span>}
              </button>
              {selected?.ssid === n.ssid && (
                <div className="px-5 pb-4 space-y-3">
                  {n.security === 'wep' || n.security === 'enterprise' ? (
                    <p className="text-amber-300">Esta red se configura desde "Ajustes de Android".</p>
                  ) : (
                    <>
                      {n.security !== 'open' && (
                        <input className={inputClass} type="text" autoComplete="off" placeholder="Clave del WiFi" value={password}
                          onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void connect(); }} />
                      )}
                      <button onClick={connect} disabled={connecting} className={`${primaryClass} w-full`}>
                        {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : null} {connecting ? 'Conectando…' : 'Conectar'}
                      </button>
                    </>
                  )}
                  {hint && <p className="text-white/75">{hint}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

const KIND_ICON = { input: Keyboard, audio: Speaker, phone: Smartphone, printer: Printer, computer: Smartphone, other: Bluetooth } as const;

function Item({ d, action }: { d: BtDevice; action: ReactNode }) {
  const Icon = KIND_ICON[d.kind] ?? Bluetooth;
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-black/20 border border-white/10 px-5 py-3">
      <Icon className="w-5 h-5 text-white/70 shrink-0" />
      <span className="flex-1 text-lg font-semibold truncate">{d.name}</span>
      {action}
    </div>
  );
}

export function BluetoothPanel() {
  const available = netAvailable();
  const [status, setStatus] = useState<BtStatus | null>(null);
  const [found, setFound] = useState<BtDevice[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pairing, setPairing] = useState<string | null>(null);
  const [locationOff, setLocationOff] = useState(false);

  const refresh = useCallback(async () => {
    if (!available) return null;
    try {
      const s = await KioskNet.btStatus();
      setStatus(s);
      return s;
    } catch {
      return null;
    }
  }, [available]);

  useEffect(() => {
    const t = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(t);
  }, [refresh]);

  const enable = async () => {
    try {
      await KioskNet.btEnable();
      window.setTimeout(() => { void refresh(); }, 2500);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await KioskNet.btScan();
      const bonded = new Set((status?.bonded ?? []).map(d => d.address));
      setFound(r.devices.filter(d => !bonded.has(d.address)).sort((a, b) => Number(b.name !== b.address) - Number(a.name !== a.address)));
      setLocationOff(r.locationOff);
    } catch (e) {
      toast.error(errorText(e));
    }
    setScanning(false);
  };

  const pair = async (d: BtDevice) => {
    setPairing(d.address);
    try {
      await KioskNet.btPair({ address: d.address });
      let tries = 0;
      const tick = async () => {
        const s = await refresh();
        if (s?.bonded?.some(b => b.address === d.address)) {
          toast.success(`${d.name} vinculado`);
          setFound(f => f?.filter(x => x.address !== d.address) ?? null);
          setPairing(null);
          return;
        }
        if (++tries < POLL_TRIES) window.setTimeout(tick, POLL_MS);
        else { setPairing(null); toast.error('No se pudo vincular. Revisá que esté en modo vinculación y probá de nuevo.'); }
      };
      window.setTimeout(tick, POLL_MS);
    } catch (e) {
      toast.error(errorText(e));
      setPairing(null);
    }
  };

  const unpair = async (d: BtDevice) => {
    try {
      await KioskNet.btUnpair({ address: d.address });
      window.setTimeout(() => { void refresh(); }, 1500);
    } catch (e) {
      toast.error(`${errorText(e)}: hacelo desde "Ajustes de Android"`);
    }
  };

  if (!available) {
    return (
      <Panel title="Bluetooth" description="Desde la APK 2.1 los dispositivos Bluetooth (disparador, parlante) se vinculan acá mismo.">
        <p className="text-white/60">Se configura en la app del equipo.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Bluetooth" description='Para el disparador de fotos o un parlante. Poné el dispositivo en modo vinculación (en general, mantené apretado su botón hasta que titile) y tocá "Buscar".'>
      {status && !status.supported && <p className="text-white/60">Este equipo no tiene Bluetooth.</p>}
      {status?.supported && !status.enabled && (
        <button onClick={enable} className={primaryClass}><Bluetooth className="w-5 h-5" /> Prender Bluetooth</button>
      )}
      {status?.enabled && (
        <>
          {!!status.bonded?.length && (
            <div className="space-y-2">
              <p className="text-white/60">Vinculados</p>
              {status.bonded.map(d => (
                <Item key={d.address} d={d} action={
                  <button onClick={() => unpair(d)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">Quitar</button>
                } />
              ))}
            </div>
          )}
          <button onClick={scan} disabled={scanning} className={primaryClass}>
            {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bluetooth className="w-5 h-5" />} {scanning ? 'Buscando (unos 12 s)…' : 'Buscar dispositivos'}
          </button>
          {locationOff && <p className="text-amber-300">Android necesita la <b>ubicación</b> activada para buscar dispositivos Bluetooth.</p>}
          {found && (
            <div className="space-y-2">
              {found.length === 0 && <p className="text-white/60">No se encontraron dispositivos. ¿Está en modo vinculación?</p>}
              {found.map(d => (
                <Item key={d.address} d={d} action={
                  <button onClick={() => pair(d)} disabled={!!pairing}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] font-semibold disabled:opacity-50 focus:outline-none focus:ring-4 focus:ring-[#00d4ff]">
                    {pairing === d.address ? 'Vinculando…' : 'Vincular'}
                  </button>
                } />
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** Control con tablet por Bluetooth: esta pantalla la maneja una tablet con la app EventPix Control. */
export function RemoteControlPanel() {
  const available = linkAvailable();
  const [on, setOn] = useState(() => getGeneralSettings().remoteHost === true);
  const [name, setName] = useState('');
  const [link, setLink] = useState<{ state: LinkState; name?: string } | null>(null);
  const [hostInfo, setHostInfo] = useState<{ hosting: boolean; enabled?: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState<BtDevice[] | null>(null);

  useEffect(() => {
    if (!available) return;
    const read = () => KioskLink.info().then(i => {
      setName(i.name || '');
      setHostInfo({ hosting: i.hosting, enabled: i.enabled });
      if (i.connected) setLink(l => (l?.state === 'connected' ? l : { state: 'connected' }));
    }).catch(() => {});
    read();
    const t = window.setInterval(read, 3000);
    const h = KioskLink.addListener('linkState', e => setLink(e));
    return () => { window.clearInterval(t); h.then(x => x.remove()).catch(() => {}); };
  }, [available]);

  const startNow = async () => {
    try { await KioskLink.startHost(); toast.success('La pantalla está esperando la tablet'); } catch (e) { toast.error(errorText(e)); }
  };

  // Otra forma: la pantalla busca la tablet y se vincula (la tablet con Ajustes → Bluetooth abierto)
  const findTablet = async () => {
    setScanning(true);
    try {
      const r = await KioskNet.btScan();
      setFound(r.devices.filter(d => !d.bonded));
      if (r.locationOff) toast.error('Activá la ubicación en los ajustes de Android para buscar.');
    } catch (e) { toast.error(errorText(e)); }
    setScanning(false);
  };
  const pairTablet = async (d: BtDevice) => {
    try {
      await KioskNet.btPair({ address: d.address });
      toast.success(`Aceptá el código en la pantalla y en ${d.name}. Después elegí esta pantalla en la tablet.`);
    } catch (e) { toast.error(errorText(e)); }
  };

  const toggle = (v: boolean) => {
    setOn(v);
    saveGeneralSettings({ remoteHost: v });
    window.dispatchEvent(new Event(REMOTE_HOST_EVENT));
  };

  const visible = async () => {
    try { await KioskLink.makeDiscoverable(); } catch (e) { toast.error(errorText(e)); }
  };

  if (!available) {
    return (
      <Panel title="Control con tablet" description="Una tablet al costado (con la app EventPix Control) maneja esta pantalla por Bluetooth, sin internet.">
        <p className="text-white/60">Se configura en la app del equipo.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Control con tablet" description="Una tablet al costado, con la app EventPix Control, maneja esta pantalla por Bluetooth, sin internet: ve las mismas opciones con sus imágenes y las toca desde ahí. Ideal para teles sin pantalla táctil.">
      <Toggle label="Permitir que una tablet maneje esta pantalla" hint={on ? 'Esperando la tablet…' : 'Apagado'}
        checked={on} onChange={toggle} />
      {on && (
        <>
          <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 ${link?.state === 'connected' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-black/20 text-white/80'}`}>
            <Tablet className="w-6 h-6 shrink-0" />
            <p className="text-lg font-semibold">
              {link?.state === 'connected' ? `Tablet conectada${link.name ? `: ${link.name}` : ''}` : 'Ninguna tablet conectada'}
            </p>
          </div>
          {hostInfo && !hostInfo.hosting && link?.state !== 'connected' && (
            <div className="flex items-center gap-3 rounded-2xl px-5 py-4 bg-amber-500/15 text-amber-200">
              <p className="flex-1">{hostInfo.enabled === false ? 'El Bluetooth de este equipo está apagado: prendelo en el panel Bluetooth.' : 'La pantalla todavía no está esperando a la tablet.'}</p>
              <button onClick={startNow} className={buttonClass}>Reintentar</button>
            </div>
          )}
          <p className="text-white/70">
            Nombre de esta pantalla en Bluetooth: <b className="text-white">{name || '—'}</b>. En la tablet abrí la app <b>EventPix Control</b>,
            tocá <b>Buscar</b> y elegí este nombre. La primera vez tocá acá <b>"Hacer visible"</b>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={visible} className={primaryClass}><Bluetooth className="w-5 h-5" /> Hacer visible (5 minutos)</button>
            <button onClick={findTablet} disabled={scanning} className={buttonClass}>
              {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Tablet className="w-5 h-5" />} {scanning ? 'Buscando…' : 'Buscar la tablet desde acá'}
            </button>
          </div>
          {found && (
            <div className="space-y-2">
              <p className="text-white/60 text-sm">Si la tablet no aparece en la búsqueda de la tablet: abrí en la tablet <b>Ajustes de Android → Bluetooth</b> (así queda visible), buscá desde acá y tocá su nombre para vincularlas.</p>
              {found.length === 0 && <p className="text-white/60">No apareció nada. ¿La tablet tiene abierta la pantalla de Bluetooth?</p>}
              {found.map(d => (
                <button key={d.address} onClick={() => pairTablet(d)} className="w-full flex items-center justify-between rounded-2xl bg-black/20 px-5 py-3 text-left">
                  <span className="font-semibold">{d.name}</span><span className="text-white/50 text-sm">Vincular</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
