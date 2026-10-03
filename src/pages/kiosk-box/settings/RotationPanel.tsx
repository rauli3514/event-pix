import { useState } from 'react';
import { Tv } from 'lucide-react';
import { getScreenRotation, SCREEN_ROTATIONS, setScreenRotation } from '@/lib/screenRotation';
import { Panel } from './ui';

// Orientación de la tele: se elige mirando la pantalla, la que quede derecha.
export default function RotationPanel() {
  const [rotation, setRotation] = useState(getScreenRotation);

  return (
    <Panel title="Orientación de la pantalla" description="Si la tele está colgada en vertical o dada vuelta, elegí la opción con la que el texto quede derecho.">
      <div className="grid grid-cols-4 gap-4">
        {SCREEN_ROTATIONS.map(o => (
          <button key={o.value}
            onClick={() => { setRotation(o.value); setScreenRotation(o.value); }}
            className={`flex flex-col items-center gap-3 rounded-2xl px-4 py-5 border-4 focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${rotation === o.value ? 'border-[#ff2e93] bg-white/10' : 'border-transparent bg-black/20 hover:bg-white/10'}`}>
            <Tv className="w-12 h-12 text-[#00d4ff] transition-transform" style={{ transform: `rotate(${o.value}deg)` }} />
            <span className="text-lg font-semibold">{o.label}</span>
            <span className="text-white/50 text-sm">{o.hint}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
