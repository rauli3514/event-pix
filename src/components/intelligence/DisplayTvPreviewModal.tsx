import React, { useState } from 'react';
import { X, Tv, Image as ImageIcon, QrCode, CheckCircle2, Play, RefreshCw, Send, Monitor, Smartphone, RotateCw } from 'lucide-react';
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
  const [catalogPhotos] = useState([
    { id: 'p1', name: 'Plato / Producto Estrella #1', url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=600&auto=format&fit=crop' },
    { id: 'p2', name: 'Combo Especial Fin de Semana', url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=600&auto=format&fit=crop' },
    { id: 'p3', name: 'Servicio / Experiencia VIP', url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=600&auto=format&fit=crop' }
  ]);

  const [selectedPhoto, setSelectedPhoto] = useState(catalogPhotos[0].url);
  const [selectedScreen, setSelectedScreen] = useState<'all' | 'screen1' | 'screen2'>('all');
  const [orientation, setOrientation] = useState<'16:9' | '9:16'>('16:9'); // 16:9 Horizontal vs 9:16 Vertical
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const handlePublishToTV = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      onClose();
      toast.success(`📺 ¡Campaña emitida en vivo en formato ${orientation === '9:16' ? 'Vertical (9:16 / Tótem)' : 'Horizontal (16:9)'} en las Pantallas TV del comercio!`);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Generador de Campañas para Pantallas TV (Display Hub)
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  {orientation === '9:16' ? '9:16 Vertical (Tótem / Kiosco)' : '16:9 Horizontal (Full HD)'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Adaptación del contenido a la orientación física de las pantallas de tu local</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs custom-scrollbar">
          
          {/* Columna Izquierda: Vista Previa Dinámica (Horizontal vs Vertical) */}
          <div className="lg:col-span-7 flex flex-col items-center justify-start space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
            <div className="w-full flex items-center justify-between">
              <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Play className="w-4 h-4 text-amber-400" /> Previsualización de Pantalla
              </span>
              <span className="text-[10px] text-amber-400 font-mono font-bold">
                {orientation === '9:16' ? '1080x1920 px (Vertical)' : '1920x1080 px (Horizontal)'}
              </span>
            </div>

            {/* MOCKUP PANTALLA HORIZONTAL (16:9) */}
            {orientation === '16:9' ? (
              <div className="relative w-full aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-4 border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between p-6 transition-all duration-300">
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="flex items-center justify-between z-10">
                  <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider">
                    PROMO EXCLUSIVA EN LOCAL
                  </span>
                  <span className="text-slate-400 text-[10px] font-mono">EventPix Display 16:9</span>
                </div>

                <div className="grid grid-cols-12 gap-4 items-center z-10 my-auto">
                  <div className="col-span-5 relative group">
                    <img
                      src={selectedPhoto}
                      alt="Producto Catálogo"
                      className="w-full h-36 object-cover rounded-2xl border-2 border-amber-500/40 shadow-xl"
                    />
                    <span className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md text-amber-300 text-[9px] px-2 py-0.5 rounded-md font-semibold border border-amber-500/30">
                      Foto Real de tu Comercio
                    </span>
                  </div>

                  <div className="col-span-7 space-y-2">
                    <h4 className="text-sm font-black text-slate-100 leading-tight">
                      {scriptHook}
                    </h4>
                    <p className="text-[11px] text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
                      {scriptCta}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-white p-1 rounded-lg shrink-0">
                      <div className="w-full h-full bg-slate-950 rounded flex items-center justify-center text-white">
                        <QrCode className="w-6 h-6 text-amber-400" />
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-200 font-bold block text-[11px]">Escaneá el QR o envía "APP"</span>
                      <span className="text-slate-400 text-[9px]">WhatsApp Auto-Responder</span>
                    </div>
                  </div>

                  <span className="text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Transmisión Horizontal Active
                  </span>
                </div>
              </div>
            ) : (
              /* MOCKUP PANTALLA VERTICAL (9:16 - TÓTEM / KIOSCO) */
              <div className="relative w-64 h-[440px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4 transition-all duration-300 my-2">
                <div className="absolute top-0 inset-x-0 h-32 bg-amber-500/10 blur-2xl pointer-events-none" />

                <div className="text-center z-10">
                  <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-3 py-1 rounded-lg text-[9px] uppercase tracking-wider block">
                    PROMO EXCLUSIVA
                  </span>
                </div>

                {/* Foto destacada arriba */}
                <div className="relative z-10 my-2">
                  <img
                    src={selectedPhoto}
                    alt="Producto Catálogo"
                    className="w-full h-44 object-cover rounded-2xl border-2 border-amber-500/40 shadow-xl"
                  />
                  <span className="absolute bottom-2 left-2 bg-slate-950/80 text-amber-300 text-[8px] px-1.5 py-0.5 rounded border border-amber-500/30">
                    Foto Real Catálogo
                  </span>
                </div>

                {/* Texto Hook + CTA */}
                <div className="space-y-1.5 text-center z-10">
                  <h4 className="text-xs font-black text-slate-100 leading-tight">
                    {scriptHook}
                  </h4>
                  <p className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 p-1.5 rounded-xl border border-amber-500/20">
                    {scriptCta}
                  </p>
                </div>

                {/* QR Interactivo en la base del tótem */}
                <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between z-10 mt-1">
                  <div className="w-9 h-9 bg-white p-1 rounded-lg shrink-0">
                    <div className="w-full h-full bg-slate-950 rounded flex items-center justify-center text-white">
                      <QrCode className="w-5 h-5 text-amber-400" />
                    </div>
                  </div>
                  <div className="text-right leading-tight">
                    <span className="text-slate-100 font-bold text-[10px] block">Escaneá QR</span>
                    <span className="text-amber-400 text-[8px]">WhatsApp Directo</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Configuración de Orientación, Fotos y Emisión */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* SELECTOR DE ORIENTACIÓN DE PANTALLA (16:9 vs 9:16) */}
            <div className="space-y-2">
              <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <RotateCw className="w-4 h-4 text-amber-400" /> Orientación de tus Pantallas TV
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrientation('16:9')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orientation === '16:9'
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 font-bold shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Monitor className="w-5 h-5 text-amber-400" />
                  <span className="text-xs">16:9 Horizontal</span>
                  <span className="text-[9px] text-slate-500">Smart TV / TV Pared</span>
                </button>

                <button
                  onClick={() => setOrientation('9:16')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    orientation === '9:16'
                      ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 font-bold shadow-lg shadow-amber-500/10'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Smartphone className="w-5 h-5 text-amber-400" />
                  <span className="text-xs">9:16 Vertical</span>
                  <span className="text-[9px] text-slate-500">Tótem / Kiosco / Pantalla Alta</span>
                </button>
              </div>
            </div>

            {/* Selector de Fotos del Catálogo */}
            <div className="space-y-2.5 pt-3 border-t border-slate-800">
              <label className="font-bold text-slate-200 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-violet-400" />
                  Fotos Reales de tu Catálogo
                </span>
                <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                  Librería EventPix
                </span>
              </label>

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

            {/* Selector de Dispositivos */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                <Tv className="w-4 h-4 text-amber-400" /> Dispositivos de Destino
              </label>
              <button
                onClick={() => setSelectedScreen('all')}
                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all ${
                  selectedScreen === 'all' ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <span>📺 3 Pantallas ({orientation})</span>
                <CheckCircle2 className="w-4 h-4 text-amber-400" />
              </button>
            </div>

            {/* Botón de Emisión Final */}
            <div className="pt-3 border-t border-slate-800">
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
                    EMITIR AHORA EN PANTALLAS ({orientation})
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
