import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Loader2, Plus, Save, Sparkles, Wand2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { coverOptionsFrom } from '@/lib/magazineCover';
import { useCoverPreview } from '@/hooks/use-cover-preview';
import { btnGhost, btnPrimary, card, Check, Field, input, Select } from './ui';

// Temáticas de "Retrato mágico" (tabla ai_themes): editar el prompt, probarlo con
// una foto propia (con la sesión del panel no gasta créditos de clientes, pero sí
// saldo de fal.ai) y guardar el resultado como imagen de muestra del kiosco.

interface ThemeRow {
  id: string;
  name: string;
  category: string | null;
  emoji: string | null;
  prompt: string;
  max_people: number | null;
  preview_url: string | null;
  is_active: boolean;
  result_style?: string | null;
  sort_order?: number | null;
}

// Experiencias con botón propio en el kiosco (no aparecen en Retrato Mágico)
const SPECIAL: Record<string, string> = {
  cover: 'Experiencia "Portada Fashion IA": el resultado va dentro de la tapa de revista con el nombre del invitado.',
  caricatura: 'Experiencia "Caricatura con Messi" (botón propio en Fotos IA).',
  figurita: 'Experiencia "Hacer figurita": solo quita el fondo de la foto (no usa prompt) y después el invitado arma su figurita.',
};

const CATEGORIES = [
  { value: 'especial', label: '⭐ Experiencias especiales' },
  { value: 'deportes', label: '⚽ Deportes' },
  { value: 'fantasia', label: '🏰 Fantasía' },
  { value: 'epocas', label: '🕰️ Épocas' },
  { value: 'arte', label: '🎨 Arte y animación' },
  { value: 'moda', label: '👗 Moda' },
  { value: 'aventura', label: '🌿 Aventura' },
  { value: 'scifi', label: '🤖 Sci-Fi' },
];

const EDIT_TEMPLATE = 'Edit this photo. Keep every person exactly as they are: same face, facial features, skin tone, age, body shape, hairstyle and expression, so each one is instantly recognizable. Do not add, remove or merge people, and keep their poses. Dress them as ... Replace the background with ... Photorealistic, high detail, lighting consistent across the whole image. No text, no logos, no watermark.';

/** Corre la IA con la sesión del panel (sin equipo) y espera el resultado. */
async function runTest(imageUrl: string, prompt: string, removeBg = false): Promise<string> {
  const body = removeBg ? { imageUrl, action: 'remove_bg' } : { imageUrl, prompt };
  const { data, error } = await supabase.functions.invoke('generate-ai-photo', { body });
  if (error || !data?.success) throw new Error(error?.message || data?.error || 'No se pudo iniciar la IA');
  let prediction = data.prediction;
  for (let i = 0; i < 60 && prediction.status !== 'succeeded' && prediction.status !== 'failed'; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const poll = await supabase.functions.invoke('generate-ai-photo', { body: { predictionId: prediction.id } });
    if (poll.data?.success) prediction = poll.data.prediction;
  }
  if (prediction.status !== 'succeeded' || !prediction.output) throw new Error(prediction.error || 'La IA no terminó a tiempo');
  return prediction.output as string;
}

