import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, ImagePlus, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { BUILT_IN_FRAMES, SPLASH_STYLES, SPLASH_VIDEOS } from '@/lib/kioskSettings';
import { GLASS_PREFIX, GLASS_STYLES } from '@/lib/glassFrame';
import { NAME_STYLES } from '@/components/kiosk/attractStyles';
import type { RemoteSettings } from '@/lib/kioskRemote';
import { btnGhost, btnPrimary, Check, Field, input, Section, Select } from './ui';
import type { KioskDeviceRow } from './types';

// Ajustes de un equipo desde el panel. Arranca con lo que informó el equipo
// (más lo pendiente de aplicar) y al guardar sube settings_rev: el equipo lo
// toma en su próximo checkin (cerca de un minuto si está prendido).

type Section = 'general' | 'camera' | 'print';

const merge = (reported?: RemoteSettings | null, desired?: RemoteSettings | null): RemoteSettings => ({
  general: { ...(reported?.general ?? {}), ...(desired?.general ?? {}) },
  camera: { ...(reported?.camera ?? {}), ...(desired?.camera ?? {}) },
  print: { ...(reported?.print ?? {}), ...(desired?.print ?? {}) },
  frame: desired?.frame !== undefined ? desired.frame : reported?.frame ?? null,
});

const num = (v: unknown, d: number) => (v === undefined || v === null || v === '' ? d : Number(v));

