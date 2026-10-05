import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { FileSpreadsheet, Film, Play, QrCode, Trash2, Upload } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getGeneralSettings, saveGeneralSettings } from '@/lib/kioskSettings';
import { getScreenMedia, removeScreenMedia, saveScreenMedia } from '@/lib/kioskMedia';
import {
  fullName, getVipGuests, parseGuestFile, saveVipGuests, searchGuests, tableLabel,
  VIP_TEMPLATE_URL, VIP_VIDEO_KEY, type VipGuest,
} from '@/lib/vipGuests';
import { buttonClass, Choice, Field, inputClass, Panel, primaryClass, Toggle } from './ui';

// Ajustes del Ingreso VIP: todo con la pantalla táctil. La lista de invitados se
// carga desde el Excel de la plantilla (por QR se baja al celular para completarla).

export default function VipSection() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(getGeneralSettings);
  const update = (patch: Parameters<typeof saveGeneralSettings>[0]) => setSettings(saveGeneralSettings(patch));
  const [guests, setGuests] = useState(getVipGuests);
  const [pending, setPending] = useState<{ guests: VipGuest[]; skipped: number; name: string } | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [check, setCheck] = useState('');
  const [video, setVideo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getScreenMedia(VIP_VIDEO_KEY).then(rec => setVideo(rec?.name ?? null)).catch(() => {});
  }, []);

  const tables = useMemo(() => new Set(guests.map(g => g.table).filter(Boolean)).size, [guests]);
  const found = useMemo(() => searchGuests(guests, check).slice(0, 6), [guests, check]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = await parseGuestFile(file);
      setPending({ ...parsed, name: file.name });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo leer el archivo');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const confirmImport = () => {
    if (!pending) return;
    saveVipGuests(pending.guests);
    setGuests(pending.guests);
    toast.success(`Listo: ${pending.guests.length} invitados cargados`);
    setPending(null);
  };

  const clearList = () => {
    if (!window.confirm('¿Borrar la lista de invitados de este equipo?')) return;
    saveVipGuests([]);
    setGuests([]);
  };

  const onVideo = async (file: File | undefined) => {
    if (!file) return;
    try {
      await saveScreenMedia(VIP_VIDEO_KEY, file);
      setVideo(file.name);
      toast.success('Video de bienvenida guardado en el equipo');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar el video');
    }
    if (videoRef.current) videoRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <Panel title="Ingreso VIP" description="El invitado escribe al menos 3 letras de su nombre o apellido y ve su mesa. Funciona sin internet.">
        <Toggle label="Mostrar Ingreso VIP en el inicio" hint="Ícono dorado al lado de Fotos y Fotos IA."
          checked={!!settings.enableVip} onChange={enableVip => update({ enableVip })} />
        <button onClick={() => navigate('/box/vip')} className={primaryClass}>
          <Play className="w-5 h-5" /> Abrir Ingreso VIP
        </button>
      </Panel>

      <Panel title="Invitados" description='Cargá el Excel con las columnas Mesa, Nombre y Apellido (opcionales: Trasnoche y Living con "Sí").'>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-black/20 border border-white/10 px-5 py-4">
            <p className="text-white/50 text-sm">Invitados cargados</p>
            <p className="text-4xl font-black">{guests.length}</p>
          </div>
          <div className="rounded-2xl bg-black/20 border border-white/10 px-5 py-4">
            <p className="text-white/50 text-sm">Mesas</p>
            <p className="text-4xl font-black">{tables}</p>
          </div>
        </div>

        <input ref={fileRef} type="file" className="hidden"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={e => onFile(e.target.files?.[0])} />
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => fileRef.current?.click()} className={primaryClass}>
            <Upload className="w-5 h-5" /> {guests.length ? 'Cargar otra lista' : 'Cargar Excel de invitados'}
          </button>
          <button onClick={() => setShowQr(v => !v)} className={buttonClass}>
            <QrCode className="w-5 h-5" /> {showQr ? 'Ocultar QR' : 'QR de la plantilla Excel'}
          </button>
        </div>

        {pending && (
          <div className="rounded-2xl bg-emerald-500/15 border border-emerald-400/30 p-5 space-y-3">
            <p className="text-lg"><FileSpreadsheet className="inline w-5 h-5 mr-2" /><b>{pending.name}</b>: {pending.guests.length} invitados
              {pending.skipped ? ` (${pending.skipped} filas sin nombre se saltearon)` : ''}.</p>
            <p className="text-white/70">Primeros: {pending.guests.slice(0, 4).map(g => `${fullName(g)}${g.table ? ` (${g.table})` : ''}`).join(', ')}…</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={confirmImport} className={primaryClass}>Usar esta lista{guests.length ? ' (reemplaza la actual)' : ''}</button>
              <button onClick={() => setPending(null)} className={buttonClass}>Cancelar</button>
            </div>
          </div>
        )}

        {(showQr || !guests.length) && (
          <div className="flex items-center gap-6 rounded-2xl bg-black/20 border border-white/10 p-5">
            <div className="bg-white p-3 rounded-2xl shrink-0"><QRCodeSVG value={VIP_TEMPLATE_URL} size={150} /></div>
            <div className="space-y-2">
              <p className="text-lg font-semibold">Escaneá con el celular para bajar la plantilla de Excel</p>
              <p className="text-white/60">La plantilla tiene las columnas en el orden correcto: <b className="text-white/80">Mesa, Nombre, Apellido, Trasnoche, Living</b> (una fila por persona). Completala y pasala al equipo con "Cargar Excel de invitados": desde un pendrive, por Bluetooth (queda en Descargas), Google Drive o la carpeta Descargas.</p>
            </div>
          </div>
        )}

        {guests.length > 0 && (
          <>
            <Field label="Probar la búsqueda">
              <input className={inputClass} placeholder="Escribí 3 letras de un nombre" value={check} onChange={e => setCheck(e.target.value)} />
            </Field>
            {found.length > 0 && (
              <div className="space-y-2">
                {found.map((g, i) => (
                  <p key={i} className="rounded-xl bg-white/5 px-4 py-2 flex justify-between">
                    <span>{fullName(g)}</span>
                    <span className="text-[#ffd23f]">{g.table ? `Mesa ${tableLabel(g.table)}` : g.living ? 'Living' : g.afterParty ? 'Trasnoche' : 'Sin mesa'}</span>
                  </p>
                ))}
              </div>
            )}
            <button onClick={clearList} className={buttonClass}><Trash2 className="w-5 h-5" /> Borrar la lista</button>
          </>
        )}
      </Panel>

      <Panel title="Al elegir el nombre" description="Qué ve el invitado después de encontrarse.">
        <Choice label="Mostrar" value={settings.vipVideo === false ? 'mesa' : 'video'}
          options={[{ value: 'video', label: 'Video de bienvenida y la mesa' }, { value: 'mesa', label: 'Solo el número de mesa' }]}
          onChange={v => update({ vipVideo: v === 'video' })} />
        {settings.vipVideo !== false && (
          <>
            <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={e => onVideo(e.target.files?.[0])} />
            <div className="flex items-center gap-3">
              <button onClick={() => videoRef.current?.click()} className={buttonClass}>
                <Film className="w-5 h-5" /> {video ? 'Cambiar video' : 'Cargar video de bienvenida'}
              </button>
              {video && (
                <button onClick={async () => { await removeScreenMedia(VIP_VIDEO_KEY); setVideo(null); }} className={buttonClass}>
                  <Trash2 className="w-5 h-5" /> Quitar
                </button>
              )}
            </div>
            <p className="text-white/50">{video ? `Video: ${video}` : 'Sin video: se muestra directamente la mesa.'} (hasta 300 MB; se puede cargar desde un pendrive y queda guardado en el equipo)</p>
          </>
        )}
        <Choice label="La mesa se muestra durante" value={Number(settings.vipResultSeconds) || 15}
          options={[10, 15, 20, 30].map(n => ({ value: n, label: `${n} s` }))}
          onChange={vipResultSeconds => update({ vipResultSeconds })} />
      </Panel>

      <Panel title="Textos" description='El fondo se elige en "Fondos animados" → Ingreso VIP (las mismas animaciones del kiosco).'>
        <Field label="Título (vacío = nombre del evento)">
          <input className={inputClass} placeholder={settings.eventTitle || 'Bienvenidos'} value={(settings.vipTitle as string) || ''}
            onChange={e => update({ vipTitle: e.target.value })} />
        </Field>
        <Field label="Subtítulo">
          <input className={inputClass} placeholder="¡Buscá tu mesa!" value={(settings.vipSubtitle as string) || ''}
            onChange={e => update({ vipSubtitle: e.target.value })} />
        </Field>
        <Field label="Hora de ingreso de la trasnoche (opcional)">
          <input className={inputClass} placeholder="02:00" value={(settings.vipAfterPartyTime as string) || ''}
            onChange={e => update({ vipAfterPartyTime: e.target.value })} />
        </Field>
      </Panel>
    </div>
  );
}