export default function ThemesTab() {
  const [themes, setThemes] = useState<ThemeRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const load = useCallback(async () => {
    let res = await supabase.from('ai_themes').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('name');
    if (res.error) res = await supabase.from('ai_themes').select('*').order('name');
    if (res.error) toast.error(`No se pudieron cargar las temáticas: ${res.error.message}`);
    else setThemes((res.data ?? []) as ThemeRow[]);
  }, []);
  useEffect(() => {
    const t = window.setTimeout(load, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const create = async () => {
    const name = window.prompt('Nombre de la temática nueva');
    if (!name?.trim()) return;
    const { data, error } = await supabase.from('ai_themes')
      .insert({ name: name.trim(), category: 'fantasia', prompt: EDIT_TEMPLATE, max_people: 4, emoji: '✨', is_active: false })
      .select('id').single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
    setSelected(data.id);
  };

  const visible = themes.filter(t => showInactive || t.is_active);
  const current = themes.find(t => t.id === selected) ?? null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={create} className={btnPrimary}><Plus className="h-4 w-4" /> Nueva temática</button>
          <button onClick={() => setShowInactive(s => !s)} className={btnGhost}>{showInactive ? 'Solo activas' : 'Ver desactivadas'}</button>
        </div>
        <p className="text-xs text-slate-500">{themes.filter(t => t.is_active).length} activas · las desactivadas no aparecen en los equipos.</p>
        <div className="max-h-[70vh] space-y-1.5 overflow-y-auto pr-1">
          {visible.map(t => (
            <button key={t.id} onClick={() => setSelected(t.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left ${selected === t.id ? 'border-violet-500 bg-violet-500/10' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800/60'} ${t.is_active ? '' : 'opacity-50'}`}>
              {t.preview_url
                ? <img src={t.preview_url} alt="" className="h-12 w-9 shrink-0 rounded-md object-cover" />
                : <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 text-lg">{t.emoji || '🎨'}</span>}
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{t.name}</span>
                <span className="text-xs text-slate-400">{CATEGORIES.find(c => c.value === t.category)?.label ?? t.category}{t.preview_url ? '' : ' · sin muestra'}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
      <div>
        {current
          ? <ThemeEditor key={current.id} theme={current} onSaved={load} />
          : <div className={`${card} flex min-h-[240px] items-center justify-center text-slate-400`}><Wand2 className="mr-2 h-5 w-5" /> Elegí una temática para editarla y probarla.</div>}
      </div>
    </div>
  );
}

function ThemeEditor({ theme, onSaved }: { theme: ThemeRow; onSaved: () => void }) {
  const [form, setForm] = useState(theme);
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [usingResult, setUsingResult] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ThemeRow>(k: K, v: ThemeRow[K]) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('ai_themes').update({
      name: form.name.trim(), category: form.category, emoji: form.emoji, prompt: form.prompt,
      max_people: form.max_people, is_active: form.is_active,
    }).eq('id', theme.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Temática guardada');
      onSaved();
    }
  };

  // La foto de prueba se sube al bucket público del kiosco para que la IA pueda leerla
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    const path = `theme-tests/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('kiosk-assets').upload(path, file, { contentType: file.type || 'image/jpeg' });
    if (error) {
      toast.error(`No se pudo subir la foto: ${error.message}`);
      return;
    }
    setPhoto(supabase.storage.from('kiosk-assets').getPublicUrl(path).data.publicUrl);
    setResult(null);
  };

  const test = async () => {
    if (!photo) return;
    setRunning(true);
    setResult(null);
    try {
      setResult(await runTest(photo, form.prompt, form.result_style === 'figurita'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  // Guarda el resultado en el bucket (las URLs de fal.ai vencen) y lo deja como muestra
  const useAsPreview = async () => {
    if (!result) return;
    setUsingResult(true);
    let url = result;
    try {
      const blob = await (await fetch(result)).blob();
      const path = `themes/${theme.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('kiosk-assets').upload(path, blob, { contentType: blob.type || 'image/jpeg' });
      if (!error) url = supabase.storage.from('kiosk-assets').getPublicUrl(path).data.publicUrl;
    } catch {
      toast.warning('No se pudo copiar la imagen: se guarda el link de fal.ai, que puede vencer.');
    }
    const { error } = await supabase.from('ai_themes').update({ preview_url: url }).eq('id', theme.id);
    setUsingResult(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Imagen de muestra actualizada');
      onSaved();
    }
  };

  return (
    <div className="space-y-5">
      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xl font-bold text-white">{form.emoji} {form.name}</h3>
          <button onClick={save} disabled={saving} className={btnPrimary}><Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar'}</button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_90px_1fr_120px]">
          <Field label="Nombre"><input className={input} value={form.name} onChange={e => set('name', e.target.value)} /></Field>
          <Field label="Emoji"><input className={input} value={form.emoji ?? ''} onChange={e => set('emoji', e.target.value)} /></Field>
          <Field label="Categoría">
            <Select value={form.category ?? 'fantasia'} options={CATEGORIES} onChange={v => set('category', v)} />
          </Field>
          <Field label="Personas">
            <Select value={form.max_people ?? 1} options={[1, 2, 3, 4].map(n => ({ value: n, label: n === 4 ? 'Grupo' : String(n) }))} onChange={v => set('max_people', v)} />
          </Field>
        </div>
        <Field label="Prompt (en inglés)" hint='Formato de edición: "Edit this photo. Keep every person exactly as they are… Dress them as… Replace the background with…". Así la IA conserva las caras.'>
          <textarea className={`${input} min-h-[180px] font-mono text-sm disabled:opacity-50`} value={form.prompt} disabled={form.result_style === 'figurita'} onChange={e => set('prompt', e.target.value)} />
        </Field>
        {form.result_style && SPECIAL[form.result_style] && <p className="text-sm text-violet-300">{SPECIAL[form.result_style]}</p>}
        <Check label="Activa (aparece en los equipos)" checked={form.is_active} onChange={v => set('is_active', v)} />
      </div>

      <div className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white">Probar con una foto</h3>
            <p className="text-xs text-slate-400">Usa el prompt de arriba aunque no lo hayas guardado. Cada prueba gasta saldo de fal.ai (no créditos de clientes).</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} className={btnGhost}><ImagePlus className="h-4 w-4" /> {photo ? 'Otra foto' : 'Elegir foto'}</button>
            <button onClick={test} disabled={!photo || running} className={btnPrimary}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {running ? 'Generando…' : 'Probar'}
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Preview label="Foto original" src={photo} />
          <Preview label="Resultado" src={result} loading={running} cover={form.result_style === 'cover'} />
          <Preview label="Muestra actual en el kiosco" src={theme.preview_url} cover={form.result_style === 'cover'} />
        </div>
        {result && (
          <button onClick={useAsPreview} disabled={usingResult} className={btnPrimary}>
            <Save className="h-4 w-4" /> {usingResult ? 'Guardando…' : 'Usar el resultado como muestra'}
          </button>
        )}
      </div>
    </div>
  );
}

// Portada Fashion IA: la muestra se ve dentro de la tapa de revista, como en el kiosco
// (con los textos de portada por defecto; cada equipo usa los suyos)
const DEFAULT_COVER = coverOptionsFrom({});

function Preview({ label, src, loading, cover }: { label: string; src: string | null; loading?: boolean; cover?: boolean }) {
  const coverUrl = useCoverPreview(cover ? src : null, DEFAULT_COVER);
  if (cover && src && coverUrl) src = coverUrl;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        {loading ? <Loader2 className="h-8 w-8 animate-spin text-violet-300" />
          : src ? <a href={src} target="_blank" rel="noreferrer" className="h-full w-full"><img src={src} alt={label} className="h-full w-full object-cover" /></a>
          : <span className="text-xs text-slate-600">—</span>}
      </div>
    </div>
  );
}
