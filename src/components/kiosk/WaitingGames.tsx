import { useCallback, useEffect, useRef, useState } from 'react';
import { rotateArrowKey } from '@/lib/screenRotation';
import { getGeneralSettings, validTrivia } from '@/lib/kioskSettings';

// Juegos cortos mientras se espera la foto: tateti, el vaso con la pelotita,
// piedra, papel o tijera, memotest, reflejos, Simón dice y la trivia de la fiesta
// (esta última solo si se cargaron preguntas en Ajustes). Sale uno al azar (en Fotos IA siempre, mientras
// la IA trabaja; en Fotos, si está activado, durante un minuto antes del resultado).
// Se juegan tocando la pantalla o con el control (flechas + OK). Todo es CSS liviano
// para la TV box. Cuando la foto está lista se avisa y se pasa sola.

type Game = 'tateti' | 'vasos' | 'ppt' | 'memo' | 'reflejos' | 'simon' | 'trivia';
const GAMES: Game[] = ['tateti', 'vasos', 'ppt', 'memo', 'reflejos', 'simon'];

const randomGame = (except?: Game) => {
  const games = validTrivia(getGeneralSettings().triviaQuestions).length ? [...GAMES, 'trivia' as Game] : GAMES;
  const options = games.filter(g => g !== except);
  return options[Math.floor(Math.random() * options.length)];
};

const AI_PHRASES = ['Analizando tu foto…', 'Mezclando colores…', 'La IA está dibujando…', 'Agregando los detalles…', 'Últimos retoques…'];

/** Flechas del control (con la tele girada se traducen) que maneja el juego, sin pasar a la navegación general. */
function useGameKeys(handler: (key: string) => boolean) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!/^Arrow/.test(e.key)) return;
      if (ref.current(rotateArrowKey(e.key))) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}

const focusSoon = (el: HTMLElement | null | undefined) => window.setTimeout(() => el?.focus(), 30);

const btn = 'rounded-[2vmin] font-bold text-white focus:outline-none focus:ring-[0.6vmin] focus:ring-white focus:scale-105 transition-transform';

/**
 * ready: la foto ya está (con la IA). seconds: en Fotos, el juego dura ese tiempo y
 * después se pasa a la foto (se puede saltar).
 */
