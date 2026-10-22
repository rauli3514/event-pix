import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { RemoteVideoSettings } from '@/lib/videoBooth/remote';
import SettingsForm from './SettingsForm';
import { btnGhost, btnPrimary } from './ui';
import type { VideoDeviceRow } from './types';

// Ajustes de un equipo de la cabina desde el panel. Arranca con lo que informó el
// equipo (más lo pendiente) y al guardar sube settings_rev: el equipo lo aplica
// en su próximo checkin (cerca de un minuto si está prendido).

const merge = (reported?: RemoteVideoSettings | null, desired?: RemoteVideoSettings | null): RemoteVideoSettings => ({
  video: { ...(reported?.video ?? {}), ...(desired?.video ?? {}) },
  camera: { ...(reported?.camera ?? {}), ...(desired?.camera ?? {}) },
  // Los archivos solo los conoce el panel (el equipo informa nombres)
  ...(desired?.assets ? { assets: desired.assets } : {}),
});

export default function DeviceConfig({ device, onClose, onSaved }: { device: VideoDeviceRow; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<RemoteVideoSettings>(() => merge(device.reported, device.settings));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from('video_devices')
      .update({ settings: form, settings_rev: (device.settings_rev || 0) + 1 })
      .eq('id', device.id);
    setSaving(false);
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); return; }
    toast.success('Guardado. El equipo lo aplica en el próximo minuto (si está prendido y con internet).');
    onSaved();
  };

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
                : 'El equipo todavía no informó sus ajustes: se muestran valores por defecto.'}
            </p>
          </div>
        </div>
        <button onClick={() => void save()} disabled={saving} className={btnPrimary}><Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar y enviar'}</button>
      </div>
      <SettingsForm form={form} setForm={setForm} />
    </div>
  );
}
