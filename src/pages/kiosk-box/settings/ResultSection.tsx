import { useState } from 'react';
import { getGeneralSettings, getPrintSettings, saveGeneralSettings, savePrintSettings } from '@/lib/kioskSettings';
import { Choice, Panel, Toggle } from './ui';

export default function ResultSection() {
  const [general, setGeneral] = useState(getGeneralSettings);
  const [print, setPrint] = useState(getPrintSettings);
  const updateGeneral = (patch: Parameters<typeof saveGeneralSettings>[0]) => setGeneral(saveGeneralSettings(patch));

  return (
    <div className="space-y-6">
      <Panel title="Pantalla del resultado" description="Lo que puede hacer el invitado con su foto.">
        <Toggle label="QR para descargar la foto" hint="El invitado la escanea con el celular."
          checked={general.showQr !== false} onChange={showQr => updateGeneral({ showQr })} />
        <Toggle label="Botón Imprimir" hint="El invitado decide si la imprime."
          checked={general.showPrintButton !== false} onChange={showPrintButton => updateGeneral({ showPrintButton })} />
        <Toggle label="Imprimir automáticamente" hint="Cada foto se imprime sola apenas está lista."
          checked={!!print.autoPrint} onChange={autoPrint => setPrint(savePrintSettings({ autoPrint }))} />
      </Panel>

      <Panel title="Tiempos">
        <Choice label="Volver solo al inicio después del resultado" value={general.resultTimeout ?? 0}
          options={[{ value: 0, label: 'No' }, { value: 15, label: '15 s' }, { value: 30, label: '30 s' }, { value: 60, label: '1 min' }]}
          onChange={resultTimeout => updateGeneral({ resultTimeout })} />
        <Choice label="Volver al inicio si nadie toca nada (pantallas de elección)" value={general.idleTimeout ?? 0}
          options={[{ value: 0, label: 'Nunca' }, { value: 30, label: '30 s' }, { value: 60, label: '1 min' }, { value: 120, label: '2 min' }]}
          onChange={idleTimeout => updateGeneral({ idleTimeout })} />
      </Panel>
    </div>
  );
}