export default function WaitingGames({ title, ready = false, seconds, onContinue }: {
  title: string;
  ready?: boolean;
  seconds?: number;
  onContinue: () => void;
}) {
  const [game, setGame] = useState<Game>(() => randomGame());
  const [round, setRound] = useState(0);
  const [phrase, setPhrase] = useState(0);
  const [left, setLeft] = useState(seconds ?? 0);
  const timed = !!seconds;

  useEffect(() => {
    if (timed) return;
    const t = window.setInterval(() => setPhrase(p => (p + 1) % AI_PHRASES.length), 2800);
    return () => window.clearInterval(t);
  }, [timed]);

  useEffect(() => {
    if (!timed || left <= 0) return;
    const t = window.setTimeout(() => setLeft(l => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timed, left]);

  const done = timed ? left <= 0 : ready;

  return (
    <div className="relative z-10 h-full flex flex-col items-center px-[4vmin] pt-[9vmin] pb-[3vmin] gap-[2.5vmin]">
      {/* Arriba: progreso de la IA o el tiempo que queda */}
      <div className="flex items-center gap-[2.5vmin]">
        <div className="relative w-[9vmin] h-[9vmin] shrink-0">
          <div className="absolute inset-0 rounded-full animate-spin" style={{ animationDuration: '3s', background: 'conic-gradient(from 0deg, #ff2e93, #7b2ff7, #00d4ff, #ffd23f, #ff2e93)' }} />
          <div className="absolute inset-[0.8vmin] rounded-full bg-[#07051a]/85" />
          {timed
            ? <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-[3.2vmin]">{left}</span>
            : <div className="absolute inset-[2.4vmin] rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffffff,#c86bff_35%,#7b2ff7_70%)] animate-pulse" />}
        </div>
        <div>
          <h2 className="carlmarx-bold text-white text-[clamp(1.8rem,6vmin,4.5rem)] leading-none">{title}</h2>
          <p className="text-white/70 text-[clamp(1rem,2.8vmin,2rem)] mt-[0.8vmin]">
            {timed ? '¡Un jueguito mientras tanto!' : `${AI_PHRASES[phrase]} · ¡jugá mientras esperás!`}
          </p>
        </div>
      </div>
      {timed && (
        <div className="w-[60vmin] h-[1vmin] rounded-full bg-white/15 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#ff2e93] to-[#00d4ff] transition-[width] duration-1000 ease-linear"
            style={{ width: `${(left / seconds!) * 100}%` }} />
        </div>
      )}

      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <div key={round} className="flex flex-col items-center gap-[2.5vmin]">
          {game === 'tateti' && <TicTacToe />}
          {game === 'vasos' && <ShellGame />}
          {game === 'ppt' && <RockPaperScissors />}
          {game === 'memo' && <Memotest />}
          {game === 'reflejos' && <Reflexes />}
          {game === 'simon' && <SimonSays />}
          {game === 'trivia' && <Trivia />}
          <div className="flex gap-[2vmin]">
            <button onClick={() => { setGame(g => randomGame(g)); setRound(r => r + 1); }}
              className={`${btn} px-[4vmin] py-[1.6vmin] bg-white/10 text-[clamp(0.9rem,2.4vmin,1.6rem)]`}>
              Otro juego
            </button>
            {timed && (
              <button onClick={onContinue} className={`${btn} px-[4vmin] py-[1.6vmin] bg-white/10 text-[clamp(0.9rem,2.4vmin,1.6rem)]`}>
                Ver mi foto ya
              </button>
            )}
          </div>
        </div>
      </div>

      {done && <ReadyOverlay onContinue={onContinue} />}
    </div>
  );
}

/** "¡Tu foto está lista!" con cuenta atrás: termina la jugada y pasa sola. */
function ReadyOverlay({ onContinue }: { onContinue: () => void }) {
  const [left, setLeft] = useState(4);
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => { focusSoon(ref.current); }, []);
  useEffect(() => {
    if (left <= 0) { onContinue(); return; }
    const t = window.setTimeout(() => setLeft(l => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left, onContinue]);
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 animate-in fade-in duration-300">
      <div className="kiosk-glass rounded-[4vmin] px-[8vmin] py-[6vmin] flex flex-col items-center gap-[3vmin]">
        <p className="text-[10vmin] leading-none">🎉</p>
        <h2 className="carlmarx-bold text-white text-[clamp(2rem,8vmin,6rem)] leading-none text-center">¡Tu foto está lista!</h2>
        <button ref={ref} onClick={onContinue}
          className={`${btn} px-[6vmin] py-[2.2vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-[clamp(1.2rem,4vmin,3rem)]`}>
          Ver mi foto ({left})
        </button>
      </div>
    </div>
  );
}

// ─── Tateti ──────────────────────────────────────────────────────────────────

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
type Cell = 'X' | 'O' | null;

const winnerOf = (b: Cell[]) => {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a], line: [a, c, d] };
  return null;
};

/** La compu: gana si puede, si no tapa, y a veces se equivoca para que se le pueda ganar. */
const cpuMove = (b: Cell[]) => {
  const free = b.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  const finishing = (mark: Cell) => free.find(i => { const t = [...b]; t[i] = mark; return winnerOf(t)?.mark === mark; });
  const win = finishing('O');
  if (win !== undefined) return win;
  const block = finishing('X');
  if (block !== undefined && Math.random() < 0.8) return block;
  if (b[4] === null && Math.random() < 0.7) return 4;
  return free[Math.floor(Math.random() * free.length)];
};

