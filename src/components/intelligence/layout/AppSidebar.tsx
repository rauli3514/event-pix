// ================================================================
// AppSidebar.tsx
// Barra lateral fija de navegación — reemplaza al header horizontal
// para liberar todo el ancho de la pantalla para el Lienzo, y agrupa
// la navegación principal como un menú vertical (estilo Figma/Scripty).
// EventPix Intelligence — SaaS Platform
// ================================================================

import React from 'react';
import {
  Brain, Network, Search, MessageSquare, LayoutDashboard, User,
  Radio, Sparkles, Zap, Bot, Cloud, Loader2, Activity, Trash2,
  ShieldCheck, X
} from 'lucide-react';
import { IntelligenceBusiness } from '../../../types/intelligence';
import { UnifiedConnectionsState } from '../../../types/connections';
import { BusinessSwitcher } from '../BusinessSwitcher';

export type ViewMode = 'canvas' | 'messages' | 'profile' | 'dashboard' | 'analysis';

interface AppSidebarProps {
  business: IntelligenceBusiness;
  accountHandle: string;
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  profileCompleted: boolean | null;
  isSuperAdmin: boolean;
  onSelectBusiness: (business: IntelligenceBusiness) => void;
  onOpenNewClientModal: () => void;
  activeConnectionsCount: number;
  onOpenConnections: () => void;
  onOpenExecutiveReport: () => void;
  connections: UnifiedConnectionsState;
  onToggleAIProvider: () => void;
  syncStatus: 'synced' | 'saving';
  healthScore: number;
  onResetToZero: () => void;
  onNavigate?: () => void;
  onCloseMobile?: () => void;
}

const NAV_ITEMS: Array<{ mode: ViewMode; label: string; icon: any }> = [
  { mode: 'canvas', label: 'Lienzo (Board)', icon: Network },
  { mode: 'analysis', label: 'Buscar Perfil', icon: Search },
  { mode: 'messages', label: 'Mensajes', icon: MessageSquare },
  { mode: 'dashboard', label: 'Métricas', icon: LayoutDashboard },
  { mode: 'profile', label: 'Perfil & Contexto IA', icon: User },
];

