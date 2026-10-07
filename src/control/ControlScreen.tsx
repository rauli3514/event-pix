import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bluetooth, Gamepad2, Loader2, MonitorSmartphone, RefreshCw, Tv } from 'lucide-react';
import AuroraBackground from '@/components/kiosk/brand/AuroraBackground';
import { EventPixLogo } from '@/components/kiosk/brand/EventPixLogo';
import { KioskNet, type BtDevice } from '@/lib/kioskNet';
import {
  getRemoteTarget, KioskLink, linkAvailable, setRemoteTarget,
  type RemoteCommand, type RemoteItem, type RemoteMessage, type RemoteTarget, type RemoteView,
} from '@/lib/kioskLink';

// App EventPix Control: la tablet que maneja la pantalla del kiosco por Bluetooth (sin
// internet). Muestra lo mismo que el invitado elige en la pantalla grande (modos,
// estilos, la foto, los textos) con sus imágenes, que la pantalla manda en miniatura.
// Se elige la pantalla una vez y después se conecta sola.

const RETRY_MS = 4000;
type Key = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter';

export default function ControlScreen() {
  const [target, setTarget] = useState<RemoteTarget | null>(getRemoteTarget);
  const [state, setState] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [error, setError] = useState('');
  const [view, setView] = useState<RemoteView | null>(null);
  // Miniaturas recibidas (se vacían al reconectar: la pantalla las vuelve a mandar)
  const [images, setImages] = useState<Record<string, string>>({});
  const [pad, setPad] = useState(false);
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
      setImages({});
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
          const msg = JSON.parse(e.data) as RemoteMessage;
          if (msg.t === 'view') setView(msg);
          else if (msg.t === 'img') setImages(prev => {
            // Se guardan las últimas (las fotos pesan): con 80 sobra para todas las tarjetas
            const keys = Object.keys(prev);
            const next = keys.length > 80 ? Object.fromEntries(keys.slice(-60).map(k => [k, prev[k]])) : { ...prev };
            next[msg.key] = msg.data;
            return next;
          });
        } catch { /* mensaje inválido */ }
      }),
      KioskLink.addListener('linkState', e => {
        if (e.state === 'disconnected') {
          setState('error');
          setError('Se cortó la conexión. Reconectando…');
          const t = getRemoteTarget();
          if (t && wanted.current) retry.current = window.setTimeout(() => connectRef.current(t), RETRY_MS);
        }
      }),
    ];
    const t = getRemoteTarget();
    const first = t ? window.setTimeout(() => connectRef.current(t), 0) : 0;
    return () => {
      window.clearTimeout(first);
      wanted.current = false;
      window.clearTimeout(retry.current);
      handles.forEach(h => h.then(x => x.remove()).catch(() => {}));
      KioskLink.disconnect().catch(() => {});
    };
  }, []);

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

  if (!linkAvailable()) {
    return (
      <Shell>
        <p className="text-white/70 text-center text-xl mt-10">EventPix Control funciona instalado en la tablet (app de Android).</p>
      </Shell>
    );
  }

  if (!target) return <Shell><PickScreen onPick={choose} /></Shell>;

  const status = (
    <span className="flex items-center gap-2 text-sm text-white/80">
      <span className={`w-2.5 h-2.5 rounded-full ${state === 'connected' ? 'bg-emerald-400' : state === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'}`} />
      {target.name}
      <button onClick={forget} className="ml-1 underline text-white/50">Cambiar</button>
    </span>
  );

  return (
    <Shell status={status} onPad={state === 'connected' ? () => setPad(p => !p) : undefined} padOn={pad}>
      {state !== 'connected' ? (
        <div className="flex flex-col items-center gap-4 text-center mt-16">
          {state === 'connecting' ? <Loader2 className="w-14 h-14 animate-spin text-[#00d4ff]" /> : <Bluetooth className="w-14 h-14 text-white/50" />}
          <p className="text-2xl">{state === 'connecting' ? `Conectando con ${target.name}…` : error || 'Sin conexión'}</p>
          <button onClick={() => { window.clearTimeout(retry.current); void connect(target); }} className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/10 text-lg">
            <RefreshCw className="w-5 h-5" /> Reintentar
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-2">
            {view ? <ViewPane view={view} images={images} onTap={id => send({ t: 'tap', id })} onText={value => send({ t: 'text', value })} />
              : <p className="text-center text-white/60 text-xl mt-16">Esperando la pantalla…</p>}
          </div>
          {pad && <DPad onKey={key => send({ t: 'key', key })} />}
        </>
      )}
    </Shell>
  );
}