function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [score, setScore] = useState({ vos: 0, compu: 0 });
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const again = useRef<HTMLButtonElement>(null);
  const win = winnerOf(board);
  const full = board.every(Boolean);
  const over = !!win || full;

  useEffect(() => { focusSoon(cells.current[4]); }, []);

  const play = (i: number) => {
    if (board[i] || over) return;
    const next = [...board];
    next[i] = 'X';
    if (!winnerOf(next) && next.some(c => !c)) next[cpuMove(next)] = 'O';
    setBoard(next);
    const w = winnerOf(next);
    if (w || next.every(Boolean)) {
      if (w) setScore(s => (w.mark === 'X' ? { ...s, vos: s.vos + 1 } : { ...s, compu: s.compu + 1 }));
      focusSoon(again.current);
    }
  };
  const restart = () => {
    setBoard(Array(9).fill(null));
    focusSoon(cells.current[4]);
  };

  useGameKeys(key => {
    const i = cells.current.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return false;
    const r = Math.floor(i / 3), c = i % 3;
    const [nr, nc] = key === 'ArrowUp' ? [r - 1, c] : key === 'ArrowDown' ? [r + 1, c] : key === 'ArrowLeft' ? [r, c - 1] : [r, c + 1];
    if (nr > 2) { again.current?.focus(); return true; }
    if (nr < 0 || nc < 0 || nc > 2) return true;
    cells.current[nr * 3 + nc]?.focus();
    return true;
  });

  const status = win ? (win.mark === 'X' ? '¡Ganaste! 🏆' : 'Ganó la compu 🤖') : full ? 'Empate 🤝' : 'Sos las ❌';

  return (
    <div className="flex items-center gap-[5vmin]">
      <div className="grid grid-cols-3 gap-[1.2vmin] p-[1.2vmin] rounded-[3vmin] bg-white/10">
        {board.map((cell, i) => (
          <button key={i} ref={el => { cells.current[i] = el; }} onClick={() => play(i)}
            className={`${btn} w-[15vmin] h-[15vmin] min-w-20 min-h-20 bg-[#0b0620]/80 text-[10vmin] leading-none flex items-center justify-center ${win?.line.includes(i) ? 'bg-gradient-to-br from-[#ff2e93] to-[#7b2ff7]' : ''}`}>
            {cell === 'X' && <span className="text-[#ff7ac0] animate-in zoom-in duration-200">✕</span>}
            {cell === 'O' && <span className="text-[#00d4ff] animate-in zoom-in duration-200">◯</span>}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center gap-[2vmin] w-[30vmin]">
        <p className="carlmarx-bold text-white text-[clamp(1.4rem,5vmin,3.6rem)] text-center leading-tight">{status}</p>
        <Score a={score.vos} b={score.compu} />
        <button ref={again} onClick={restart} disabled={!over}
          className={`${btn} px-[4vmin] py-[1.6vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-[clamp(1rem,3vmin,2rem)] disabled:opacity-30`}>
          Otra vez
        </button>
      </div>
    </div>
  );
}

function Score({ a, b }: { a: number; b: number }) {
  return (
    <div className="flex items-center gap-[3vmin] text-white text-[clamp(1rem,3vmin,2.2rem)] font-semibold">
      <span>Vos <b className="text-[#ff7ac0]">{a}</b></span>
      <span className="text-white/40">·</span>
      <span>Compu <b className="text-[#00d4ff]">{b}</b></span>
    </div>
  );
}

// ─── ¿Dónde está la pelotita? ────────────────────────────────────────────────

type ShellPhase = 'show' | 'shuffle' | 'pick' | 'reveal';
const SWAP_MS = 420;

function Cup({ lifted }: { lifted: boolean }) {
  return (
    <svg viewBox="0 0 100 110" className="w-full h-full drop-shadow-[0_1.2vmin_1.6vmin_rgba(0,0,0,0.5)] transition-transform duration-300"
      style={{ transform: lifted ? 'translateY(-38%)' : 'none' }} aria-hidden="true">
      <defs>
        <linearGradient id="cup-body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b5174f" />
          <stop offset="0.35" stopColor="#ff2e93" />
          <stop offset="0.6" stopColor="#ff7ac0" />
          <stop offset="1" stopColor="#9c1245" />
        </linearGradient>
      </defs>
      <path d="M18 8h64l12 94H6z" fill="url(#cup-body)" />
      <rect x="14" y="4" width="72" height="10" rx="4" fill="#ffd1e6" />
      <path d="M8 96h84v8H8z" fill="#7a0e37" opacity="0.6" />
      <path d="M30 22l-6 70" stroke="#fff" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function ShellGame() {
  // slot[cup] = lugar donde está cada vaso (0, 1, 2); la pelotita va abajo del vaso `ball`
  const [slot, setSlot] = useState([0, 1, 2]);
  const [ball] = useState(() => Math.floor(Math.random() * 3));
  const [phase, setPhase] = useState<ShellPhase>('show');
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ vos: 0, compu: 0 });
  const [round, setRound] = useState(0);
  const cupBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const again = useRef<HTMLButtonElement>(null);

  // Mostrar → bajar → mezclar (cada vez más rápido según la ronda) → elegir
  useEffect(() => {
    const timers: number[] = [];
    timers.push(window.setTimeout(() => {
      setPhase('shuffle');
      const swaps = 6 + Math.min(round, 4);
      for (let n = 0; n < swaps; n++) {
        timers.push(window.setTimeout(() => {
          setSlot(s => {
            const a = Math.floor(Math.random() * 3);
            const b = (a + 1 + Math.floor(Math.random() * 2)) % 3;
            const next = [...s];
            const ca = next.indexOf(a), cb = next.indexOf(b);
            next[ca] = b; next[cb] = a;
            return next;
          });
        }, n * SWAP_MS));
      }
      timers.push(window.setTimeout(() => {
        setPhase('pick');
        focusSoon(cupBtns.current[1]);
      }, swaps * SWAP_MS + 150));
    }, 1600));
    return () => timers.forEach(t => window.clearTimeout(t));
  }, [round]);

  const pick = (slotIndex: number) => {
    if (phase !== 'pick') return;
    const cup = slot.indexOf(slotIndex);
    setPicked(cup);
    setPhase('reveal');
    setScore(s => (cup === ball ? { ...s, vos: s.vos + 1 } : { ...s, compu: s.compu + 1 }));
    focusSoon(again.current);
  };

  useGameKeys(key => {
    const i = cupBtns.current.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return false;
    if (key === 'ArrowDown') { again.current?.focus(); return true; }
    if (key === 'ArrowLeft' && i > 0) cupBtns.current[i - 1]?.focus();
    if (key === 'ArrowRight' && i < 2) cupBtns.current[i + 1]?.focus();
    return true;
  });

  const showBall = phase === 'show' || phase === 'reveal';
  const status = phase === 'show' ? 'Mirá dónde está la pelotita…'
    : phase === 'shuffle' ? '¡Seguila con la vista!'
    : phase === 'pick' ? '¿Debajo de qué vaso está?'
    : picked === ball ? '¡La encontraste! 🏆' : 'Uy, no era ese 😅';

  return (
    <div className="flex flex-col items-center gap-[2.5vmin]">
      <p className="carlmarx-bold text-white text-[clamp(1.4rem,5vmin,3.6rem)] text-center leading-tight">{status}</p>
      <div className="relative w-[78vmin] h-[24vmin] min-w-80">
        {[0, 1, 2].map(cup => (
          <div key={cup} className="absolute top-0 w-[22vmin] h-full ease-in-out"
            style={{ left: 0, transform: `translateX(${slot[cup] * 28}vmin)`, transition: `transform ${SWAP_MS - 40}ms` }}>
            {/* pelotita */}
            {cup === ball && (
              <div className="absolute bottom-[3%] left-1/2 -translate-x-1/2 w-[6vmin] h-[6vmin] rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#ffd23f_45%,#e09b00)]"
                style={{ opacity: showBall ? 1 : 0 }} />
            )}
            <Cup lifted={phase === 'show' ? cup === ball : phase === 'reveal' ? cup === ball || cup === picked : false} />
          </div>
        ))}
        {/* Botones fijos por lugar (izquierda, medio, derecha): el foco no salta con la mezcla */}
        {[0, 1, 2].map(s => (
          <button key={s} ref={el => { cupBtns.current[s] = el; }} onClick={() => pick(s)} disabled={phase !== 'pick'}
            aria-label={`Vaso ${s + 1}`}
            className="absolute top-0 h-full w-[22vmin] rounded-[2vmin] focus:outline-none focus:ring-[0.6vmin] focus:ring-white disabled:cursor-default"
            style={{ left: `${s * 28}vmin` }} />
        ))}
      </div>
      <Score a={score.vos} b={score.compu} />
      <button ref={again} onClick={() => { setSlot([0, 1, 2]); setPhase('show'); setPicked(null); setRound(r => r + 1); }} disabled={phase !== 'reveal'}
        className={`${btn} px-[4vmin] py-[1.6vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-[clamp(1rem,3vmin,2rem)] disabled:opacity-30`}>
        Otra vez
      </button>
    </div>
  );
}

// ─── Piedra, papel o tijera ──────────────────────────────────────────────────

const HANDS = [
  { id: 0, icon: '✊', label: 'Piedra' },
  { id: 1, icon: '✋', label: 'Papel' },
  { id: 2, icon: '✌️', label: 'Tijera' },
];
// a le gana a b si (a - b + 3) % 3 === 1  (papel > piedra, tijera > papel, piedra > tijera)
const beats = (a: number, b: number) => (a - b + 3) % 3 === 1;

function RockPaperScissors() {
  const [mine, setMine] = useState<number | null>(null);
  const [cpu, setCpu] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);
  const [score, setScore] = useState({ vos: 0, compu: 0 });
  const handBtns = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => { focusSoon(handBtns.current[1]); }, []);

  const play = useCallback((id: number) => {
    if (counting) return;
    setMine(id);
    setCpu(null);
    setCounting(true);
    window.setTimeout(() => {
      const c = Math.floor(Math.random() * 3);
      setCpu(c);
      setCounting(false);
      if (beats(id, c)) setScore(s => ({ ...s, vos: s.vos + 1 }));
      else if (beats(c, id)) setScore(s => ({ ...s, compu: s.compu + 1 }));
    }, 1100);
  }, [counting]);

  useGameKeys(key => {
    const i = handBtns.current.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return false;
    if (key === 'ArrowLeft' && i > 0) handBtns.current[i - 1]?.focus();
    if (key === 'ArrowRight' && i < 2) handBtns.current[i + 1]?.focus();
    if (key === 'ArrowDown') return false;
    return true;
  });

  const status = counting ? 'Piedra… papel… ¡tijera!'
    : mine === null || cpu === null ? 'Elegí tu mano'
    : beats(mine, cpu) ? '¡Ganaste! 🏆' : beats(cpu, mine) ? 'Ganó la compu 🤖' : 'Empate 🤝';

  return (
    <div className="flex flex-col items-center gap-[2.5vmin]">
      <p className="carlmarx-bold text-white text-[clamp(1.4rem,5vmin,3.6rem)] text-center leading-tight">{status}</p>
      <div className="flex items-center gap-[6vmin]">
        <div className="flex flex-col items-center">
          <span className="text-white/60 text-[clamp(0.9rem,2.4vmin,1.6rem)]">Vos</span>
          <span className={`text-[14vmin] leading-none ${counting ? 'animate-bounce' : ''}`}>{mine === null ? '❔' : counting ? '✊' : HANDS[mine].icon}</span>
        </div>
        <span className="carlmarx-bold text-white/50 text-[6vmin]">VS</span>
        <div className="flex flex-col items-center">
          <span className="text-white/60 text-[clamp(0.9rem,2.4vmin,1.6rem)]">Compu</span>
          <span className={`text-[14vmin] leading-none inline-block -scale-x-100 ${counting ? 'animate-bounce' : ''}`}>{counting || cpu === null ? '✊' : HANDS[cpu].icon}</span>
        </div>
      </div>
      <div className="flex gap-[3vmin]">
        {HANDS.map(h => (
          <button key={h.id} ref={el => { handBtns.current[h.id] = el; }} onClick={() => play(h.id)} disabled={counting}
            className={`${btn} kiosk-glass w-[18vmin] min-w-24 py-[1.8vmin] flex flex-col items-center gap-[0.6vmin] hover:bg-white/10 disabled:opacity-60`}>
            <span className="text-[8vmin] leading-none">{h.icon}</span>
            <span className="text-[clamp(0.9rem,2.4vmin,1.6rem)]">{h.label}</span>
          </button>
        ))}
      </div>
      <Score a={score.vos} b={score.compu} />
    </div>
  );
}