export default function DeviceConfig({ device, onClose, onSaved }: {
  device: KioskDeviceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RemoteSettings>(() => merge(device.reported, device.settings));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const get = (section: Section, key: string) => form[section]?.[key];
  const set = (section: Section, key: string, value: unknown) =>
    setForm(f => ({ ...f, [section]: { ...(f[section] ?? {}), [key]: value } }));
  // Valores por defecto iguales a los del equipo
  const bool = (section: Section, key: string, def: boolean) => {
    const v = get(section, key);
    return v === undefined ? def : !!v;
  };
  const g = (key: string) => get('general', key);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('kiosk_devices')
      .update({ settings: form, settings_rev: (device.settings_rev || 0) + 1 })
      .eq('id', device.id);
    setSaving(false);
    if (error) {
      toast.error(`No se pudo guardar: ${error.message}`);
      return;
    }
    toast.success('Guardado. El equipo lo aplica en el próximo minuto (si está prendido y con internet).');
    onSaved();
  };

  const uploadFrame = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    const path = `frames/${Date.now()}-${file.name.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await supabase.storage.from('kiosk-assets').upload(path, file, { contentType: file.type || 'image/png' });
    setUploading(false);
    if (error) {
      toast.error(`No se pudo subir el marco: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from('kiosk-assets').getPublicUrl(path);
    setForm(f => ({ ...f, frame: data.publicUrl }));
  };

  const frame = form.frame ?? null;
  const frameOptions = [
    { value: '', label: 'Sin marco' },
    ...GLASS_STYLES.map(s => ({ value: `${GLASS_PREFIX}${s.value}`, label: `${s.label} (con el nombre del evento)` })),
    ...BUILT_IN_FRAMES.map(f => ({ value: f.url, label: f.label })),
    ...(frame === 'custom' ? [{ value: 'custom', label: 'PNG cargado en el equipo (sin cambios)' }] : []),
    ...(frame && /^https?:/.test(frame) ? [{ value: frame, label: 'PNG subido desde el panel' }] : []),
  ];
  const framePreview = frame && frame !== 'custom' && !frame.startsWith(GLASS_PREFIX) ? frame : null;

  const splashOptions = [
    ...SPLASH_STYLES.map(s => ({ value: s.value as string, label: s.label })),
    ...SPLASH_VIDEOS.map(v => ({ value: v.value, label: v.label })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className={btnGhost}><ArrowLeft className="h-4 w-4" /> Volver</button>
          <div>
            <h2 className="text-xl font-bold text-white">{device.name || device.device_code}</h2>
            <p className="text-sm text-slate-400">
              {device.reported_at
                ? `Ajustes informados por el equipo el ${new Date(device.reported_at).toLocaleString('es-AR')}`
                : 'El equipo todavía no informó sus ajustes (necesita la app nueva): se muestran valores por defecto.'}
            </p>
          </div>
        </div>
        <button onClick={save} disabled={saving} className={btnPrimary}><Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar y enviar'}</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Evento y bienvenida">
          <Field label="Nombre del evento" hint="Se ve en la bienvenida y en los marcos. También es la carpeta de las fotos en Drive.">
            <input className={input} value={String(g('eventTitle') ?? '')} onChange={e => set('general', 'eventTitle', e.target.value)} placeholder="15 de Pía" />
          </Field>
          <Field label="Subtítulo de la bienvenida">
            <input className={input} value={String(g('welcomeSubtitle') ?? '')} onChange={e => set('general', 'welcomeSubtitle', e.target.value)} />
          </Field>
          <Field label="Texto chico del marco de vidrio">
            <input className={input} value={String(g('frameSubtitle') ?? '')} onChange={e => set('general', 'frameSubtitle', e.target.value)} placeholder="03.10.2026" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Animación">
              <Select value={String(g('splashVideo') ?? 'polaroids')} options={splashOptions} onChange={v => set('general', 'splashVideo', v)} />
            </Field>
            <Field label="Color del nombre">
              <Select value={String(g('nameStyle') ?? 'white')} options={NAME_STYLES.map(n => ({ value: n.value as string, label: n.label }))} onChange={v => set('general', 'nameStyle', v)} />
            </Field>
          </div>
        </Section>

        <Section title="Marco">
          <Field label="Marco de la foto">
            <Select value={frame ?? ''} options={frameOptions} onChange={v => setForm(f => ({ ...f, frame: v || null }))} />
          </Field>
          <input ref={fileRef} type="file" accept="image/png" className="hidden" onChange={e => { void uploadFrame(e.target.files?.[0]); e.target.value = ''; }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className={btnGhost}>
            <ImagePlus className="h-4 w-4" /> {uploading ? 'Subiendo…' : 'Subir marco PNG'}
          </button>
          <p className="text-xs text-slate-500">PNG con la ventana transparente, vertical 1200×1800 u horizontal 1800×1200. El equipo lo baja y lo guarda (después anda sin internet).</p>
          {framePreview && <img src={framePreview} alt="" className="max-h-56 rounded-xl border border-slate-700 bg-[repeating-conic-gradient(#334155_0_25%,#1e293b_0_50%)] bg-[length:16px_16px]" />}
          <Check label="El invitado elige el marco" checked={bool('general', 'guestFrameChoice', false)} onChange={v => set('general', 'guestFrameChoice', v)} />
        </Section>

        <Section title="Experiencias">
          <div className="grid grid-cols-2 gap-2">
            <Check label="Fotos" checked={bool('general', 'enableSelfie', true)} onChange={v => set('general', 'enableSelfie', v)} />
            <Check label="Portada Fashion" checked={bool('general', 'enablePortada', false)} onChange={v => set('general', 'enablePortada', v)} />
            <Check label="Portada Fashion IA" checked={bool('general', 'enablePortadaAI', true)} onChange={v => set('general', 'enablePortadaAI', v)} />
            <Check label="Retrato IA" checked={bool('general', 'enableAI', true)} onChange={v => set('general', 'enableAI', v)} />
            <Check label="Caricatura con Messi" checked={bool('general', 'enableCaricatura', true)} onChange={v => set('general', 'enableCaricatura', v)} />
            <Check label="Mundial (carta)" checked={bool('general', 'enableMundial', false)} onChange={v => set('general', 'enableMundial', v)} />
            <Check label="Figuritas" checked={bool('general', 'enableFiguritas', true)} onChange={v => set('general', 'enableFiguritas', v)} />
            <Check label="Filtros de color" checked={bool('general', 'enableFilters', false)} onChange={v => set('general', 'enableFilters', v)} />
          </div>
          <Check label="Sin conexión (solo foto, marco e impresión)" checked={bool('general', 'offline', false)} onChange={v => set('general', 'offline', v)} />
        </Section>

        <Section title="Fotos">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fotos por toma">
              <Select value={num(g('photoShots'), 1)} options={[1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))} onChange={v => set('general', 'photoShots', v)} />
            </Field>
            <Field label="Pausa entre fotos">
              <Select value={num(g('shotPause'), 10)} options={[5, 10, 15].map(n => ({ value: n, label: `${n} s` }))} onChange={v => set('general', 'shotPause', v)} />
            </Field>
            <Field label="Hoja">
              <Select value={String(g('photoOrientation') ?? 'auto')}
                options={[{ value: 'auto', label: 'Automática' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]}
                onChange={v => set('general', 'photoOrientation', v)} />
            </Field>
            <Field label="Cuenta regresiva">
              <Select value={num(get('camera', 'timer'), 5)} options={[3, 5, 10].map(n => ({ value: n, label: `${n} s` }))} onChange={v => set('camera', 'timer', v)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Check label="Tira doble" checked={bool('general', 'photoStrips', false)} onChange={v => set('general', 'photoStrips', v)} />
            <Check label="Pedir nombre del invitado" checked={bool('general', 'askGuestName', false)} onChange={v => set('general', 'askGuestName', v)} />
            <Check label="Repetir foto" checked={bool('general', 'allowRetake', true)} onChange={v => set('general', 'allowRetake', v)} />
            <Check label="Galería en el inicio" checked={bool('general', 'enableGallery', false)} onChange={v => set('general', 'enableGallery', v)} />
          </div>
        </Section>

        <Section title="Resultado e impresión">
          <div className="grid grid-cols-2 gap-2">
            <Check label="Mostrar QR" checked={bool('general', 'showQr', true)} onChange={v => set('general', 'showQr', v)} />
            <Check label="Botón Imprimir" checked={bool('general', 'showPrintButton', true)} onChange={v => set('general', 'showPrintButton', v)} />
            <Check label="Imprimir solo" checked={bool('print', 'autoPrint', false)} onChange={v => set('print', 'autoPrint', v)} />
            <Check label="Sin bordes" checked={bool('print', 'borderless', false)} onChange={v => set('print', 'borderless', v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Copias por foto">
              <Select value={num(get('print', 'copies'), 1)} options={[1, 2, 3, 4].map(n => ({ value: n, label: String(n) }))} onChange={v => set('print', 'copies', v)} />
            </Field>
            <Field label="Volver al inicio después de">
              <Select value={num(g('resultTimeout'), 30)} options={[15, 30, 60, 0].map(n => ({ value: n, label: n ? `${n} s` : 'Nunca' }))} onChange={v => set('general', 'resultTimeout', v)} />
            </Field>
          </div>
        </Section>

        <Section title="Pantalla y cámara">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pantalla">
              <Select value={num(g('screenRotation'), 0)}
                options={[{ value: 0, label: 'Horizontal' }, { value: 90, label: 'Vertical ↻' }, { value: 270, label: 'Vertical ↺' }, { value: 180, label: 'Dada vuelta' }]}
                onChange={v => set('general', 'screenRotation', v)} />
            </Field>
            <Field label="Rotación de la cámara">
              <Select value={num(get('camera', 'rotation'), 0)} options={[0, 90, 180, 270].map(n => ({ value: n, label: `${n}°` }))} onChange={v => set('camera', 'rotation', v)} />
            </Field>
            <Field label="Calidad de la cámara">
              <Select value={String(get('camera', 'quality') ?? 'auto')}
                options={[{ value: 'auto', label: 'Automática' }, { value: '1080', label: 'Full HD' }, { value: '720', label: 'HD' }, { value: '480', label: 'Baja' }]}
                onChange={v => set('camera', 'quality', v)} />
            </Field>
          </div>
          <Check label="Modo espejo" checked={bool('camera', 'mirror', false)} onChange={v => set('camera', 'mirror', v)} />
        </Section>
      </div>
    </div>
  );
}