/** Lo que muestra la pantalla grande, adaptado a la tablet. */
function ViewPane({ view, images, onTap, onText }: {
  view: RemoteView; images: Record<string, string>; onTap: (id: string) => void; onText: (v: string) => void;
}) {
  if (view.saver) {
    return (
      <button onClick={() => onTap('wake')} className="w-full h-full min-h-[60vh] flex flex-col items-center justify-center gap-6 rounded-[2rem] kiosk-glass">
        <EventPixLogo size={72} />
        <span className="carlmarx-bold text-[clamp(2rem,7vw,4rem)] animate-pulse">Tocá para empezar</span>
      </button>
    );
  }
  const cards = view.items.filter(i => i.img);
  const buttons = view.items.filter(i => !i.img);
  // Un solo botón grande (p. ej. "Tocá para empezar", "Sacar foto")
  const single = !cards.length && buttons.length === 1 && !view.text;
  return (
    <div className="flex flex-col gap-5 min-h-full">
      {view.title && <h1 className="carlmarx-bold text-center text-[clamp(1.8rem,5vw,3.2rem)] leading-tight">{view.title}</h1>}

      {view.watch && (
        <div className="flex flex-col items-center gap-3 text-center rounded-[2rem] kiosk-glass px-6 py-8">
          <Tv className="w-12 h-12 text-[#00d4ff]" />
          <p className="carlmarx-bold text-[clamp(1.6rem,5vw,3rem)] leading-tight">{view.watch}</p>
        </div>
      )}

      {view.image && (
        <div className="flex justify-center">
          {images[view.image]
            ? <img src={images[view.image]} alt="" className="max-h-[45vh] max-w-full rounded-3xl shadow-2xl border border-white/20" />
            : <div className="w-[60%] aspect-[3/4] max-h-[45vh] rounded-3xl bg-white/10 flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-white/50" /></div>}
        </div>
      )}

      {view.text && (
        <TextBox key={view.path + view.text.placeholder} placeholder={view.text.placeholder} initial={view.text.value} onChange={onText} />
      )}

      {cards.length > 0 && (
        <div className={`grid gap-4 ${cards.length === 1 ? 'grid-cols-1 max-w-md mx-auto w-full' : cards.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
          {cards.map(i => <Card key={i.id} item={i} src={images[i.img!]} onTap={() => onTap(i.id)} />)}
        </div>
      )}

      {buttons.length > 0 && (
        single ? (
          <button onClick={() => onTap(buttons[0].id)}
            className="mt-auto w-full py-10 rounded-[2rem] carlmarx-bold text-[clamp(2rem,6vw,3.5rem)] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_0_60px_rgba(255,46,147,0.45)] active:scale-[0.98] transition-transform">
            {buttons[0].label}
          </button>
        ) : (
          <div className={`grid gap-3 ${buttons.length === 2 || buttons.length > 3 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {buttons.map(i => (
              <button key={i.id} onClick={() => onTap(i.id)}
                className={`rounded-2xl px-4 py-5 text-xl font-bold leading-tight text-center active:scale-[0.98] transition-transform min-h-[4.5rem] ${
                  i.primary ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] shadow-[0_0_40px_rgba(255,46,147,0.45)] text-2xl'
                    : i.selected ? 'bg-[#7b2ff7] ring-4 ring-white/70' : 'kiosk-glass active:bg-white/20'}`}>
                {i.label}
              </button>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Card({ item, src, onTap }: { item: RemoteItem; src?: string; onTap: () => void }) {
  return (
    <button onClick={onTap}
      className={`relative flex flex-col rounded-2xl overflow-hidden text-left kiosk-glass active:scale-[0.97] transition-transform ${item.selected ? 'ring-4 ring-[#00d4ff]' : item.featured ? 'ring-2 ring-[#a78bfa] shadow-[0_0_40px_-6px_#a78bfa]' : ''}`}>
      <div className="relative w-full aspect-[4/3] bg-black/40">
        {src ? <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
          : <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-white/40" /></div>}
        {item.featured && <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-gradient-to-r from-[#ffd23f] to-[#ff9f1c] text-black">⭐ El favorito</span>}
        {item.selected && <span className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#00d4ff] text-black">✓ Elegido</span>}
      </div>
      <div className="px-3 py-2.5">
        <p className="carlmarx-bold text-lg leading-tight">{item.label}</p>
        {item.sub && <p className="text-white/65 text-sm leading-snug mt-0.5">{item.sub}</p>}
      </div>
    </button>
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

function Shell({ children, status, onPad, padOn }: { children: React.ReactNode; status?: React.ReactNode; onPad?: () => void; padOn?: boolean }) {
  return (
    <div className="relative h-screen overflow-hidden text-white">
      <AuroraBackground />
      <div className="relative h-full flex flex-col gap-4 p-5 max-w-4xl mx-auto">
        <header className="flex items-center justify-between gap-3">
          <EventPixLogo size={38} subtitle="Control" />
          {status}
          {onPad && (
            <button onClick={onPad} aria-label="Flechas" className={`p-3 rounded-full ${padOn ? 'bg-[#7b2ff7]' : 'bg-white/10'}`}>
              <Gamepad2 className="w-5 h-5" />
            </button>
          )}
        </header>
        {children}
      </div>
    </div>
  );
}

function DPad({ onKey }: { onKey: (k: Key) => void }) {
  const b = 'w-16 h-16 rounded-2xl bg-white/12 border border-white/15 flex items-center justify-center active:bg-white/35';
  return (
    <div className="flex items-center justify-center pb-1">
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
    <div className="flex flex-col gap-4 min-h-0">
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
            Otra forma: abrí en esta tablet <b>Ajustes de Android → Bluetooth</b>. En la pantalla andá a <b>Control con tablet → "Buscar la tablet desde acá"</b> y tocá el nombre de la tablet. Después volvé acá: la pantalla aparece como <b>vinculado</b>.
          </p>
        )}
      </div>
    </div>
  );
}