// ─── Memotest ────────────────────────────────────────────────────────────────

const MEMO_ICONS = ['📸', '🎉', '🥂', '🎵', '💃', '🎂'];
const MEMO_COLS = 4;
const shuffled = () => [...MEMO_ICONS, ...MEMO_ICONS]
  .map(icon => ({ icon, r: Math.random() }))
  .sort((a, b) => a.r - b.r)
  .map(c => c.icon);

function Memotest() {
  const [cards, setCards] = useState(shuffled);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const again = useRef<HTMLButtonElement>(null);
  const done = found.length === MEMO_ICONS.length;

  useEffect(() => { focusSoon(cells.current[0]); }, []);

  const flip = (i: number) => {
    if (open.length === 2 || open.includes(i) || found.includes(cards[i])) return;
    const next = [...open, i];
    setOpen(next);
    if (next.length < 2) return;
    setMoves(m => m + 1);
    const [a, b] = next;
    if (cards[a] === cards[b]) {
      const nowFound = [...found, cards[a]];
      setFound(nowFound);
      setOpen([]);
      if (nowFound.length === MEMO_ICONS.length) focusSoon(again.current);
    } else {
      window.setTimeout(() => setOpen([]), 800);
    }
  };
  const restart = () => {
    setCards(shuffled());
    setOpen([]);
    setFound([]);
    setMoves(0);
    focusSoon(cells.current[0]);
  };

  useGameKeys(key => {
    const i = cells.current.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return false;
    const rows = cards.length / MEMO_COLS;
    const r = Math.floor(i / MEMO_COLS), c = i % MEMO_COLS;
    const [nr, nc] = key === 'ArrowUp' ? [r - 1, c] : key === 'ArrowDown' ? [r + 1, c] : key === 'ArrowLeft' ? [r, c - 1] : [r, c + 1];
    if (nr >= rows) { again.current?.focus(); return true; }
    if (nr < 0 || nc < 0 || nc >= MEMO_COLS) return true;
    cells.current[nr * MEMO_COLS + nc]?.focus();
    return true;
  });

  return (
    <div className="flex items-center gap-[5vmin]">
      <div className="grid gap-[1.2vmin]" style={{ gridTemplateColumns: `repeat(${MEMO_COLS}, minmax(0, 1fr))` }}>
        {cards.map((icon, i) => {
          const shown = open.includes(i) || found.includes(icon);
          return (
            <button key={i} ref={el => { cells.current[i] = el; }} onClick={() => flip(i)}
              className={`${btn} w-[13vmin] h-[13vmin] min-w-16 min-h-16 flex items-center justify-center text-[8vmin] leading-none transition-colors ${
                shown ? (found.includes(icon) ? 'bg-white/25' : 'bg-white/90') : 'bg-gradient-to-br from-[#ff2e93] to-[#7b2ff7]'}`}>
              {shown ? <span className="animate-in zoom-in duration-200">{icon}</span> : <span className="text-white/70 text-[5vmin]">?</span>}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col items-center gap-[2vmin] w-[28vmin]">
        <p className="carlmarx-bold text-white text-[clamp(1.4rem,5vmin,3.6rem)] text-center leading-tight">
          {done ? '¡Completaste el memotest! 🏆' : 'Encontrá los pares'}
        </p>
        <p className="text-white/80 text-[clamp(1rem,3vmin,2.2rem)] font-semibold">Pares {found.length}/{MEMO_ICONS.length} · Intentos {moves}</p>
        <button ref={again} onClick={restart}
          className={`${btn} px-[4vmin] py-[1.6vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-[clamp(1rem,3vmin,2rem)]`}>
          {done ? 'Otra vez' : 'Mezclar de nuevo'}
        </button>
      </div>
    </div>
  );
}

// ─── Reflejos ────────────────────────────────────────────────────────────────

type ReflexPhase = 'idle' | 'wait' | 'go' | 'early' | 'result';

function Reflexes() {
  const [phase, setPhase] = useState<ReflexPhase>('idle');
  const [ms, setMs] = useState(0);
  const [best, setBest] = useState<number | null>(null);
  const startAt = useRef(0);
  const timer = useRef<number>(0);
  const pad = useRef<HTMLButtonElement>(null);

  useEffect(() => { focusSoon(pad.current); return () => window.clearTimeout(timer.current); }, []);

  const press = () => {
    if (phase === 'idle' || phase === 'early' || phase === 'result') {
      setPhase('wait');
      timer.current = window.setTimeout(() => { startAt.current = performance.now(); setPhase('go'); }, 1500 + Math.random() * 2500);
    } else if (phase === 'wait') {
      window.clearTimeout(timer.current);
      setPhase('early');
    } else {
      const t = Math.round(performance.now() - startAt.current);
      setMs(t);
      setBest(b => (b === null || t < b ? t : b));
      setPhase('result');
    }
  };

  const look = {
    idle: { bg: 'from-[#7b2ff7] to-[#00d4ff]', big: '⚡', text: 'Apretá OK (o tocá) para empezar' },
    wait: { bg: 'from-[#b5174f] to-[#ff4d6d]', big: '✋', text: 'Esperá el verde…' },
    go: { bg: 'from-[#00c853] to-[#64dd17]', big: '¡YA!', text: '¡Apretá ahora!' },
    early: { bg: 'from-[#ff8f00] to-[#ffd23f]', big: '😅', text: '¡Muy temprano! Apretá para probar de nuevo' },
    result: { bg: 'from-[#7b2ff7] to-[#ff2e93]', big: `${ms} ms`, text: ms < 300 ? '¡Rapidísimo! 🏆 Apretá para otra' : 'Apretá para otra' },
  }[phase];

  return (
    <div className="flex flex-col items-center gap-[2.5vmin]">
      <p className="carlmarx-bold text-white text-[clamp(1.4rem,5vmin,3.6rem)] text-center leading-tight">¿Qué tan rápido sos?</p>
      <button ref={pad} onClick={press}
        className={`${btn} w-[70vmin] h-[34vmin] min-w-72 bg-gradient-to-br ${look.bg} flex flex-col items-center justify-center gap-[1.5vmin]`}>
        <span className="carlmarx-bold text-[12vmin] leading-none">{look.big}</span>
        <span className="text-[clamp(1rem,3vmin,2.2rem)]">{look.text}</span>
      </button>
      <p className="text-white/80 text-[clamp(1rem,3vmin,2.2rem)] font-semibold">Mejor tiempo: {best === null ? '—' : `${best} ms`}</p>
    </div>
  );
}

// ─── Simón dice ──────────────────────────────────────────────────────────────

const SIMON_COLORS = [
  { off: 'bg-[#7a0e37]', on: 'bg-[#ff2e93] shadow-[0_0_6vmin_#ff2e93]' },
  { off: 'bg-[#0b4f63]', on: 'bg-[#00d4ff] shadow-[0_0_6vmin_#00d4ff]' },
  { off: 'bg-[#6b5300]', on: 'bg-[#ffd23f] shadow-[0_0_6vmin_#ffd23f]' },
  { off: 'bg-[#3a1773]', on: 'bg-[#b14bff] shadow-[0_0_6vmin_#b14bff]' },
];

function SimonSays() {
  const [seq, setSeq] = useState<number[]>(() => [Math.floor(Math.random() * 4)]);
  const [lit, setLit] = useState<number | null>(null);
  const [phase, setPhase] = useState<'show' | 'play' | 'lost'>('show');
  const [pos, setPos] = useState(0);
  const [best, setBest] = useState(0);
  const pads = useRef<(HTMLButtonElement | null)[]>([]);
  const again = useRef<HTMLButtonElement>(null);
  const timers = useRef<number[]>([]);

  // Muestra la secuencia encendiendo cada color
  useEffect(() => {
    if (phase !== 'show') return;
    const ts = timers.current;
    seq.forEach((c, i) => {
      ts.push(window.setTimeout(() => setLit(c), 700 + i * 650));
      ts.push(window.setTimeout(() => setLit(null), 700 + i * 650 + 420));
    });
    ts.push(window.setTimeout(() => { setPhase('play'); setPos(0); focusSoon(pads.current[0]); }, 700 + seq.length * 650));
    return () => { ts.forEach(t => window.clearTimeout(t)); timers.current = []; };
  }, [seq, phase]);

  const press = (c: number) => {
    if (phase !== 'play') return;
    setLit(c);
    window.setTimeout(() => setLit(l => (l === c ? null : l)), 220);
    if (seq[pos] !== c) {
      setPhase('lost');
      setBest(b => Math.max(b, seq.length - 1));
      focusSoon(again.current);
      return;
    }
    if (pos + 1 === seq.length) {
      setBest(b => Math.max(b, seq.length));
      window.setTimeout(() => { setSeq(s => [...s, Math.floor(Math.random() * 4)]); setPhase('show'); }, 450);
    } else {
      setPos(pos + 1);
    }
  };

  useGameKeys(key => {
    const i = pads.current.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return false;
    const r = Math.floor(i / 2), c = i % 2;
    const [nr, nc] = key === 'ArrowUp' ? [r - 1, c] : key === 'ArrowDown' ? [r + 1, c] : key === 'ArrowLeft' ? [r, c - 1] : [r, c + 1];
    if (nr > 1) { again.current?.focus(); return true; }
    if (nr < 0 || nc < 0 || nc > 1) return true;
    pads.current[nr * 2 + nc]?.focus();
    return true;
  });

  const status = phase === 'show' ? 'Mirá la secuencia…' : phase === 'play' ? '¡Repetila!' : `¡Uy! Llegaste a ${seq.length - 1}`;

  return (
    <div className="flex items-center gap-[5vmin]">
      <div className="grid grid-cols-2 gap-[1.6vmin]">
        {SIMON_COLORS.map((c, i) => (
          <button key={i} ref={el => { pads.current[i] = el; }} onClick={() => press(i)} disabled={phase !== 'play'}
            aria-label={`Color ${i + 1}`}
            className={`${btn} w-[18vmin] h-[18vmin] min-w-24 min-h-24 transition-all duration-150 disabled:cursor-default ${lit === i ? c.on : c.off}`} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-[2vmin] w-[30vmin]">
        <p className="carlmarx-bold text-white text-[clamp(1.4rem,5vmin,3.6rem)] text-center leading-tight">{status}</p>
        <p className="text-white/80 text-[clamp(1rem,3vmin,2.2rem)] font-semibold">Nivel {seq.length} · Récord {best}</p>
        <button ref={again} disabled={phase !== 'lost'}
          onClick={() => { setSeq([Math.floor(Math.random() * 4)]); setPhase('show'); }}
          className={`${btn} px-[4vmin] py-[1.6vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-[clamp(1rem,3vmin,2rem)] disabled:opacity-30`}>
          Otra vez
        </button>
      </div>
    </div>
  );
}

// ─── Trivia de la fiesta ─────────────────────────────────────────────────────

const shuffle = <T,>(list: T[]) => list.map(v => ({ v, r: Math.random() })).sort((a, b) => a.r - b.r).map(x => x.v);

function Trivia() {
  const [questions, setQuestions] = useState(() => shuffle(validTrivia(getGeneralSettings().triviaQuestions)));
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const first = useRef<HTMLButtonElement>(null);
  const again = useRef<HTMLButtonElement>(null);
  const finished = index >= questions.length;
  const q = questions[index];

  useEffect(() => { if (!finished) focusSoon(first.current); else focusSoon(again.current); }, [index, finished]);

  useGameKeys(key => {
    const opts = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-trivia-option]'));
    const i = opts.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0 || (key !== 'ArrowUp' && key !== 'ArrowDown')) return false;
    if (key === 'ArrowDown' && i === opts.length - 1) return false;
    opts[Math.max(0, key === 'ArrowUp' ? i - 1 : i + 1)]?.focus();
    return true;
  });

  const answer = (i: number) => {
    if (chosen !== null) return;
    setChosen(i);
    if (i === q.answer) setScore(s => s + 1);
    window.setTimeout(() => { setChosen(null); setIndex(n => n + 1); }, 1600);
  };

  if (finished) return (
    <div className="flex flex-col items-center gap-[2.5vmin]">
      <p className="text-[10vmin] leading-none">{score === questions.length ? '🏆' : '🎉'}</p>
      <p className="carlmarx-bold text-white text-[clamp(1.6rem,6vmin,4.4rem)] text-center leading-tight">
        Acertaste {score} de {questions.length}
      </p>
      <button ref={again} onClick={() => { setQuestions(shuffle(questions)); setIndex(0); setScore(0); }}
        className={`${btn} px-[4vmin] py-[1.6vmin] bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7] text-[clamp(1rem,3vmin,2rem)]`}>
        Otra vez
      </button>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-[2.2vmin] w-[80vmin] max-w-[92vw]">
      <p className="text-white/60 text-[clamp(0.9rem,2.4vmin,1.6rem)]">Trivia de la fiesta · {index + 1}/{questions.length} · Aciertos {score}</p>
      <p className="carlmarx-bold text-white text-[clamp(1.4rem,5.4vmin,4rem)] text-center leading-tight">{q.q}</p>
      <div className="w-full flex flex-col gap-[1.4vmin]">
        {q.options.map((o, i) => o?.trim() && (
          <button key={i} ref={i === 0 ? first : undefined} onClick={() => answer(i)} data-trivia-option
            className={`${btn} w-full px-[3vmin] py-[1.8vmin] text-[clamp(1rem,3.2vmin,2.4rem)] text-left ${
              chosen === null ? 'kiosk-glass hover:bg-white/10'
                : i === q.answer ? 'bg-[#00c853]'
                : i === chosen ? 'bg-[#d50000]' : 'bg-white/10 opacity-60'}`}>
            {o}{chosen !== null && i === q.answer ? '  ✓' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
