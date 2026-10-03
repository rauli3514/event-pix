import { useEffect, useRef, useState } from 'react';
import { Aperture, Clapperboard, Images, PartyPopper, Ban, Zap } from 'lucide-react';
import AttractScreen from '@/components/kiosk/AttractScreen';
import { NAME_STYLES } from '@/components/kiosk/attractStyles';
import { getGeneralSettings, saveGeneralSettings, SPLASH_STYLES, SPLASH_VIDEOS } from '@/lib/kioskSettings';
import { getScreenBackground, setScreenBackground } from '@/lib/kioskMedia';
import { Choice, Field, inputClass, Panel } from './ui';
import RotationPanel from './RotationPanel';

export const DEFAULT_WELCOME_TITLE = 'Tocá para empezar';

const STYLE_ICONS = { polaroids: Images, flash: Aperture, neon: Zap, fiesta: PartyPopper } as const;
const STYLE_GRADIENTS = {
  polaroids: 'from-[#00d4ff] to-[#5b3bff]',
  flash: 'from-[#7b2ff7] to-[#ff2e93]',
  neon: 'from-[#ff2e93] to-[#ff7ac0]',
  fiesta: 'from-[#ffd23f] to-[#ff4d6d]',
};

/** La bienvenida real, achicada: se dibuja al tamaño de la pantalla y se escala. */
function LivePreview({ settings }: { settings: ReturnType<typeof getGeneralSettings> }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const update = () => setScale(box.clientWidth / window.innerWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={boxRef} className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black"
      style={{ aspectRatio: `${window.innerWidth} / ${window.innerHeight}` }}>
      <div className="absolute top-0 left-0 origin-top-left pointer-events-none"
        style={{ width: window.innerWidth, height: window.innerHeight, transform: `scale(${scale})` }}>
        <AttractScreen splash={getScreenBackground('splash')} eventTitle={settings.eventTitle} welcomeTitle={settings.welcomeTitle}
          subtitle={settings.welcomeSubtitle} nameStyle={settings.nameStyle} />
      </div>
    </div>
  );
}

export default function SplashSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const current = getScreenBackground('splash');
  const chooseSplash = (value: string) => setSettings(setScreenBackground('splash', value));

  return (
    <div className="space-y-6">
      <Panel title="Vista previa" description="Así se ve la pantalla de bienvenida del kiosco.">
        <LivePreview settings={settings} />
      </Panel>

      <Panel title="Textos">
        <Field label="Nombre del evento (va en la bienvenida y en los marcos de las fotos)">
          <input className={inputClass} placeholder="Ej: 15 de Pía" value={settings.eventTitle || ''}
            onChange={e => update({ eventTitle: e.target.value })} />
        </Field>
        <Choice label="Color del nombre" options={NAME_STYLES} value={settings.nameStyle || 'white'}
          onChange={nameStyle => update({ nameStyle })} />
        <Field label="Texto para invitar a tocar">
          <input className={inputClass} placeholder={DEFAULT_WELCOME_TITLE} value={settings.welcomeTitle || ''}
            onChange={e => update({ welcomeTitle: e.target.value })} />
        </Field>
        <Field label="Subtítulo (opcional)">
          <input className={inputClass} placeholder="Ej: ¡Bienvenidos a la fiesta!" value={settings.welcomeSubtitle || ''}
            onChange={e => update({ welcomeSubtitle: e.target.value })} />
        </Field>
      </Panel>

      <Panel title="Animación de fondo" description="Lluvia de fotos usa las fotos que se van sacando en el evento. Para subir un video propio o cambiar el fondo de las otras pantallas: Fondos animados.">
        <div className="grid grid-cols-4 gap-4">
          {SPLASH_STYLES.map(s => {
            const Icon = STYLE_ICONS[s.value];
            return (
              <StyleOption key={s.value} label={s.label} selected={current === s.value} onClick={() => chooseSplash(s.value)}>
                <div className={`w-full h-full bg-gradient-to-br ${STYLE_GRADIENTS[s.value]} flex items-center justify-center`}>
                  <Icon className="w-14 h-14 text-white drop-shadow" />
                </div>
              </StyleOption>
            );
          })}
          {SPLASH_VIDEOS.map(v => (
            <StyleOption key={v.value} label={v.label} selected={current === v.value} onClick={() => chooseSplash(v.value)}>
              {/* Cuadro fijo (#t=1): varios videos a la vez son mucho para la TV box */}
              {v.src ? <video src={`${v.src}#t=1`} preload="metadata" muted playsInline className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Ban className="w-12 h-12 text-white/40" /></div>}
              {v.src && <Clapperboard className="absolute top-2 right-2 w-6 h-6 text-white/80" />}
            </StyleOption>
          ))}
        </div>
      </Panel>

      <RotationPanel />
    </div>
  );
}

function StyleOption({ label, selected, onClick, children }: { label: string; selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-2xl overflow-hidden border-4 text-left focus:outline-none focus:ring-4 focus:ring-[#00d4ff] focus:scale-[1.03] transition-transform ${selected ? 'border-[#ff2e93]' : 'border-transparent'}`}>
      <div className="relative aspect-video bg-[#0a0a1a]">{children}</div>
      <p className="px-3 py-2 bg-black/30 font-semibold">{label}{selected ? '  ✓' : ''}</p>
    </button>
  );
}