export const AppSidebar: React.FC<AppSidebarProps> = ({
  business,
  accountHandle,
  viewMode,
  onChangeViewMode,
  profileCompleted,
  isSuperAdmin,
  onSelectBusiness,
  onOpenNewClientModal,
  activeConnectionsCount,
  onOpenConnections,
  onOpenExecutiveReport,
  connections,
  onToggleAIProvider,
  syncStatus,
  healthScore,
  onResetToZero,
  onNavigate,
  onCloseMobile,
}) => {
  const hasAnyAIProvider =
    Boolean(connections.gemini?.apiKey && connections.gemini.apiKey.length > 5) ||
    Boolean(connections.claude?.apiKey && connections.claude.apiKey.length > 5) ||
    Boolean(connections.openai?.apiKey && connections.openai.apiKey.length > 5) ||
    connections.openai.status === 'connected' ||
    connections.claude.status === 'connected' ||
    connections.gemini?.status === 'connected';

  const aiProviderLabel = connections.preferredAIProvider === 'gemini'
    ? 'Gemini 1.5'
    : connections.preferredAIProvider === 'claude'
    ? 'Claude Sonnet'
    : connections.preferredAIProvider === 'openai'
    ? 'GPT-4o'
    : 'Multi-IA: Auto';

  const aiProviderColor = connections.preferredAIProvider === 'gemini'
    ? 'text-sky-300 bg-sky-500/10 border-sky-500/30'
    : connections.preferredAIProvider === 'claude'
    ? 'text-amber-300 bg-amber-500/10 border-amber-500/30'
    : connections.preferredAIProvider === 'openai'
    ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
    : 'text-fuchsia-300 bg-fuchsia-500/15 border-fuchsia-500/40';

  const handleNav = (mode: ViewMode) => {
    onChangeViewMode(mode);
    onNavigate?.();
  };

  return (
    <aside className="w-64 h-full shrink-0 bg-slate-950/95 border-r border-slate-800/80 flex flex-col overflow-hidden">
      {/* MARCA */}
      <div className="p-3.5 border-b border-slate-800/80 flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-violet-600/30 shrink-0">
          <Brain className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[11px] font-black tracking-tight text-slate-100 uppercase truncate">
            EventPix Intelligence
          </h1>
          <p className="text-[10px] text-slate-500 truncate">Centro de Decisión & Acción</p>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 md:hidden"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* NEGOCIO ACTIVO */}
      <div className="p-3 border-b border-slate-800/80 shrink-0">
        <BusinessSwitcher
          currentBusiness={business}
          onSelectBusiness={(b) => { onSelectBusiness(b); onNavigate?.(); }}
          onOpenNewClientModal={() => { onOpenNewClientModal(); onNavigate?.(); }}
          readOnly={!isSuperAdmin}
        />
      </div>

      {/* NAVEGACIÓN PRINCIPAL */}
      <nav className="p-2.5 space-y-1 shrink-0">
        {NAV_ITEMS.map(({ mode, label, icon: Icon }) => {
          const isActive = viewMode === mode;
          const isDisabled = profileCompleted === false && mode !== 'profile';
          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleNav(mode)}
              disabled={isDisabled}
              title={isDisabled ? 'Completá tu Perfil & Contexto IA primero' : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-600/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          );
        })}
      </nav>

      {/* ACCIONES RÁPIDAS */}
      <div className="px-2.5 pb-2.5 space-y-1.5 shrink-0">
        <button
          type="button"
          onClick={() => { onOpenExecutiveReport(); onNavigate?.(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-600/20 to-indigo-600/20 hover:from-violet-600/30 hover:to-indigo-600/30 border border-violet-500/30 text-violet-200 text-xs font-bold transition-all"
        >
          <Sparkles className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
          <span className="truncate">Informe de Inteligencia</span>
        </button>

        <button
          type="button"
          onClick={() => { onOpenConnections(); onNavigate?.(); }}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-all"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Radio className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="truncate">Conectar APIs</span>
          </span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
            activeConnectionsCount > 0
              ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-500/40'
              : 'bg-slate-800 text-slate-400'
          }`}>
            {activeConnectionsCount > 0 ? `🟢 ${activeConnectionsCount}` : '⚪ 0'}
          </span>
        </button>

        {hasAnyAIProvider && (
          <button
            type="button"
            onClick={onToggleAIProvider}
            title="Click para alternar entre Multi-IA Automático, Claude Sonnet, Google Gemini y ChatGPT GPT-4o"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${aiProviderColor}`}
          >
            {connections.preferredAIProvider === 'openai' ? (
              <Bot className="w-4 h-4 shrink-0" />
            ) : (
              <Zap className="w-4 h-4 shrink-0" />
            )}
            <span className="truncate">IA: {aiProviderLabel}</span>
          </button>
        )}
      </div>

      {/* ESPACIADOR */}
      <div className="flex-1" />

      {/* ADMIN */}
      {isSuperAdmin && (
        <div className="px-2.5 pb-2 shrink-0">
          <a
            href="/admin"
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-slate-300 hover:text-pink-300 text-xs font-semibold transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-pink-400 shrink-0" />
            <span className="truncate">Panel de Admin</span>
          </a>
        </div>
      )}

      {/* PIE: ESTADO Y ACCIONES SECUNDARIAS */}
      <div className="p-2.5 border-t border-slate-800/80 space-y-1.5 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
          <Activity className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="text-slate-400">Salud:</span>
          <span className="text-cyan-400 font-bold font-mono">{healthScore}/100</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
          {syncStatus === 'saving' ? (
            <>
              <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
              <span className="text-violet-300 font-medium">Guardando...</span>
            </>
          ) : (
            <>
              <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium">SaaS Cloud</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onResetToZero}
          title="Limpiar datos demo y comenzar desde 0"
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/20 hover:bg-rose-900/40 border border-rose-500/20 hover:border-rose-500/50 text-rose-400 text-[11px] font-semibold transition-all"
        >
          <Trash2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Reiniciar a 0</span>
        </button>

        <div className="px-1 pt-1 text-[10px] text-slate-500 truncate">
          {accountHandle}
        </div>
      </div>
    </aside>
  );
};
