import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sparkles, 
  Tv2, 
  Link2, 
  FolderPlus, 
  ListVideo, 
  HelpCircle,
  Minimize2,
  Maximize2,
  PlayCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDisplayDevices, useDisplayCampaigns } from '@/hooks/use-display-hub';
import { useDisplayMedia } from '@/hooks/use-display-media';

interface OnboardingWizardWidgetProps {
  onOpenBluetoothModal?: () => void;
  onOpenLinkModal?: () => void;
  className?: string;
}

export const OnboardingWizardWidget: React.FC<OnboardingWizardWidgetProps> = ({
  onOpenBluetoothModal,
  onOpenLinkModal,
  className = ""
}) => {
  const { commerceId } = useParams<{ commerceId: string }>();
  const navigate = useNavigate();

  // Data queries for automatic step completion
  const { data: devices = [] } = useDisplayDevices(commerceId);
  const { data: media = [] } = useDisplayMedia(commerceId);
  const { data: campaigns = [] } = useDisplayCampaigns(commerceId);

  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);

  // Check localStorage for minimized/dismissed preference
  useEffect(() => {
    const savedDismissed = localStorage.getItem(`onboarding_dismissed_${commerceId}`);
    if (savedDismissed === 'true') {
      setIsOpen(false);
    }
  }, [commerceId]);

  // Automatic step status determination
  const isStep1Done = devices.length > 0;
  const isStep2Done = devices.length > 0;
  const isStep3Done = media.length > 0;
  const isStep4Done = campaigns.length > 0;

  const completedCount = [isStep1Done, isStep2Done, isStep3Done, isStep4Done].filter(Boolean).length;
  const progressPercent = Math.round((completedCount / 4) * 100);

  const handleDismiss = () => {
    setIsOpen(false);
    localStorage.setItem(`onboarding_dismissed_${commerceId}`, 'true');
  };

  const handleReopen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    localStorage.removeItem(`onboarding_dismissed_${commerceId}`);
  };

  if (!isOpen) {
    return (
      <button
        onClick={handleReopen}
        className="fixed bottom-6 left-6 z-40 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 text-xs font-bold border border-indigo-400/30 transition-all hover:scale-105"
      >
        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
        <span>Guía Inicial ({completedCount}/4)</span>
      </button>
    );
  }

  const steps = [
    {
      id: 1,
      title: "Configurá tu pantalla",
      isDone: isStep1Done,
      details: (
        <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 mt-2">
          <li>Conectá el <strong className="text-foreground font-semibold">equipo EDD (equipo de display digital)</strong> a la entrada HDMI de tu televisor o monitor.</li>
          <li>Enchufalo a la corriente eléctrica y sintonizá en el televisor el canal HDMI correspondiente.</li>
          <li>Conectá el equipo a tu red Wi-Fi.</li>
          <li>En la pantalla de la TV verás el <strong className="text-indigo-400 font-semibold">código de emparejamiento</strong>.</li>
        </ul>
      ),
      actionLabel: "Ver estado de pantallas",
      actionIcon: Tv2,
      onAction: () => navigate(`/admin/display/commerce/${commerceId}/workspace/screens`)
    },
    {
      id: 2,
      title: "Emparejar pantalla y asignar contenido",
      isDone: isStep2Done,
      details: (
        <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 mt-2">
          <li>Ingresá el código de emparejamiento para vincular la pantalla a tu negocio y asignarle contenido.</li>
        </ul>
      ),
      actionLabel: "Emparejar Pantalla",
      actionIcon: Link2,
      onAction: () => {
        if (onOpenBluetoothModal) onOpenBluetoothModal();
        else if (onOpenLinkModal) onOpenLinkModal();
        else navigate(`/admin/display/commerce/${commerceId}/workspace/screens?openModal=link`);
      }
    },
    {
      id: 3,
      title: "Crear o subir contenido",
      isDone: isStep3Done,
      details: (
        <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 mt-2">
          <li>
            Subí tus imágenes, videos o afiches a la{' '}
            <button 
              type="button" 
              onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace/library`)}
              className="text-indigo-400 font-semibold underline underline-offset-2 hover:text-indigo-300"
            >
              Galería de Medios
            </button>.
          </li>
          <li>
            O diseñá banners promocionales en la pestaña de{' '}
            <button 
              type="button" 
              onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace/templates`)}
              className="text-indigo-400 font-semibold underline underline-offset-2 hover:text-indigo-300"
            >
              Plantillas
            </button>.
          </li>
        </ul>
      ),
      actionLabel: "Subir Contenido",
      actionIcon: FolderPlus,
      onAction: () => navigate(`/admin/display/commerce/${commerceId}/workspace/library`)
    },
    {
      id: 4,
      title: "Crear una lista de reproducción (Opcional)",
      isDone: isStep4Done,
      details: (
        <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4 mt-2">
          <li>
            Agrupá múltiples imágenes y videos en la pestaña de{' '}
            <button 
              type="button" 
              onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace/playlists`)}
              className="text-indigo-400 font-semibold underline underline-offset-2 hover:text-indigo-300"
            >
              Playlists
            </button>{' '}
            para emitir tu contenido de forma continua y automatizada en tus pantallas.
          </li>
        </ul>
      ),
      actionLabel: "Crear Playlist",
      actionIcon: ListVideo,
      onAction: () => navigate(`/admin/display/commerce/${commerceId}/workspace/playlists`)
    }
  ];

  return (
    <div className={`bg-card border border-border shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 text-foreground w-full max-w-md ${className}`}>
      {/* Header bar */}
      <div className="bg-muted/60 px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-none">Comience</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
              Guía de inicio rápido ({completedCount} de 4 completados)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleDismiss}
            className="w-7 h-7 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pt-3 pb-2 bg-card">
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
          <span>Progreso</span>
          <span className="text-indigo-500 font-bold">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
            style={{ width: `${progressPercent}%` }} 
          />
        </div>
      </div>

      {/* Steps Container (Hidden if Minimized) */}
      {!isMinimized && (
        <div className="p-4 space-y-2.5 max-h-[380px] overflow-y-auto">
          {steps.map((step) => {
            const isExpanded = expandedStep === step.id;
            const ActionIcon = step.actionIcon;

            return (
              <div 
                key={step.id} 
                className={`rounded-xl border transition-all overflow-hidden ${
                  step.isDone 
                    ? 'bg-muted/20 border-border/40' 
                    : isExpanded 
                      ? 'bg-muted/50 border-indigo-500/40 shadow-sm' 
                      : 'bg-card border-border hover:border-border/80'
                }`}
              >
                {/* Step Header */}
                <button
                  type="button"
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full flex items-center justify-between p-3 text-left gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                      step.isDone 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-muted text-muted-foreground border border-border font-bold text-xs'
                    }`}>
                      {step.isDone ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </div>
                    <span className={`text-xs font-semibold truncate ${step.isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {step.title}
                    </span>
                  </div>

                  <div className="shrink-0 text-muted-foreground">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {/* Step Content Details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/30 space-y-3">
                    {step.details}

                    <div className="pt-1">
                      <Button
                        size="sm"
                        onClick={step.onAction}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 rounded-lg font-semibold flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <ActionIcon className="w-3.5 h-3.5" />
                        {step.actionLabel}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Help footer */}
          <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-400" /> ¿Necesitás ayuda?
            </span>
            <button 
              onClick={() => navigate(`/admin/display/commerce/${commerceId}/workspace/ai-knowledge`)}
              className="text-indigo-400 font-semibold hover:underline flex items-center gap-1"
            >
              <PlayCircle className="w-3 h-3" /> Ver Asistente IA
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
