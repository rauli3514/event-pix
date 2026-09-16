import React, { useState, useMemo } from 'react';
import {
  X, Tv, Image as ImageIcon, QrCode, CheckCircle2, Play, RefreshCw, Send,
  Monitor, Smartphone, RotateCw, List, Clock, Plus, GripVertical, Trash2,
  ChevronUp, ChevronDown, Zap, Globe, PauseCircle, PlayCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useDisplayMedia } from '../../hooks/use-display-media';
import { useDisplayCampaigns, useCreateCampaign, useUpdateCampaign, useDisplayDevices } from '../../hooks/use-display-hub';
import { DisplayCampaignV2, UniversalElement } from '../../types/display';

interface DisplayTvPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  scriptHook: string;
  scriptCta: string;
  businessId: string;
}

interface PlaylistItem {
  id: string;
  name: string;
  photoUrl: string;
  hook: string;
  cta: string;
  duration: number; // seconds
  active: boolean;
}

const AI_CAMPAIGN_NAME = 'Generado con IA (EventPix Intelligence)';

export const DisplayTvPreviewModal: React.FC<DisplayTvPreviewModalProps> = ({
  isOpen,
  onClose,
  scriptHook,
  scriptCta,
  businessId
}) => {
  const { data: mediaFiles = [] } = useDisplayMedia(businessId);
  const { data: campaigns = [] } = useDisplayCampaigns(businessId);
  const { data: devices = [] } = useDisplayDevices(businessId);
  const createCampaign = useCreateCampaign();
  const updateCampaign = useUpdateCampaign();

  const catalogPhotos = useMemo(
    () => mediaFiles.filter(m => m.type === 'image').map(m => ({ id: m.id, name: m.name, url: m.url })),
    [mediaFiles]
  );
  const onlineDevicesCount = devices.filter((d: any) => d.derived_status === 'online').length;

  const [selectedPhoto, setSelectedPhoto] = useState('');
  const [selectedScreen, setSelectedScreen] = useState<'all' | 'screen1' | 'screen2'>('all');
  const [orientation, setOrientation] = useState<'16:9' | '9:16'>('16:9');
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'playlist'>('preview');

  const [playlist, setPlaylist] = useState<PlaylistItem[]>([]);

  // Una vez que llega la biblioteca real, arrancamos con la primera foto seleccionada.
  React.useEffect(() => {
    if (!selectedPhoto && catalogPhotos.length > 0) {
      setSelectedPhoto(catalogPhotos[0].url);
    }
  }, [catalogPhotos, selectedPhoto]);

  const totalDuration = playlist.filter(p => p.active).reduce((s, p) => s + p.duration, 0);

  if (!isOpen) return null;

  const handlePublishToTV = async () => {
    const activeItems = playlist.filter(p => p.active);
    if (activeItems.length === 0) {
      toast.error('Agregá al menos un slide activo antes de emitir.');
      return;
    }

    setIsSending(true);
    try {
      const elements: UniversalElement[] = activeItems.flatMap((item) => {
        const els: UniversalElement[] = [
          {
            id: `${item.id}_img`,
            type: 'image',
            url: item.photoUrl,
            duration: item.duration,
            transition: 'fade',
            fitMode: 'contain'
          }
        ];
        if (item.hook || item.cta) {
          els.push({
            id: `${item.id}_txt`,
            type: 'text',
            content: [item.hook, item.cta].filter(Boolean).join('\n'),
            duration: 5,
            transition: 'fade'
          });
        }
        return els;
      });

      const campaignData: DisplayCampaignV2 = {
        version: '2.0',
        settings: {
          orientation: orientation === '9:16' ? 'portrait' : 'landscape',
          background: { type: 'color', value: '#050505' },
          shuffle: false,
          transition: 'fade',
          defaultDuration: 10
        },
        zones: [{
          id: 'main',
          name: 'Principal',
          width: '100%', height: '100%', top: 0, left: 0, zIndex: 1,
          playlist: elements
        }]
      };

      const existing = campaigns.find((c: any) => c.name === AI_CAMPAIGN_NAME);
      if (existing) {
        await updateCampaign.mutateAsync({ id: existing.id, updates: { items_json: campaignData } });
      } else {
        await createCampaign.mutateAsync({
          commerceId: businessId,
          name: AI_CAMPAIGN_NAME,
          description: 'Campaña generada automáticamente desde el lienzo de Intelligence.',
          items_json: campaignData
        });
      }

      onClose();
      if (onlineDevicesCount > 0) {
        toast.success(`Guardado en la campaña "${AI_CAMPAIGN_NAME}". Si ya la tenés asignada a una pantalla, se actualiza sola.`);
      } else {
        toast.success(`Guardado en la campaña "${AI_CAMPAIGN_NAME}". Todavía no tenés pantallas online — asignala desde Display Hub cuando conectes una.`);
      }
    } catch (err: any) {
      toast.error('No se pudo guardar la campaña: ' + (err?.message || 'error desconocido'));
    } finally {
      setIsSending(false);
    }
  };

  const handleTogglePlaylistItem = (id: string) => {
    setPlaylist(prev => prev.map(p => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleDeletePlaylistItem = (id: string) => {
    setPlaylist(prev => prev.filter(p => p.id !== id));
    toast.info('Slide eliminado de la playlist.');
  };

  const handleMoveItem = (id: string, dir: 'up' | 'down') => {
    const idx = playlist.findIndex(p => p.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === playlist.length - 1) return;
    const newList = [...playlist];
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    [newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]];
    setPlaylist(newList);
  };

  const handleAddCurrentToPlaylist = () => {
    if (!selectedPhoto) {
      toast.error('Subí o elegí una foto de tu Biblioteca de Display Hub primero.');
      return;
    }
    const photo = catalogPhotos.find(p => p.url === selectedPhoto);
    const newItem: PlaylistItem = {
      id: `pl_${Date.now()}`,
      name: photo?.name || 'Slide Personalizado',
      photoUrl: selectedPhoto,
      hook: scriptHook,
      cta: scriptCta,
      duration: 10,
      active: true
    };
    setPlaylist(prev => [...prev, newItem]);
    toast.success('¡Slide actual añadido a la playlist!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Tv className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                EventPix Display Hub — Campañas para Pantallas TV
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-mono">
                  {orientation === '9:16' ? '9:16 Vertical' : '16:9 Horizontal'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Adaptá y programá campañas en las pantallas físicas de tu comercio</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 border px-3 py-1.5 rounded-xl ${
              onlineDevicesCount > 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800/60 border-slate-700'
            }`}>
              <div className={`w-2 h-2 rounded-full ${onlineDevicesCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className={`text-[11px] font-bold font-mono ${onlineDevicesCount > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                {devices.length === 0
                  ? 'Sin pantallas conectadas'
                  : `${onlineDevicesCount} / ${devices.length} Pantallas Online`}
              </span>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/60 border-b border-slate-800 shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('preview')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'preview' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Play className="w-4 h-4" />
            Vista Previa & Configurar
          </button>
          <button
            onClick={() => setActiveTab('playlist')}
            className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'playlist' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <List className="w-4 h-4" />
            Playlist ({playlist.length} slides · {totalDuration}s)
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* PREVIEW TAB */}
          {activeTab === 'preview' && (
            <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">

              {/* Preview Column */}
              <div className="lg:col-span-7 flex flex-col items-center justify-start space-y-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/80">
                <div className="w-full flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <Play className="w-4 h-4 text-amber-400" /> Previsualización de Pantalla
                  </span>
                  <span className="text-[10px] text-amber-400 font-mono font-bold">
                    {orientation === '9:16' ? '1080×1920 px (Vertical)' : '1920×1080 px (Horizontal)'}
                  </span>
                </div>

                {/* MOCKUP HORIZONTAL */}
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
                      <div className="col-span-5 relative">
                        {selectedPhoto ? (
                          <img
                            src={selectedPhoto}
                            alt="Producto Catálogo"
                            className="w-full h-36 object-cover rounded-2xl border-2 border-amber-500/40 shadow-xl"
                          />
                        ) : (
                          <div className="w-full h-36 rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-900">
                            <ImageIcon className="w-6 h-6 text-slate-600" />
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md text-amber-300 text-[9px] px-2 py-0.5 rounded-md font-semibold border border-amber-500/30">
                          Foto Real de tu Comercio
                        </span>
                      </div>
                      <div className="col-span-7 space-y-2">
                        <h4 className="text-sm font-black text-slate-100 leading-tight">{scriptHook}</h4>
                        <p className="text-[11px] text-amber-300 font-semibold bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">{scriptCta}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-white p-1 rounded-lg shrink-0">
                          <div className="w-full h-full bg-slate-950 rounded flex items-center justify-center">
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
                  /* MOCKUP VERTICAL */
                  <div className="relative w-56 h-[420px] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-4 border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4 transition-all duration-300 my-2">
                    <div className="absolute top-0 inset-x-0 h-32 bg-amber-500/10 blur-2xl pointer-events-none" />
                    <div className="text-center z-10">
                      <span className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-3 py-1 rounded-lg text-[9px] uppercase tracking-wider block">
                        PROMO EXCLUSIVA
                      </span>
                    </div>
                    <div className="relative z-10 my-2">
                      {selectedPhoto ? (
                        <img src={selectedPhoto} alt="Producto" className="w-full h-40 object-cover rounded-2xl border-2 border-amber-500/40 shadow-xl" />
                      ) : (
                        <div className="w-full h-40 rounded-2xl border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-900">
                          <ImageIcon className="w-6 h-6 text-slate-600" />
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 bg-slate-950/80 text-amber-300 text-[8px] px-1.5 py-0.5 rounded border border-amber-500/30">Foto Real Catálogo</span>
                    </div>
                    <div className="space-y-1.5 text-center z-10">
                      <h4 className="text-xs font-black text-slate-100 leading-tight">{scriptHook}</h4>
                      <p className="text-[10px] text-amber-300 font-semibold bg-amber-500/10 p-1.5 rounded-xl border border-amber-500/20">{scriptCta}</p>
                    </div>
                    <div className="bg-slate-950/90 p-2 rounded-xl border border-slate-800/80 flex items-center justify-between z-10 mt-1">
                      <div className="w-9 h-9 bg-white p-1 rounded-lg shrink-0">
                        <div className="w-full h-full bg-slate-950 rounded flex items-center justify-center">
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

                <button
                  onClick={handleAddCurrentToPlaylist}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-2 border border-slate-700 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-amber-400" />
                  Agregar a Playlist
                </button>
              </div>

              {/* Config Column */}
              <div className="lg:col-span-5 space-y-5">

                {/* Orientation */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                    <RotateCw className="w-4 h-4 text-amber-400" /> Orientación de tus Pantallas TV
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: '16:9' as const, label: '16:9 Horizontal', sub: 'Smart TV / TV Pared', icon: <Monitor className="w-5 h-5 text-amber-400" /> },
                      { val: '9:16' as const, label: '9:16 Vertical', sub: 'Tótem / Kiosco / Pantalla Alta', icon: <Smartphone className="w-5 h-5 text-amber-400" /> }
                    ].map(opt => (
                      <button
                        key={opt.val}
                        onClick={() => setOrientation(opt.val)}
                        className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                          orientation === opt.val
                            ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 font-bold shadow-lg shadow-amber-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.icon}
                        <span className="text-xs">{opt.label}</span>
                        <span className="text-[9px] text-slate-500">{opt.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catalog Photos */}
                <div className="space-y-2.5 pt-3 border-t border-slate-800">
                  <label className="font-bold text-slate-200 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-violet-400" />
                      Fotos Reales de tu Catálogo
                    </span>
                    <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">Librería EventPix</span>
                  </label>
                  {catalogPhotos.length === 0 ? (
                    <div className="text-[11px] text-slate-500 bg-slate-950 border border-dashed border-slate-800 rounded-xl p-3 text-center">
                      Todavía no subiste fotos a tu Biblioteca de Display Hub. Subí alguna desde ahí para poder elegirla acá.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {catalogPhotos.map(photo => (
                        <button
                          key={photo.id}
                          onClick={() => setSelectedPhoto(photo.url)}
                          className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${
                            selectedPhoto === photo.url ? 'border-amber-500 ring-2 ring-amber-500/40 scale-105' : 'border-slate-800 opacity-60 hover:opacity-90'
                          }`}
                          title={photo.name}
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
                  )}
                </div>

                {/* Target Screens */}
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
                    <span>📺 {devices.length} Pantalla{devices.length === 1 ? '' : 's'} — {orientation}</span>
                    <CheckCircle2 className="w-4 h-4 text-amber-400" />
                  </button>
                  <p className="text-[10px] text-slate-500">
                    Se guarda como campaña en Display Hub. Para verla en una pantalla, asignala desde ahí si todavía no lo está.
                  </p>
                </div>

                {/* Emit Button */}
                <div className="pt-3 border-t border-slate-800">
                  <button
                    onClick={handlePublishToTV}
                    disabled={isSending}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-xl shadow-amber-500/20 transition-all hover:scale-105"
                  >
                    {isSending ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" />Emitiendo en Pantallas TV...</>
                    ) : (
                      <><Send className="w-4 h-4" />EMITIR AHORA EN PANTALLAS ({orientation})</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PLAYLIST TAB */}
          {activeTab === 'playlist' && (
            <div className="p-6 space-y-4 text-xs">
              {/* Playlist Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Slides Activos', val: playlist.filter(p => p.active).length, icon: <PlayCircle className="w-4 h-4 text-emerald-400" />, color: 'emerald' },
                  { label: 'Duración Total', val: `${totalDuration}s`, icon: <Clock className="w-4 h-4 text-amber-400" />, color: 'amber' },
                  { label: 'Ciclo cada', val: `~${Math.round(totalDuration / 60)}min`, icon: <Globe className="w-4 h-4 text-violet-400" />, color: 'violet' }
                ].map((s, idx) => (
                  <div key={idx} className="bg-slate-900/80 border border-slate-800 p-3 rounded-2xl flex flex-col items-center gap-1 text-center">
                    {s.icon}
                    <span className="font-black text-slate-100 font-mono text-base">{s.val}</span>
                    <span className="text-slate-400 text-[10px]">{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Playlist Info */}
              <div className="bg-amber-950/20 border border-amber-500/20 p-3 rounded-2xl flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-300 text-[11px]">Playlist en Rotación Automática</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">
                    Los slides activos se emiten en bucle en tus pantallas TV. Reordenalos arrastrando, activalos/desactivalos o agregá nuevos desde la vista previa.
                  </p>
                </div>
              </div>

              {/* Playlist Items */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <List className="w-3.5 h-3.5 text-amber-400" />
                    Slides en la Playlist
                  </h4>
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="text-[10px] text-violet-400 hover:text-violet-200 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Crear Slide
                  </button>
                </div>

                {playlist.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`bg-slate-900 border rounded-2xl p-3 flex items-center gap-3 transition-all ${
                      item.active ? 'border-slate-700' : 'border-slate-800 opacity-50'
                    }`}
                  >
                    {/* Drag Handle */}
                    <div className="text-slate-600 cursor-grab shrink-0">
                      <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Order */}
                    <span className="text-slate-500 font-mono text-[10px] w-5 text-center shrink-0">{idx + 1}</span>

                    {/* Thumbnail */}
                    <div className="w-14 h-10 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                      <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="font-bold text-slate-200 text-[11px] truncate">{item.name}</div>
                      <div className="text-slate-500 text-[10px] truncate italic">"{item.hook.substring(0, 50)}..."</div>
                    </div>

                    {/* Duration */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono shrink-0">
                      <Clock className="w-3 h-3" />{item.duration}s
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveItem(item.id, 'up')}
                        disabled={idx === 0}
                        className="text-slate-600 hover:text-slate-300 p-1 disabled:opacity-30 transition-colors"
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveItem(item.id, 'down')}
                        disabled={idx === playlist.length - 1}
                        className="text-slate-600 hover:text-slate-300 p-1 disabled:opacity-30 transition-colors"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleTogglePlaylistItem(item.id)}
                        className={`p-1 transition-colors ${item.active ? 'text-emerald-400 hover:text-emerald-200' : 'text-slate-600 hover:text-slate-400'}`}
                        title={item.active ? 'Desactivar slide' : 'Activar slide'}
                      >
                        {item.active ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDeletePlaylistItem(item.id)}
                        className="text-slate-700 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {playlist.length === 0 && (
                  <div className="bg-slate-900/40 border border-dashed border-slate-700 rounded-2xl p-8 text-center space-y-2">
                    <List className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-slate-400 text-[11px]">No hay slides en la playlist. Creá uno desde la pestaña Vista Previa.</p>
                  </div>
                )}
              </div>

              {/* Emit Playlist */}
              <div className="pt-3 border-t border-slate-800">
                <button
                  onClick={handlePublishToTV}
                  disabled={isSending || playlist.filter(p => p.active).length === 0}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 text-slate-950 font-black py-3 rounded-2xl flex items-center justify-center gap-2 text-xs shadow-xl shadow-amber-500/20 transition-all hover:scale-105"
                >
                  {isSending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Enviando Playlist a las Pantallas...</>
                  ) : (
                    <><Send className="w-4 h-4" />EMITIR PLAYLIST ({playlist.filter(p => p.active).length} slides · {totalDuration}s · {orientation})</>
                  )}
                </button>
                <p className="text-center text-slate-500 text-[10px] mt-2">Los slides inactivos se excluyen de la emisión</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
