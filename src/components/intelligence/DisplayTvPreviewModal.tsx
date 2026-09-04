import React, { useState } from 'react';
import { X, Tv, Image as ImageIcon, QrCode, CheckCircle2, Play, RefreshCw, Send } from 'lucide-react';
import { toast } from 'sonner';

interface DisplayTvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptHook: string;
  scriptCta: string;
}

export const DisplayTvPreviewModal: React.FC<DisplayTvPreviewModalProps> = ({
  isOpen,
  onClose,
  scriptHook,
  scriptCta
}) => {
  // Fotos de catálogo del comercio
  const [catalogPhotos] = useState([
    { id: 'p1', name: 'Plato / Producto Estrella #1', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600&auto=format&fit=crop' },
    { id: 'p2', name: 'Combo Especial Fin de Semana', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop' },
    { id: 'p3', name: 'Servicio / Experiencia VIP', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop' }
  ]);

  const [selectedPhoto, setSelectedPhoto] = useState(catalogPhotos[0].url);
  const [selectedScreen, setSelectedScreen] = useState<'all' | 'screen1' | 'screen2'>('all');
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handlePublishToTV = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      onClose();
      toast.success('📺 ¡Campaña emitida en vivo en las Pantallas TV del comercio con foto real de tu catálogo!');
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Generador de Campañas para Pantallas TV (Display Hub)
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">16:9 / 60fps</span>
              </h3>
              <p className="text-xs text-slate-400">Adaptación automática del guion viral a tus pantallas físicas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Split 2 Columnas */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs custom-scrollbar">
          
          {/* Columna Izquierda: Vista Previa en Tiempo Real de la Pantalla TV */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Play className="w-4 h-4 text-amber-400" /> Previsualización en Vivo de la Pantalla TV
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Resolución: 1920x1080 Full HD</span>
            </div>

            {/* TV Screen Frame Mockup */}
            <div className="relative w-full aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-4 border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between p-6">
              {/* Background Glow */}
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* TV Layout Header */}
              <div className="flex items-center justify-between z-10">
                <div className="flex items-center gap-2">
                  <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider">
                    PROMO EXCLUSIVA EN LOCAL
                  </span>
                </div>
                <span className="text-slate-400 text-[10px] font-mono">EventPix Display TV</span>
              </div>

              {/* TV Main Content Grid */}
              <div className="grid grid-cols-12 gap-4 items-center z-10 my-auto">
                {/* Foto Real Seleccionada del Catálogo */}
                <div className="col-span-5 relative group">
                  <img
                    src={selectedPhoto}
                    alt="Producto Catálogo"
                    className="w-full h-36 object-cover rounded-2xl border-2 border-amber-500/40 shadow-xl group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md text-amber-300 text-[9px] px-2 py-0.5 rounded-md font-semibold border border-amber-500/30">
                    Foto Real de tu Comercio
                  </span>
                </div>

                {/* Texto del Guion Adaptado por IA */}
                <div className="col-span-7 space-y-2">
                  <h4 className="text-sm font-black text-slate-100 leading-tight">
                    {scriptHook}
                  </h4>
                  <p className="text-[11px] text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                    {scriptCta}
                  </p>
                </div>
              </div>

              {/* TV Footer con QR Interactivo de WhatsApp */}
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-white p-1 rounded-lg shrink-0">
                    {/* Simulated QR Code */}
                    <div className="w-full h-full bg-slate-950 rounded flex items-center justify-center text-white">
                      <QrCode className="w-6 h-6 text-amber-400" />
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-200 font-bold block text-[11px]">Escaneá el QR o envía "APP"</span>
                    <span className="text-slate-400 text-[9px]">Respuesta inmediata por WhatsApp</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Transmisión Segura 60fps
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Selección de Fotos Reales y Pantallas */}
          <div className="lg:col-span-5 space-y-5">
            {/* Selector de Fotos del Catálogo */}
            <div className="space-y-2.5">
              <label className="font-bold text-slate-200 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-violet-400" />
                  Fotos Reales de tu Catálogo
                </span>
                <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                  Librería EventPix
                </span>
              </label>
              <p className="text-slate-400 text-[11px]">
                La IA seleccionó esta foto del catálogo de tu local. Puedes cambiarla por cualquier producto real:
              </p>

              <div className="grid grid-cols-3 gap-2">
                {catalogPhotos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo.url)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${
                      selectedPhoto === photo.url ? 'border-amber-500 ring-2 ring-amber-500/40 scale-105' : 'border-slate-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
                    {selectedPhoto === photo.url && (
                      <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-amber-300 drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Pantallas TV del Comercio */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-amber-400" /> Seleccionar Pantallas TV de Emisión
              </label>
              <div className="space-y-1.5">
                <button
                  onClick={() => setSelectedScreen('all')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                    selectedScreen === 'all' ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <span>📺 Todas las Pantallas (3 Dispositivos Tanix/SmartTV)</span>
                  {selectedScreen === 'all' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </button>
                <button
                  onClick={() => setSelectedScreen('screen1')}
                  className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                    selectedScreen === 'screen1' ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <span>📺 Pantalla Principal Entrada / Salón</span>
                  {selectedScreen === 'screen1' && <CheckCircle2 className="w-4 h-4 text-amber-400" />}
                </button>
              </div>
            </div>

            {/* Botón de Emisión Final */}
            <div className="pt-4 border-t border-slate-800">
              <button
                onClick={handlePublishToTV}
                disabled={isSending}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-xl shadow-amber-500/20 transition-all hover:scale-105"
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    Emitiendo en Pantallas TV...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-slate-950" />
                    EMITIR AHORA EN PANTALLAS TV DE MI LOCAL
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
