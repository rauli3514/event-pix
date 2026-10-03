import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { composePhotos, type PageOrientation } from '@/lib/photoLayout';
import { getCameraSettings, getFrameUrl, getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { Choice, Panel, Toggle } from './ui';

// Diseño de la hoja: orientación y cantidad de fotos por toma (solo "Fotos").
// La vista previa usa fotos de muestra recortadas como las daría la cámara.

const SAMPLES = ['/ai-themes/polaroid-party.jpg', '/ai-themes/fiesta-disco-70s.jpg', '/ai-themes/selfie-con-tiburon.jpg', '/ai-themes/paparazzi-nocturno.jpg'];

/** Recorta una muestra a 16:9 (cámara normal) o 9:16 (cámara girada). */
const cameraLike = (src: string, landscape: boolean) => new Promise<string>((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = landscape ? 640 : 360;
    c.height = landscape ? 360 : 640;
    const scale = Math.max(c.width / img.width, c.height / img.height);
    const sw = c.width / scale;
    const sh = c.height / scale;
    c.getContext('2d')!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    resolve(c.toDataURL('image/jpeg', 0.85));
  };
  img.onerror = reject;
  img.src = src;
});

export default function PhotoLayoutPanel() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const shots = Math.min(4, Math.max(1, Number(settings.photoShots) || 1));
  const orientation = (settings.photoOrientation as PageOrientation) || 'auto';
  const strips = !!settings.photoStrips && shots > 1;
  const [preview, setPreview] = useState<string | null>(null);
  // Se rehace al cambiar el marco en esta misma sección
  const [frameVersion, setFrameVersion] = useState(0);
  useEffect(() => {
    const bump = () => setFrameVersion(v => v + 1);
    window.addEventListener('kiosk-frame-changed', bump);
    return () => window.removeEventListener('kiosk-frame-changed', bump);
  }, []);

  useEffect(() => {
    let alive = true;
    const t = window.setTimeout(async () => {
      try {
        const rot = Number(getCameraSettings().rotation) || 0;
        const landscape = rot !== 90 && rot !== 270;
        const photos = await Promise.all(SAMPLES.slice(0, shots).map(s => cameraLike(s, landscape)));
        const out = await composePhotos(photos, {
          frame: getFrameUrl(), orientation, strips,
          title: settings.eventTitle || undefined, subtitle: settings.frameSubtitle || undefined,
        });
        if (alive) setPreview(out);
      } catch {
        if (alive) setPreview(null);
      }
    }, 250);
    return () => { alive = false; window.clearTimeout(t); };
  }, [shots, orientation, strips, settings.eventTitle, settings.frameSubtitle, frameVersion]);

  return (
    <Panel title="Diseño de la foto" description="Cómo se arma la hoja de 10×15 en la experiencia Fotos. En automático, una foto apaisada usa la hoja horizontal y se ve entera; con la cámara girada (Ajustes → Cámara) la hoja queda vertical.">
      <div className="grid grid-cols-[1fr_auto] gap-6 items-start">
        <div className="space-y-5">
          <Choice label="Fotos por toma" value={shots}
            options={[1, 2, 3, 4].map(n => ({ value: n, label: n === 1 ? '1 foto' : `${n} fotos` }))}
            onChange={photoShots => update({ photoShots })} />
          <Choice label="Orientación de la hoja" value={strips ? 'portrait' : orientation}
            options={[
              { value: 'auto', label: 'Automática' },
              { value: 'portrait', label: 'Vertical' },
              { value: 'landscape', label: 'Horizontal' },
            ]}
            onChange={photoOrientation => update({ photoOrientation, photoStrips: false })} />
          {shots > 1 && (
            <Toggle label="Tira doble" hint="Dos tiras iguales con las fotos una debajo de otra: se corta al medio y se lleva una cada uno."
              checked={strips} onChange={photoStrips => update({ photoStrips })} />
          )}
          <p className="text-white/50 text-sm">
            Los marcos de vidrio se adaptan a cualquier diseño. Un marco PNG define su propia orientación (vertical u horizontal)
            y tiene que estar pensado para la cantidad de fotos.
          </p>
        </div>
        <div className="w-72 h-72 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center p-3">
          {preview ? <img src={preview} alt="Vista previa de la hoja" className="max-w-full max-h-full rounded-lg shadow-xl" />
            : <Loader2 className="w-8 h-8 animate-spin text-white/50" />}
        </div>
      </div>
    </Panel>
  );
}
