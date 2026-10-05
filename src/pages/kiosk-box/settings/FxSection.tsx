import { useState } from 'react';
import { Check } from 'lucide-react';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { COLOR_FILTERS } from '@/lib/faceFx';
import { Panel, Toggle } from './ui';

// Filtros de color en vivo (sin internet). Los accesorios que siguen la cara ya no se
// ofrecen: en la TV box no daba la potencia para mostrarlos en vivo.
export default function FxSection() {
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const filters = settings.filters ?? COLOR_FILTERS.map(f => f.value);

  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  const chip = (on: boolean) => `flex items-center gap-2 rounded-2xl px-4 py-3 text-lg font-semibold focus:outline-none focus:ring-4 focus:ring-[#00d4ff] ${on ? 'bg-gradient-to-r from-[#ff2e93]/80 to-[#7b2ff7]/80' : 'bg-black/20 border border-white/10 hover:bg-white/10'}`;

  return (
    <div className="space-y-6">
      <Panel title="Filtros de color" description="Antes de sacarse la foto, el invitado cambia de filtro con las flechas de los costados (o las del control) y lo ve en vivo. Fotos y Portada Fashion. No necesitan internet.">
        <Toggle label="Ofrecer filtros de color" checked={!!settings.enableFilters} onChange={enableFilters => update({ enableFilters })} />
        {settings.enableFilters && (
          <div className="flex flex-wrap gap-3">
            {COLOR_FILTERS.filter(f => f.value !== 'none').map(f => (
              <button key={f.value} onClick={() => update({ filters: toggleIn(filters, f.value) })} className={chip(filters.includes(f.value))}>
                {filters.includes(f.value) && <Check className="w-5 h-5" />}
                <span className="w-8 h-8 rounded-lg bg-[url('/ai-themes/polaroid-party.jpg')] bg-cover" style={{ filter: f.css }} />
                {f.label}
              </button>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
