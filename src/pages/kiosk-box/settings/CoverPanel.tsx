import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { COVER_COLORS, coverOptionsFrom, DEFAULT_HEADLINES, renderMagazineCover } from '@/lib/magazineCover';
import { Choice, Field, inputClass, Panel, Toggle } from './ui';

// Portada Fashion: todo editable menos el fondo (que es la foto del invitado).
const SAMPLE = '/ai-themes/gala-alfombra-roja.jpg';

export default function CoverPanel() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const [preview, setPreview] = useState<string | null>(null);
  const opts = coverOptionsFrom(settings, 'Sofi');

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(() => {
      renderMagazineCover(SAMPLE, { ...coverOptionsFrom(settings, 'Sofi'), width: 600 })
        .then(src => alive && setPreview(src))
        .catch(() => alive && setPreview(null));
    }, 300);
    return () => { alive = false; window.clearTimeout(t); };
  }, [settings]);

  return (
    <Panel title="Portada Fashion" description="El invitado es la tapa de una revista: su foto de fondo, su nombre y los titulares de la fiesta. Aparece dentro de Fotos. Sin IA por ahora.">
      <Toggle label="Mostrar Portada Fashion" hint='En "Fotos" el invitado elige entre Selfie y Portada Fashion.'
        checked={settings.enablePortada === true} onChange={enablePortada => update({ enablePortada })} />
      {settings.enablePortada === true && (
        <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
          <div className="space-y-4">
            <Field label="Nombre de la revista (vacío = nombre del evento)">
              <input className={inputClass} placeholder={settings.eventTitle || 'GLAM'} value={settings.portadaTitle || ''}
                onChange={e => update({ portadaTitle: e.target.value })} />
            </Field>
            <Field label="Línea de edición">
              <input className={inputClass} value={opts.issue || ''} onChange={e => update({ portadaIssue: e.target.value })} />
            </Field>
            <Field label="Titulares (uno por línea; la primera palabra va destacada)">
              <textarea className={`${inputClass} min-h-[9rem]`} value={settings.portadaHeadlines ?? DEFAULT_HEADLINES.join('\n')}
                onChange={e => update({ portadaHeadlines: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Texto sobre el nombre">
                <input className={inputClass} value={opts.starLabel || ''} onChange={e => update({ portadaStarLabel: e.target.value })} />
              </Field>
              <Field label="Sello redondo (vacío = sin sello)">
                <input className={inputClass} value={opts.badge || ''} onChange={e => update({ portadaBadge: e.target.value })} />
              </Field>
            </div>
            <Choice label="Color de la tapa" value={settings.portadaColor || 'white'}
              options={COVER_COLORS.map(c => ({ value: c.value, label: c.label }))}
              onChange={portadaColor => update({ portadaColor })} />
            <p className="text-white/50 text-sm">El nombre de la estrella lo escribe el invitado después de sacarse la foto.</p>
          </div>
          <div className="w-64 aspect-[2/3] rounded-xl overflow-hidden bg-black/30 border border-white/10 flex items-center justify-center">
            {preview ? <img src={preview} alt="Vista previa de la portada" className="w-full h-full object-cover" />
              : <Loader2 className="w-8 h-8 animate-spin text-white/50" />}
          </div>
        </div>
      )}
    </Panel>
  );
}
