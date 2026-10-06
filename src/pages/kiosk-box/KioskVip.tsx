import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Delete, Home, Lock, LockOpen, Search, Ticket } from 'lucide-react';
import ScreenBackground from '@/components/kiosk/ScreenBackground';
import PinDialog from '@/components/kiosk/PinDialog';
import { nameStyleProps } from '@/components/kiosk/attractStyles';
import { useConfettiBurst } from '@/components/kiosk/kioskEffects';
import { getGeneralSettings, getSectionLock, setSectionLock } from '@/lib/kioskSettings';
import { getScreenMedia } from '@/lib/kioskMedia';
import { fullName, getVipGuests, isNumberedTable, searchGuests, tableLabel, VIP_VIDEO_KEY, type VipGuest } from '@/lib/vipGuests';

// Ingreso VIP en el kiosco: el invitado escribe al menos 3 letras de su nombre o
// apellido en el teclado de la pantalla, se elige y ve su mesa (antes, si está
// cargado, el video de bienvenida). La lista de invitados y el video están en el
// equipo: funciona sin internet. Se configura en Ajustes → Ingreso VIP.

type View = 'welcome' | 'search' | 'video' | 'result';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM'];
const SEARCH_IDLE_MS = 45_000;

export default function KioskVip() {
  const navigate = useNavigate();
  const settings = getGeneralSettings();
  const [guests, setGuests] = useState(getVipGuests);
  const [view, setView] = useState<View>('welcome');
  const [query, setQuery] = useState('');
  const [guest, setGuest] = useState<VipGuest | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [locked, setLocked] = useState(() => getSectionLock() === 'vip');
  const [unlockOpen, setUnlockOpen] = useState(false);
  const resultSeconds = Number(settings.vipResultSeconds) || 15;
  const [left, setLeft] = useState(resultSeconds);

  useEffect(() => {
    const update = () => setGuests(getVipGuests());
    window.addEventListener('kiosk-vip-changed', update);
    return () => window.removeEventListener('kiosk-vip-changed', update);
  }, []);

  // Video de bienvenida guardado en el equipo
  useEffect(() => {
    if (settings.vipVideo === false) return;
    let url: string | null = null;
    getScreenMedia(VIP_VIDEO_KEY).then(rec => {
      if (rec) { url = URL.createObjectURL(rec.blob); setVideoUrl(url); }
    }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [settings.vipVideo]);

  const results = searchGuests(guests, query);

  const reset = () => {
    setView('welcome');
    setQuery('');
    setGuest(null);
  };

  const choose = (g: VipGuest) => {
    setGuest(g);
    setLeft(resultSeconds);
    setView(videoUrl ? 'video' : 'result');
  };

  // Búsqueda abandonada: vuelve a la bienvenida
  useEffect(() => {
    if (view !== 'search') return;
    const t = window.setTimeout(() => { setView('welcome'); setQuery(''); }, SEARCH_IDLE_MS);
    return () => window.clearTimeout(t);
  }, [view, query]);

  // Resultado: vuelve solo a la bienvenida
  useEffect(() => {
    if (view !== 'result') return;
    const t = window.setTimeout(() => {
      if (left > 1) { setLeft(left - 1); return; }
      setView('welcome'); setQuery(''); setGuest(null);
    }, 1000);
    return () => window.clearTimeout(t);
  }, [view, left]);

  useConfettiBurst(view === 'result');

  // Teclado físico o control remoto con letras
  useEffect(() => {
    if (view !== 'search') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Backspace') { setQuery(q => q.slice(0, -1)); e.preventDefault(); }
      else if (e.key.length === 1 && /[\p{L} ]/u.test(e.key)) { setQuery(q => (q + e.key).slice(0, 30)); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);

  const toggleLock = () => {
    if (locked) { setUnlockOpen(true); return; }
    setSectionLock('vip');
    setLocked(true);
  };

  const title = (settings.vipTitle as string) || settings.eventTitle || 'Bienvenidos';
  const name = nameStyleProps(settings.nameStyle);

  return (
    <div className="kiosk-root text-white select-none">
      <ScreenBackground screen="vip" brand={view !== 'result' && view !== 'video'} />

      {view === 'welcome' && (
        <>
          <div className="absolute top-6 left-6 z-30 flex items-center gap-3">
            {!locked && (
              <button onClick={() => navigate('/box')}
                className="flex items-center gap-2 px-5 py-3 rounded-full bg-black/50 border border-white/20 text-white/80 hover:text-white focus:outline-none focus:ring-4 focus:ring-white/70">
                <Home className="w-5 h-5" /> Inicio
              </button>
            )}
            <button onClick={toggleLock} aria-label={locked ? 'Desbloquear' : 'Bloquear'}
              className={`w-12 h-12 rounded-full flex items-center justify-center border focus:outline-none focus:ring-4 focus:ring-white/70 ${locked ? 'bg-black/30 border-white/10 text-white/40' : 'bg-black/50 border-white/20 text-white/80'}`}>
              {locked ? <Lock className="w-5 h-5" /> : <LockOpen className="w-5 h-5" />}
            </button>
          </div>
          <button data-autofocus onClick={() => setView('search')}
            className="relative z-10 w-full h-full flex flex-col items-center justify-center gap-[4vmin] px-[6vmin] text-center focus:outline-none">
            <span className="flex items-center gap-[1.5vmin] text-white/85 uppercase tracking-[0.5em] text-[2.4vmin] font-semibold">
              <Ticket className="w-[3.4vmin] h-[3.4vmin]" /> Ingreso
            </span>
            <h1 className={`carlmarx-bold leading-[0.95] text-[clamp(3rem,13vmin,10rem)] ${name.className}`} style={name.style}>{title}</h1>
            <p className="text-white/90 text-[clamp(1.2rem,4vmin,3rem)]" style={{ textShadow: '0 0.4vmin 2vmin rgba(0,0,0,0.7)' }}>
              {(settings.vipSubtitle as string) || '¡Buscá tu mesa!'}
            </p>
            <span className="relative mt-[2vmin]">
              <span className="attract-cta-ring absolute inset-0 rounded-full border-[0.5vmin] border-white/70" />
              <span className="relative flex items-center gap-[2vmin] rounded-full px-[6vmin] py-[2.6vmin] bg-gradient-to-r from-[#ffd23f] via-[#ff9f1c] to-[#ff4d6d] shadow-[0_2vmin_6vmin_-1vmin_rgba(255,159,28,0.7)]">
                <Search className="w-[5vmin] h-[5vmin]" />
                <span className="carlmarx-bold text-[clamp(1.5rem,5vmin,3.6rem)] tracking-wide">Buscar mi nombre</span>
              </span>
            </span>
            {!guests.length && (
              <span className="text-amber-300 text-[clamp(1rem,2.6vmin,1.8rem)]">Todavía no hay invitados cargados (Ajustes → Ingreso VIP)</span>
            )}
          </button>
          {unlockOpen && (
            <PinDialog title="Clave para desbloquear" onCancel={() => setUnlockOpen(false)}
              onSuccess={() => { setSectionLock(null); setLocked(false); setUnlockOpen(false); }} />
          )}
        </>
      )}

      {view === 'search' && (
        <div className="relative z-10 h-full flex flex-col items-center px-[3vmin] pt-[9vmin] portrait:pt-[18vh] pb-[2vmin] gap-[2vmin]">
          <div className="w-full max-w-[110vmin] flex items-center gap-[2vmin]">
            <button onClick={reset} className="shrink-0 px-[3vmin] py-[1.6vmin] rounded-full bg-black/50 border border-white/20 text-[clamp(1rem,2.6vmin,1.8rem)] font-semibold">
              Volver
            </button>
            <div className="flex-1 kiosk-glass rounded-[2.5vmin] px-[3vmin] py-[1.6vmin] flex items-center gap-[2vmin] min-h-[9vmin]">
              <Search className="w-[4vmin] h-[4vmin] text-white/60 shrink-0" />
              <span className="text-[clamp(1.4rem,5vmin,3.6rem)] font-bold tracking-wide truncate">
                {query || <span className="text-white/40 font-normal text-[clamp(1rem,3.4vmin,2.4rem)]">Escribí tu nombre o apellido</span>}
              </span>
              <span className="w-[0.5vmin] h-[5vmin] bg-white/80 animate-pulse" />
            </div>
          </div>

          {/* Resultados */}
          <div className="w-full max-w-[110vmin] flex-1 min-h-0 overflow-y-auto flex flex-col gap-[1.4vmin] portrait:order-3">
            {query.trim().length < 3 ? (
              <p className="text-center text-white/70 text-[clamp(1rem,3vmin,2.2rem)] mt-[3vmin]">Escribí al menos 3 letras de tu nombre o apellido</p>
            ) : results.length === 0 ? (
              <p className="text-center text-white/70 text-[clamp(1rem,3vmin,2.2rem)] mt-[3vmin]">No encontramos ese nombre. Probá con tu apellido.</p>
            ) : results.map((g, i) => (
              <button key={i} onClick={() => choose(g)}
                className="w-full kiosk-glass rounded-[2vmin] px-[3vmin] py-[2vmin] flex items-center justify-between gap-[2vmin] text-left hover:bg-white/10 active:scale-[0.99] focus:outline-none focus:ring-4 focus:ring-white/70">
                <span className="text-[clamp(1.2rem,4vmin,3rem)] font-bold">{fullName(g)}</span>
                <span className="shrink-0 px-[2.4vmin] py-[0.8vmin] rounded-full bg-[#ffd23f]/20 text-[#ffd23f] text-[clamp(0.9rem,2.6vmin,1.8rem)] font-semibold">
                  {g.table ? (isNumberedTable(g.table) ? `Mesa ${tableLabel(g.table)}` : g.table) : g.living ? 'Living' : g.afterParty ? 'Trasnoche' : 'Ingreso'}
                </span>
              </button>
            ))}
          </div>

          <Keyboard
            onKey={k => setQuery(q => (q + k).slice(0, 30))}
            onDelete={() => setQuery(q => q.slice(0, -1))}
            onClear={() => setQuery('')}
          />
        </div>
      )}

      {view === 'video' && videoUrl && (
        <div className="fixed inset-0 z-40 bg-black" onClick={() => setView('result')}>
          <video src={videoUrl} autoPlay playsInline className="w-full h-full object-contain"
            onEnded={() => setView('result')} onError={() => setView('result')} />
          <span className="absolute bottom-[3vmin] right-[3vmin] px-[3vmin] py-[1.4vmin] rounded-full bg-black/60 text-white/80 text-[clamp(0.9rem,2.4vmin,1.6rem)]">
            Tocá para saltear
          </span>
        </div>
      )}

      {view === 'result' && guest && <Result guest={guest} left={left} onDone={reset} afterPartyTime={settings.vipAfterPartyTime as string | undefined} />}
    </div>
  );
}

function Keyboard({ onKey, onDelete, onClear }: { onKey: (k: string) => void; onDelete: () => void; onClear: () => void }) {
  const key = 'h-[8.5vmin] min-h-11 rounded-[1.6vmin] bg-white/15 border border-white/15 text-white font-bold text-[clamp(1.1rem,3.8vmin,2.6rem)] active:bg-white/35 active:scale-95 transition-transform';
  return (
    <div className="w-full max-w-[120vmin] flex flex-col gap-[1vmin] kiosk-glass rounded-[3vmin] p-[1.4vmin] portrait:order-2">
      {ROWS.map((row, r) => (
        <div key={r} className="flex gap-[1vmin] justify-center">
          {row.split('').map(ch => (
            <button key={ch} onClick={() => onKey(ch)} className={`${key} flex-1 max-w-[11vmin]`}>{ch}</button>
          ))}
          {r === 2 && (
            <button onClick={onDelete} aria-label="Borrar" className={`${key} flex-[1.6] max-w-[18vmin] flex items-center justify-center`}>
              <Delete className="w-[4.5vmin] h-[4.5vmin]" />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-[1vmin] justify-center">
        <button onClick={onClear} className={`${key} flex-1 max-w-[24vmin] whitespace-nowrap text-[clamp(0.8rem,2.6vmin,1.8rem)]`}>Borrar todo</button>
        <button onClick={() => onKey(' ')} className={`${key} flex-[3] max-w-[60vmin] text-[clamp(0.9rem,2.8vmin,1.8rem)]`}>Espacio</button>
      </div>
    </div>
  );
}

function Result({ guest, left, onDone, afterPartyTime }: { guest: VipGuest; left: number; onDone: () => void; afterPartyTime?: string }) {
  const table = guest.table.trim();
  return (
    <div className="relative z-10 h-full flex flex-col items-center justify-center gap-[3vmin] px-[5vmin] text-center animate-in fade-in zoom-in-95 duration-500">
      <p className="text-white/80 uppercase tracking-[0.4em] text-[clamp(1rem,3vmin,2.2rem)]">Bienvenido/a</p>
      <h2 className="carlmarx-bold text-white text-[clamp(2.2rem,9vmin,7rem)] leading-[0.95]" style={{ textShadow: '0 1vmin 3vmin rgba(0,0,0,0.5)' }}>
        {fullName(guest)}
      </h2>

      {table ? (
        <div className="kiosk-glass rounded-[5vmin] px-[10vmin] py-[3.5vmin] flex flex-col items-center gap-[1.2vmin]">
          <p className="text-[#bfe9ff] uppercase tracking-[0.35em] text-[clamp(0.9rem,2.6vmin,1.8rem)] font-semibold">Tu ubicación</p>
          <p className="carlmarx-bold text-white leading-none text-[clamp(4.5rem,22vmin,16rem)]" style={{ textShadow: '0 1.2vmin 4vmin rgba(0,0,0,0.5)' }}>
            {tableLabel(table) || table}
          </p>
          {isNumberedTable(table) && (
            <span className="px-[4vmin] py-[1.2vmin] rounded-full bg-[#ffd23f] text-black font-black uppercase tracking-[0.3em] text-[clamp(1rem,3vmin,2.2rem)]">Mesa</span>
          )}
        </div>
      ) : guest.living ? (
        <div className="kiosk-glass rounded-[5vmin] px-[10vmin] py-[5vmin]">
          <p className="text-[12vmin] leading-none">🛋️</p>
          <p className="carlmarx-bold text-white text-[clamp(3rem,14vmin,10rem)] leading-none mt-[2vmin]">Living</p>
          <p className="text-white/70 text-[clamp(1rem,3vmin,2.2rem)] mt-[1vmin]">Tu espacio exclusivo</p>
        </div>
      ) : guest.afterParty ? (
        <div className="kiosk-glass rounded-[5vmin] px-[10vmin] py-[5vmin]">
          <p className="text-[12vmin] leading-none">🌙</p>
          <p className="carlmarx-bold text-[#ffd23f] text-[clamp(2.4rem,10vmin,7rem)] leading-none mt-[2vmin]">Trasnoche</p>
          {afterPartyTime && <p className="text-white/80 text-[clamp(1rem,3.4vmin,2.4rem)] mt-[1.5vmin]">Ingreso desde las {afterPartyTime}</p>}
        </div>
      ) : (
        <div className="kiosk-glass rounded-[5vmin] px-[10vmin] py-[5vmin]">
          <p className="carlmarx-bold text-white text-[clamp(2.6rem,11vmin,8rem)] leading-[0.95]">¡Podés<br />ingresar!</p>
        </div>
      )}

      {guest.afterParty && (table || guest.living) && (
        <span className="px-[4vmin] py-[1.2vmin] rounded-full bg-[#ffd23f]/20 border border-[#ffd23f]/50 text-[#ffd23f] font-bold uppercase tracking-[0.25em] text-[clamp(0.9rem,2.4vmin,1.6rem)]">
          ✨ Invitado trasnoche
        </span>
      )}

      <button data-autofocus onClick={onDone}
        className="mt-[1vmin] px-[7vmin] py-[2vmin] rounded-full bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] font-bold text-[clamp(1.2rem,3.6vmin,2.6rem)] focus:outline-none focus:ring-4 focus:ring-white/70">
        Listo ({left})
      </button>
    </div>
  );
}
