import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bluetooth, Loader2, LogOut, MonitorSmartphone, RefreshCw } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { KioskNet, type BtDevice } from '@/lib/kioskNet';
import {
  getRemoteTarget, KioskLink, linkAvailable, setDeviceRole, setRemoteTarget,
  type RemoteCommand, type RemoteTarget, type RemoteView,
} from '@/lib/kioskLink';

// Tablet que maneja la pantalla del kiosco por Bluetooth (sin internet). Muestra los
// botones que hay en la pantalla y, al tocarlos, la pantalla los aprieta. Se elige la
// pantalla una vez y después se conecta sola.

const RETRY_MS = 4000;

export default function KioskControl() {
  const navigate = useNavigate();
  const [target, setTarget] = useState<RemoteTarget | null>(getRemoteTarget);
  const [state, setState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState('');
  const [view, setView] = useState<RemoteView | null>(null);
  const retry = useRef(0);
  const wanted = useRef(true);
  const connectRef = useRef<(t: RemoteTarget) => void>(() => {});

  const send = (cmd: RemoteCommand) => { KioskLink.send({ data: JSON.stringify(cmd) }).catch(() => {}); };

  const connect = useCallback(async (t: RemoteTarget) => {
    setState('connecting');
    setError('');
    try {
      await KioskLink.connect({ address: t.address });
      setState('connected');
      window.setTimeout(() => send({ t: 'hello' }), 300);
    } catch (e) {
      setState('error');
      setError(e instanceof Error ? e.message : String(e));
      // Se reintenta solo (la pantalla puede estar arrancando)
      if (wanted.current) retry.current = window.setTimeout(() => connectRef.current(t), RETRY_MS);
    }
  }, []);
  useEffect(() => { connectRef.current = t => { void connect(t); }; }, [connect]);

  useEffect(() => {
    if (!linkAvailable()) return;
    const handles = [
      KioskLink.addListener('linkMessage', e => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.t === 'view') setView(msg as RemoteView);
        } catch { /* mensaje inválido */ }
      }),
      KioskLink.addListener('linkState', e => {
        if (e.state === 'disconnected') {
          setState('error');
          setError('Se cortó la conexión. Reconectando…');
          const t = getRemoteTarget();
          if (t && wanted.current) retry.current = window.setTimeout(() => { void connect(t); }, RETRY_MS);
        }
      }),
    ];
    const t = getRemoteTarget();
    const first = t ? window.setTimeout(() => { void connect(t); }, 0) : 0;
    return () => {
      window.clearTimeout(first);
      wanted.current = false;
      window.clearTimeout(retry.current);
      handles.forEach(h => h.then(x => x.remove()).catch(() => {}));
      KioskLink.disconnect().catch(() => {});
    };
  }, [connect]);

  const choose = (d: BtDevice) => {
    const t = { address: d.address, name: d.name };
    setRemoteTarget(t);
    setTarget(t);
    wanted.current = true;
    window.clearTimeout(retry.current);
    void connect(t);
  };

  const forget = () => {
    window.clearTimeout(retry.current);
    KioskLink.disconnect().catch(() => {});
    setRemoteTarget(null);
    setTarget(null);
    setView(null);
    setState('idle');
  };

  const leave = () => {
    forget();
    setDeviceRole('screen');
    navigate('/box', { replace: true });
  };

  if (!linkAvailable()) {
    return (
      <Shell onLeave={leave}>
        <p className="text-white/70 text-center text-xl">El control con tablet funciona en la app EventPix Kiosco (versión 2.2 o más nueva) instalada en la tablet.</p>
      </Shell>
    );
  }

  if (!target) return <Shell onLeave={leave}><PickScreen onPick={choose} /></Shell>;

  return (
    <Shell onLeave={leave} status={
      <span className="flex items-center gap-2 text-sm">
        <span className={`w-2.5 h-2.5 rounded-full ${state === 'connected' ? 'bg-emerald-400' : state === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
        {target.name}
        <button onClick={forget} className="ml-2 underline text-white/60">Cambiar</button>
      </span>
    }>
      {state !== 'connected' ? (
        <div className="flex flex-col items-center gap-4 text-center mt-10">
          {state === 'connecting' ? <Loader2 className="w-12 h-12 animate-spin text-[#00d4ff]" /> : <Bluetooth className="w-12 h-12 text-white/50" />}
          <p className="text-xl">{state === 'connecting' ? `Conectando con ${target.name}…` : error || 'Sin conexión'}</p>
          <button onClick={() => { window.clearTimeout(retry.current); void connect(target); }} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 text-lg">
            <RefreshCw className="w-5 h-5" /> Reintentar
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 min-h-0 flex-1">
          <h1 className="text-center text-2xl font-black min-h-[2rem]">{view?.title || ' '}</h1>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {view?.text && <TextBox key={view.path + view.text.placeholder} placeholder={view.text.placeholder} initial={view.text.value}
              onChange={value => send({ t: 'text', value })} />}
            {!view || view.items.length === 0 ? (
              !view?.text && <p className="text-center text-white/60 text-lg mt-8">{view?.saver ? 'Tocá OK para volver' : 'Esperando…'}</p>
            ) : (
              <div className={`grid gap-3 mt-3 ${view.items.length <= 4 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {view.items.map(i => (
                  <button key={i.id} onClick={() => send({ t: 'tap', id: i.id })}
                    className="kiosk-glass rounded-2xl px-4 py-4 text-lg font-bold leading-tight text-center active:scale-[0.98] active:bg-white/20 transition-transform min-h-[4rem]">
                    {i.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <DPad onKey={key => send({ t: 'key', key })} />
        </div>
      )}
    </Shell>
  );
}

/** Cuadro para escribir (nombre del invitado, búsqueda del Ingreso VIP): se manda mientras se escribe. */
function TextBox({ placeholder, initial, onChange }: { placeholder: string; initial: string; onChange: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input autoFocus value={value} placeholder={placeholder}
      onChange={e => { setValue(e.target.value); onChange(e.target.value); }}
      className="w-full rounded-2xl bg-black/40 border-2 border-white/30 px-5 py-4 text-2xl font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-[#00d4ff]" />
  );
}

function Shell({ children, onLeave, status }: { children: React.ReactNode; onLeave: () => void; status?: React.ReactNode }) {
  return (
    <div className="relative h-screen overflow-hidden text-white">
      <AuroraBackground />
      <div className="relative h-full flex flex-col gap-4 p-5 max-w-3xl mx-auto">
        <header className="flex items-center justify-between gap-3">
          <EventPixLogo size={40} subtitle="Control" />
          {status}
          <button onClick={onLeave} aria-label="Dejar de usar como control" className="p-3 rounded-full bg-white/10"><LogOut className="w-5 h-5" /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

function DPad({ onKey }: { onKey: (k: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter') => void }) {
  const b = 'w-16 h-16 rounded-2xl bg-white/12 border border-white/15 flex items-center justify-center active:bg-white/35';
  return (
    <div className="flex items-center justify-center gap-6 pb-2">
      <div className="grid grid-cols-3 gap-2">
        <span />
        <button onClick={() => onKey('ArrowUp')} className={b} aria-label="Arriba"><ArrowUp /></button>
        <span />
        <button onClick={() => onKey('ArrowLeft')} className={b} aria-label="Izquierda"><ArrowLeft /></button>
        <button onClick={() => onKey('Enter')} className={`${b} bg-gradient-to-br from-[#ff2e93] to-[#7b2ff7] font-black`}>OK</button>
        <button onClick={() => onKey('ArrowRight')} className={b} aria-label="Derecha"><ArrowRight /></button>
        <span />
        <button onClick={() => onKey('ArrowDown')} className={b} aria-label="Abajo"><ArrowDown /></button>
        <span />
      </div>
    </div>
  );
}

/** Elegir la pantalla del kiosco: las ya vinculadas o buscando cerca. */
function PickScreen({ onPick }: { onPick: (d: BtDevice) => void }) {
  const [bonded, setBonded] = useState<BtDevice[]>([]);
  const [found, setFound] = useState<BtDevice[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState('');

  const loadBonded = () => KioskNet.btStatus().then(s => setBonded(s.bonded ?? [])).catch(() => {});
  useEffect(() => { void loadBonded(); }, []);

  const scan = async () => {
    setScanning(true);
    setMsg('');
    try {
      const r = await KioskNet.btScan();
      setFound(r.devices);
      if (r.locationOff) setMsg('Activá la ubicación de la tablet para buscar dispositivos.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
    // La búsqueda pide el permiso de Bluetooth: recién ahí se ven los ya vinculados
    await loadBonded();
    setScanning(false);
  };

  const list = [...bonded, ...(found ?? []).filter(d => !bonded.some(b => b.address === d.address))];
  return (
    <div className="flex flex-col gap-4">
      <div className="kiosk-glass rounded-3xl p-5 space-y-2">
        <h1 className="text-2xl font-black flex items-center gap-2"><MonitorSmartphone /> Elegí la pantalla del kiosco</h1>
        <p className="text-white/70">En la pantalla: <b>Ajustes → Equipo → Control con tablet</b>, activalo y tocá <b>"Hacer visible"</b>. Después tocá <b>Buscar</b> acá y elegí el nombre de la pantalla.</p>
      </div>
      <button onClick={scan} disabled={scanning} className="flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] disabled:opacity-60">
        {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bluetooth className="w-5 h-5" />} {scanning ? 'Buscando (unos 12 s)…' : 'Buscar'}
      </button>
      {msg && <p className="text-amber-300">{msg}</p>}
      <div className="space-y-2 overflow-y-auto">
        {list.map(d => (
          <button key={d.address} onClick={() => onPick(d)} className="w-full kiosk-glass rounded-2xl px-5 py-4 text-left text-lg font-semibold flex justify-between">
            <span>{d.name}</span>
            <span className="text-white/50 text-sm">{d.bonded ? 'vinculado' : ''}</span>
          </button>
        ))}
        {found && (
          <p className="text-white/60">
            {list.length === 0 ? 'No se encontró nada. ' : '¿No ves la pantalla? '}
            Otra forma: abrí en esta tablet <b>Ajustes de Android → Bluetooth</b>. En la pantalla andá a <b>Control con tablet → "Buscar la tablet desde acá"</b> y tocá el nombre de la tablet para vincularlas. Después volvé acá: la pantalla aparece como <b>vinculado</b>.
          </p>
        )}
      </div>
    </div>
  );
}
