import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Film, Trash2, Upload } from 'lucide-react';
import {
  customKey, getScreenBackground, getScreenMedia, MAX_MEDIA_BYTES, removeScreenMedia, saveScreenMedia,
  SCREENS, setScreenBackground, type ScreenKey,
} from '@/lib/kioskMedia';
import { SPLASH_STYLES } from '@/lib/kioskSettings';
import { buttonClass, Panel } from './ui';

const BUILT_IN = [
  { value: 'aurora', label: 'Aurora' },
  ...SPLASH_STYLES.map(s => ({ value: s.value as string, label: s.label })),
  { value: '1', label: 'Video 1' },
  { value: '2', label: 'Video 2' },
  { value: '3', label: 'Video 3' },
];

function ScreenRow({ screen, label, hint }: { screen: ScreenKey; label: string; hint: string }) {
  const [value, setValue] = useState(() => getScreenBackground(screen));
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getScreenMedia(screen).then(rec => setFileName(rec?.name ?? null)).catch(() => {});
  }, [screen]);

  const choose = (v: string) => {
    setScreenBackground(screen, v);
    setValue(v);
  };

  const upload = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      toast.error('Pesa más de 40 MB. Exportalo más liviano.');
      return;
    }
    setBusy(true);
    try {
      await saveScreenMedia(screen, file);
      setFileName(file.name);
      choose(customKey(screen));
      toast.success(`Fondo de "${label}" cargado`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el archivo');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    await removeScreenMedia(screen);
    setFileName(null);
    if (value === customKey(screen)) choose(screen === 'splash' ? 'polaroids' : 'aurora');
  };

  const chip = (selected: boolean) =>
    `rounded-xl px-4 py-2 font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${selected ? 'bg-gradient-to-r from-[#ff2e93] to-[#7b2ff7]' : 'bg-white/10 hover:bg-white/20'}`;

  return (
    <div className="rounded-2xl bg-black/20 border border-white/10 p-5 space-y-3">
      <div>
        <p className="text-lg font-bold">{label}</p>
        <p className="text-white/50 text-sm">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {BUILT_IN.map(o => (
          <button key={o.value} onClick={() => choose(o.value)} className={chip(value === o.value)}>{o.label}</button>
        ))}
        {fileName && (
          <button onClick={() => choose(customKey(screen))} className={chip(value === customKey(screen))}>
            <Film className="inline w-4 h-4 mr-1" /> Propio
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept="video/mp4,video/webm,image/png,image/jpeg,image/webp" className="hidden"
          onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy} className={buttonClass}>
          <Upload className="w-5 h-5" /> {busy ? 'Guardando…' : fileName ? 'Cambiar video/imagen' : 'Subir video o imagen'}
        </button>
        {fileName && (
          <>
            <span className="text-white/60 truncate max-w-xs">{fileName}</span>
            <button onClick={remove} className={buttonClass} aria-label="Quitar archivo"><Trash2 className="w-5 h-5" /></button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BackgroundsSection() {
  return (
    <div className="space-y-6">
      <Panel title="Fondos de las pantallas" description="Cada pantalla del kiosco puede tener su animación. Podés usar las incluidas o subir tus propios videos.">
        <div className="rounded-2xl bg-[#00d4ff]/10 border border-[#00d4ff]/30 p-5 space-y-1 text-white/85">
          <p className="font-bold text-white">Medidas para tus videos</p>
          <p>• Tele horizontal: <b>1920 × 1080</b> · Tele vertical: <b>1080 × 1920</b></p>
          <p>• Video <b>MP4 (H.264)</b>, sin sonido, de <b>10 a 20 segundos</b> que empalme al repetirse (loop).</p>
          <p>• Hasta 40 MB (ideal menos de 15 MB). También sirven imágenes PNG o JPG.</p>
          <p>• Dejá el centro tranquilo: ahí van los textos y botones.</p>
        </div>
      </Panel>
      {SCREENS.map(s => <ScreenRow key={s.key} screen={s.key} label={s.label} hint={s.hint} />)}
    </div>
  );
}
