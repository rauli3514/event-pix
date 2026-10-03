import { useState } from 'react';
import { getGeneralSettings, saveGeneralSettings, splashVideoSrc, SPLASH_VIDEOS } from '@/lib/kioskSettings';
import { Field, inputClass, Panel } from './ui';

export const DEFAULT_WELCOME_TITLE = 'Toca para empezar';

export default function SplashSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const video = splashVideoSrc(settings.splashVideo);

  return (
    <div className="space-y-6">
      <Panel title="Vista previa" description="Así se ve la pantalla de bienvenida del kiosco.">
        <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0a0a1a] border border-white/10">
          {video && <video key={video} src={video} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover opacity-80" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />
          <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
            <p className="carlmarx-bold text-white text-5xl drop-shadow-2xl">{settings.welcomeTitle || DEFAULT_WELCOME_TITLE}</p>
            {settings.welcomeSubtitle && <p className="text-white/85 text-2xl mt-3">{settings.welcomeSubtitle}</p>}
          </div>
        </div>
      </Panel>

      <Panel title="Textos">
        <Field label="Título">
          <input className={inputClass} placeholder={DEFAULT_WELCOME_TITLE} value={settings.welcomeTitle || ''}
            onChange={e => update({ welcomeTitle: e.target.value })} />
        </Field>
        <Field label="Subtítulo (opcional)">
          <input className={inputClass} placeholder="Ej: ¡Bienvenidos a los XV de Camila!" value={settings.welcomeSubtitle || ''}
            onChange={e => update({ welcomeSubtitle: e.target.value })} />
        </Field>
      </Panel>

      <Panel title="Fondo animado">
        <div className="grid grid-cols-4 gap-4">
          {SPLASH_VIDEOS.map(v => {
            const selected = (settings.splashVideo || '1') === v.value;
            return (
              <button key={v.value} onClick={() => update({ splashVideo: v.value })}
                className={`rounded-2xl overflow-hidden border-4 text-left focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${selected ? 'border-[#ff2e93]' : 'border-transparent'}`}>
                <div className="aspect-video bg-[#0a0a1a]">
                  {/* Cuadro fijo (#t=1): cuatro videos a la vez son mucho para la TV box */}
                  {v.src && <video src={`${v.src}#t=1`} preload="metadata" muted playsInline className="w-full h-full object-cover" />}
                </div>
                <p className="px-3 py-2 bg-black/30 font-semibold">{v.label}</p>
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
