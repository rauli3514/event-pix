import type { ReactElement, ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { VIDEO_ACCESSORIES } from '@/lib/videoBooth/accessories';
import {
  ANIMATIONS, BUILT_IN_ANIMATIONS, estimateDuration, RAMP_PRESETS, resolveMode, SPEEDS, speedLabel, VIDEO_FILTERS, VIDEO_MODES,
  type AnimationKey, type RampConfig, type VideoBoothSettings, type VideoModeConfig, type VideoModeKey,
} from '@/lib/videoBooth/settings';

// Ajustes de una experiencia (pestaña propia): duración, filtro, música, marco,
// animación, accesorio, cuenta regresiva y lo propio de cada una (rampa del 360,
// vueltas del boomerang, velocidad de la cámara lenta). Lo que no se toca usa lo
// de "General". Se usa en el equipo y en el panel, cada uno con sus piezas.

type Opt<T> = { value: T; label: string };
export interface ModeKit {
  Group: (p: { title: string; description?: string; children: ReactNode }) => ReactElement;
  Toggle: (p: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => ReactElement;
  Pick: <T extends string | number>(p: { label: string; value: T; options: Opt<T>[]; onChange: (v: T) => void }) => ReactElement;
  Multi: (p: { label: string; values: string[]; options: Opt<string>[]; onChange: (v: string[]) => void }) => ReactElement;
  Range: (p: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) => ReactElement;
  Button: (p: { onClick: () => void; disabled?: boolean; children: ReactNode }) => ReactElement;
  Note: (p: { children: ReactNode }) => ReactElement;
}

const GENERAL = '';
const fmtSeconds = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')} min` : `${Math.round(n * 10) / 10} s`);

export default function ModeEditor({ modeKey, s, frames, songs, backgrounds = [], onChange, kit }: {
  modeKey: VideoModeKey;
  /** Ajustes completos (para ver lo de General) */
  s: VideoBoothSettings;
  frames: Opt<string>[];
  songs: Opt<string>[];
  /** Fondos de las pantallas para elegir */
  backgrounds?: Opt<string>[];
  onChange: (patch: Partial<VideoModeConfig>) => void;
  kit: ModeKit;
}) {
  const { Group, Toggle, Pick, Multi, Range, Note } = kit;
  const def = VIDEO_MODES.find(m => m.key === modeKey)!;
  const own = s.modes?.[modeKey] ?? {};
  const r = resolveMode(modeKey, s);
  const c = r.cfg;
  const seconds = Math.min(def.maxSeconds, Math.max(def.minSeconds, c.seconds));
  const finalSeconds = estimateDuration(r, seconds);

  return (
    <>
      <Group title={def.label} description={def.hint}>
        <Toggle label="Experiencia activada" hint="Aparece en la pantalla “¿Qué video hacemos?”" checked={c.enabled} onChange={v => onChange({ enabled: v })} />
        <Range label={`${def.guestbook || def.canStop ? 'Duración máxima' : 'Segundos de grabación'}: ${fmtSeconds(seconds)}`}
          value={seconds} min={def.minSeconds} max={def.maxSeconds} step={def.stepSeconds} onChange={v => onChange({ seconds: v })} />
        {def.effect !== 'none' && <Note>El video final dura cerca de {fmtSeconds(finalSeconds)} (con los efectos).</Note>}
        <Pick label="Filtro" value={c.filter} options={VIDEO_FILTERS.map(f => ({ value: f.value, label: f.label }))} onChange={v => onChange({ filter: v })} />
        <Pick label="Cuenta regresiva" value={own.countdown ?? -1} onChange={v => onChange({ countdown: v < 0 ? undefined : v })}
          options={[{ value: -1, label: `Como en General (${s.countdown ?? 3 ? `${s.countdown ?? 3} s` : 'sin cuenta'})` }, ...[0, 3, 5, 10].map(n => ({ value: n, label: n ? `${n} s` : 'Sin cuenta' }))]} />
        {backgrounds.length > 0 && (
          <Pick label="Fondo de las pantallas (inicio, pregunta, resultado)" value={own.background ?? GENERAL} onChange={v => onChange({ background: v || undefined })}
            options={[{ value: GENERAL, label: 'Como en General' }, ...backgrounds]} />
        )}
      </Group>

      {def.effect === 'ramp' && <RampEditor ramp={r.ramp} seconds={seconds} onChange={ramp => onChange({ ramp })} kit={kit} />}
      {def.effect === 'boomerang' && (
        <Group title="Boomerang" description="Cuántas veces va y vuelve, y a qué velocidad.">
          <Range label={`Idas y vueltas: ${r.loops}`} value={r.loops} min={1} max={8} step={1} onChange={v => onChange({ loops: v })} />
          <Pick label="Velocidad" value={r.speed} onChange={v => onChange({ speed: v })}
            options={SPEEDS.filter(x => x >= 0.5 && x <= 2).map(x => ({ value: x, label: speedLabel(x) }))} />
        </Group>
      )}
      {def.effect === 'slowmo' && (
        <Group title="Cámara lenta">
          <Pick label="Velocidad" value={r.slowSpeed} onChange={v => onChange({ slowSpeed: v })}
            options={[0.75, 0.5, 0.33, 0.25].map(x => ({ value: x, label: `${speedLabel(x)}${x === 0.25 ? ' (necesita 60 fps)' : ''}` }))} />
        </Group>
      )}

      <Group title="Música y sonido">
        <Toggle label="Música de fondo" hint={songs.length ? undefined : 'Primero cargá canciones en Biblioteca'} checked={c.music} onChange={v => onChange({ music: v })} />
        {c.music && (
          <Pick label="Canción de esta experiencia" value={own.songId ?? GENERAL} onChange={v => onChange({ songId: v || undefined })}
            options={[{ value: GENERAL, label: 'Como en General' }, { value: 'random', label: 'Una al azar' }, { value: 'guest', label: 'La elige el invitado' }, ...songs]} />
        )}
        {def.effect === 'none' && <Toggle label="Sonido del ambiente" hint="Micrófono de la cámara" checked={c.mic} onChange={v => onChange({ mic: v })} />}
      </Group>

      <Group title="Marco (plantilla)">
        <Pick label="Marco de esta experiencia" value={own.overlay ?? GENERAL} onChange={v => onChange({ overlay: (v || undefined) as VideoModeConfig['overlay'] })}
          options={[{ value: GENERAL, label: 'Como en General' }, { value: 'none', label: 'Sin marco' }, { value: 'title', label: 'Nombre del evento' }, { value: 'custom', label: 'PNG' }]} />
        {r.overlay === 'custom' && (frames.length ? (
          <>
            <Pick label="Marco PNG" value={own.frameId ?? GENERAL} onChange={v => onChange({ frameId: v || undefined })}
              options={[{ value: GENERAL, label: 'Como en General' }, ...frames]} />
            <Toggle label="El invitado elige el marco" hint="Con más de un marco cargado" checked={r.frameChoice} onChange={v => onChange({ frameChoice: v })} />
          </>
        ) : <Note>Elegí o cargá marcos en Biblioteca.</Note>)}
      </Group>

      <Group title="Animación y accesorio" description="Se mueven encima del video. “Al azar” cambia en cada video.">
        <Pick label="Animación" value={own.animation ?? GENERAL} onChange={v => onChange({ animation: (v || undefined) as VideoModeConfig['animation'] })}
          options={[{ value: GENERAL, label: 'Como en General' }, { value: 'random', label: 'Al azar' }, ...ANIMATIONS.map(a => ({ value: a.value as string, label: a.label }))]} />
        {(r.animation === 'random' || r.fxChoice) && (
          <Multi label="Animaciones para el azar y para elegir" values={r.animationPool} onChange={v => onChange({ animationPool: v as AnimationKey[] })}
            options={BUILT_IN_ANIMATIONS.map(a => ({ value: a, label: ANIMATIONS.find(x => x.value === a)!.label }))} />
        )}
        <Pick label="Accesorio en la cara" value={own.accessory ?? GENERAL} onChange={v => onChange({ accessory: v || undefined })}
          options={[{ value: GENERAL, label: 'Como en General' }, { value: 'none', label: 'Ninguno' }, { value: 'random', label: 'Al azar' }, ...VIDEO_ACCESSORIES]} />
        <Toggle label="El invitado elige en la pantalla de la toma" hint="Botón “Efectos” antes de grabar: cambia la animación y el accesorio en vivo"
          checked={r.fxChoice} onChange={v => onChange({ fxChoice: v })} />
      </Group>
    </>
  );
}

const SPEED_COLORS: Record<string, string> = { slow: '#2ee6a6', normal: '#00d4ff', fast: '#ff2e93' };
const speedColor = (v: number) => (v < 1 ? SPEED_COLORS.slow : v > 1 ? SPEED_COLORS.fast : SPEED_COLORS.normal);

/** Editor de la rampa de velocidad del 360: tramos y final en reversa. */
export function RampEditor({ ramp, seconds, onChange, kit }: { ramp: RampConfig; seconds: number; onChange: (r: RampConfig) => void; kit: ModeKit }) {
  const { Group, Toggle, Pick, Range, Button, Note } = kit;
  const segs = [...ramp.segments].sort((a, b) => a.until - b.until);
  const preset = RAMP_PRESETS.find(p => JSON.stringify(p.ramp) === JSON.stringify({ ...ramp, segments: segs }))?.value ?? 'custom';
  const setSegs = (list: RampConfig['segments']) => onChange({ ...ramp, segments: list });
  const tail = ramp.tail;
  const setTail = (patch: Partial<RampConfig['tail']>) => onChange({ ...ramp, tail: { ...tail, ...patch } });

  // Lo que dura cada tramo en el video final (para la barra)
  const pieces: { label: string; secs: number; color: string; rev?: boolean }[] = [];
  let from = 0;
  for (const sg of segs) {
    const until = Math.min(1, sg.until);
    pieces.push({ label: speedLabel(sg.speed), secs: ((until - from) * seconds) / sg.speed, color: speedColor(sg.speed) });
    from = until;
  }
  if (tail.enabled) {
    for (const part of tail.parts) pieces.push({ label: part === 'rev' ? `⟲ ${speedLabel(tail.speed)}` : speedLabel(tail.speed), secs: Math.min(tail.seconds, seconds) / tail.speed, color: part === 'rev' ? '#ffd23f' : speedColor(tail.speed), rev: part === 'rev' });
  }
  const total = pieces.reduce((a, p) => a + p.secs, 0) || 1;

  return (
    <Group title="Rampa de velocidad" description="Cómo cambia la velocidad a lo largo del video del 360. Elegí una lista o armá la tuya.">
      <Pick label="Rampa" value={preset} onChange={v => { const p = RAMP_PRESETS.find(x => x.value === v); if (p) onChange(p.ramp); }}
        options={[...RAMP_PRESETS.map(p => ({ value: p.value, label: p.label })), ...(preset === 'custom' ? [{ value: 'custom', label: 'Personalizada' }] : [])]} />
      <div className="space-y-1.5">
        <div className="flex h-12 w-full overflow-hidden rounded-xl ring-1 ring-white/15">
          {pieces.map((p, i) => (
            <div key={i} className="flex items-center justify-center text-xs font-bold text-black/80 border-r border-black/30 last:border-r-0 overflow-hidden whitespace-nowrap"
              style={{ width: `${(p.secs / total) * 100}%`, background: p.rev ? `repeating-linear-gradient(135deg, ${p.color} 0 8px, #ffe07a 8px 16px)` : p.color }}>
              {p.secs / total > 0.08 ? p.label : ''}
            </div>
          ))}
        </div>
        <p className="text-xs opacity-60">Verde = lento · Celeste = normal · Rosa = rápido · Rayado = reversa. Total cerca de {Math.round(total * 10) / 10} s con {seconds} s de giro.</p>
      </div>
      {segs.map((sg, i) => {
        const prev = i ? segs[i - 1].until : 0;
        const last = i === segs.length - 1;
        return (
          <div key={i} className="rounded-xl border border-white/10 p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold">Tramo {i + 1}: del {Math.round(prev * 100)}% al {last ? 100 : Math.round(sg.until * 100)}% del giro</p>
              {segs.length > 1 && <Button onClick={() => setSegs(segs.filter((_, k) => k !== i).map((x, k, arr) => (k === arr.length - 1 ? { ...x, until: 1 } : x)))}><Trash2 className="w-4 h-4" /> Quitar</Button>}
            </div>
            {!last && Math.round(segs[i + 1].until * 100) - 5 > Math.round(prev * 100) + 5 && (
              <Range label={`Termina en el ${Math.round(sg.until * 100)}%`} value={Math.round(sg.until * 100)} step={5}
                min={Math.round(prev * 100) + 5} max={Math.round((segs[i + 1].until) * 100) - 5}
                onChange={v => setSegs(segs.map((x, k) => (k === i ? { ...x, until: v / 100 } : x)))} />
            )}
            <Pick label="Velocidad" value={sg.speed} onChange={v => setSegs(segs.map((x, k) => (k === i ? { ...x, speed: v } : x)))}
              options={SPEEDS.map(x => ({ value: x, label: speedLabel(x) }))} />
          </div>
        );
      })}
      {segs.length < 5 && (
        <Button onClick={() => {
          // Parte el último tramo a la mitad
          const lastSeg = segs[segs.length - 1];
          const start = segs.length > 1 ? segs[segs.length - 2].until : 0;
          const mid = Math.round(((start + 1) / 2) * 20) / 20;
          if (mid <= start || mid >= 1) return;
          setSegs([...segs.slice(0, -1), { ...lastSeg, until: mid }, { until: 1, speed: lastSeg.speed >= 1 ? 0.5 : 2 }]);
        }}><Plus className="w-4 h-4" /> Agregar tramo</Button>
      )}
      <Toggle label="Final en reversa" hint="Con los últimos segundos del giro" checked={tail.enabled} onChange={v => setTail({ enabled: v })} />
      {tail.enabled && (
        <>
          <Pick label="Cómo termina" value={tail.parts.join('-')} onChange={v => setTail({ parts: v.split('-') as ('rev' | 'fwd')[] })}
            options={[{ value: 'rev', label: 'Reversa' }, { value: 'rev-fwd', label: 'Reversa y otra vez adelante' }, { value: 'rev-fwd-rev', label: 'Reversa, adelante y reversa' }]} />
          <Pick label="Velocidad del final" value={tail.speed} onChange={v => setTail({ speed: v })} options={SPEEDS.map(x => ({ value: x, label: speedLabel(x) }))} />
          <Range label={`Segundos que repite: ${tail.seconds} s`} value={tail.seconds} min={1} max={3} step={0.5} onChange={v => setTail({ seconds: v })} />
          <Note>La reversa usa los últimos segundos guardados en memoria (hasta 3 s).</Note>
        </>
      )}
    </Group>
  );
}
