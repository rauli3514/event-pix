import { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { btnGhost, btnPrimary, card, Field, input, Select } from './ui';
import { licenseOk, type VideoDeviceRow } from './types';

// Licencia de un equipo: DEMO (todo funciona, los videos salen con la marca
// "DEMO") o CLIENTE (sin marca y con WhatsApp). El equipo se entera en su
// próximo aviso (~1 minuto); la app también tiene "Ya pagué: revisar".

const PLANS = [
  { value: '', label: 'Sin plan' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'anual', label: 'Anual' },
  { value: 'evento', label: 'Por evento' },
  { value: 'permanente', label: 'Permanente' },
];
const PLAN_DAYS: Record<string, number> = { mensual: 31, trimestral: 92, anual: 366, evento: 4 };

/** Fecha local para <input type="date"> */
const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dateInput = (iso: string | null | undefined) => (iso ? localDay(new Date(iso)) : '');
const addDays = (days: number) => localDay(new Date(Date.now() + days * 86400000));
const fmt = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

export function LicenseBadge({ device }: { device: VideoDeviceRow }) {
  if (!device.license) return null; // falta la migración de licencias
  const ok = licenseOk(device);
  const expired = device.license === 'full' && !ok;
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ok ? 'bg-violet-500/15 text-violet-200' : expired ? 'bg-red-500/15 text-red-300' : 'bg-amber-500/15 text-amber-200'}`}
      title={device.license_until ? `Hasta el ${fmt(device.license_until)}` : undefined}>
      {ok ? `Cliente${device.license_until ? ` · hasta ${fmt(device.license_until)}` : ''}` : expired ? 'Licencia vencida' : 'Demo'}
    </span>
  );
}

export default function LicenseEditor({ device, onSaved, onClose }: {
  device: VideoDeviceRow;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [license, setLicense] = useState<'demo' | 'full'>(device.license ?? 'demo');
  const [until, setUntil] = useState(dateInput(device.license_until));
  const [plan, setPlan] = useState(device.license_plan ?? '');
  const [customer, setCustomer] = useState(device.customer_name ?? '');
  const [contact, setContact] = useState(device.customer_contact ?? '');
  const [notes, setNotes] = useState(device.license_notes ?? '');
  const [busy, setBusy] = useState(false);

  const pickPlan = (p: string) => {
    setPlan(p);
    if (p === 'permanente') setUntil('');
    else if (PLAN_DAYS[p]) setUntil(addDays(PLAN_DAYS[p]));
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('video_devices').update({
      license,
      // Fin del día elegido (hora local)
      license_until: until ? new Date(`${until}T23:59:59`).toISOString() : null,
      license_plan: plan || null,
      customer_name: customer.trim() || null,
      customer_contact: contact.trim() || null,
      license_notes: notes.trim() || null,
    }).eq('id', device.id);
    setBusy(false);
    if (error) {
      toast.error(/license/i.test(error.message) ? 'Falta correr la migración de licencias (20261026000000_video_licenses.sql)' : error.message);
      return;
    }
    toast.success(license === 'full' ? 'Licencia activada: el equipo se entera en un minuto' : 'El equipo queda en demo');
    onSaved();
  };

  const phone = contact.replace(/\D/g, '');
  const thanks = `¡Hola${customer.trim() ? ` ${customer.trim().split(' ')[0]}` : ''}! Ya está activa la licencia de EventPix Video en tu equipo ${device.device_code}${until ? ` (hasta el ${new Date(`${until}T12:00:00`).toLocaleDateString('es-AR')})` : ''}. En la app: Ajustes → Equipo → "Ya pagué: revisar". ¡Gracias!`;

  return (
    <div className={`${card} space-y-4 border-violet-500/40`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-bold text-white"><KeyRound className="h-4 w-4 text-violet-300" /> Licencia de <span className="font-mono">{device.device_code}</span></h3>
        <button onClick={onClose} className={btnGhost}>Cerrar</button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Licencia">
          <Select value={license} onChange={setLicense}
            options={[{ value: 'demo', label: 'Demo (marca de agua)' }, { value: 'full', label: 'Cliente (completa)' }]} />
        </Field>
        <Field label="Plan">
          <Select value={plan} onChange={pickPlan} options={PLANS} />
        </Field>
        <Field label="Vence" hint="Vacío = no vence. Al elegir un plan se completa sola.">
          <input type="date" className={input} value={until} onChange={e => setUntil(e.target.value)} />
        </Field>
        <Field label="Cliente">
          <input className={input} value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Nombre o empresa" />
        </Field>
        <Field label="Contacto (WhatsApp)">
          <input className={input} value={contact} onChange={e => setContact(e.target.value)} placeholder="+54 9 362 ..." />
        </Field>
        <Field label="Notas">
          <input className={input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Pagó por transferencia el 20/10" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void save()} disabled={busy} className={btnPrimary}>Guardar licencia</button>
        {license === 'full' && phone.length >= 8 && (
          <a href={`https://wa.me/${phone}?text=${encodeURIComponent(thanks)}`} target="_blank" rel="noreferrer" className={btnGhost}>
            <MessageCircle className="h-4 w-4" /> Avisarle por WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
