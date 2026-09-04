import React, { useState } from 'react';
import { BusinessAuditReport, IntelligenceBusiness, IntegrationConnector } from '../../types/intelligence';
import { INITIAL_CONNECTORS } from '../../services/intelligence/mockData';
import { Activity, AlertTriangle, CheckCircle, Lightbulb, ChevronRight, ChevronLeft, ArrowUpRight, Share2, Sparkles, MessageSquare, Bot, FileImage, ShieldCheck } from 'lucide-react';

interface BusinessAuditPanelProps {
  business: IntelligenceBusiness;
  auditReport: BusinessAuditReport;
  isOpen: boolean;
  onToggle: () => void;
}

export const BusinessAuditPanel: React.FC<BusinessAuditPanelProps> = ({
  business,
  auditReport,
  isOpen,
  onToggle
}) => {
  const [connectors] = useState<IntegrationConnector[]>(INITIAL_CONNECTORS);
  const [activeTab, setActiveTab] = useState<'audit' | 'integrations'>('audit');

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-24 z-40 bg-slate-900/90 border border-slate-800 border-r-0 text-emerald-400 p-2.5 rounded-l-xl shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all flex items-center gap-2 group"
        title="Abrir Auditoría de Comercio & Acciones"
      >
        <ChevronLeft className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold tracking-wide text-slate-200 hidden md:inline">Auditoría & Conectores</span>
        <Activity className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  const needleRotation = (auditReport.health_score / 100) * 180 - 90;

  return (
    <aside className="w-80 lg:w-96 bg-slate-950/95 border-l border-slate-800/80 h-[calc(100vh-4rem)] flex flex-col z-30 shadow-2xl backdrop-blur-xl transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
              Auditoría & Conectores
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono">LIVE</span>
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[190px]">{auditReport.instagram_handle || business.name}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 p-1.5 bg-slate-900/80 border-b border-slate-800/60 text-xs font-medium">
        <button
          onClick={() => setActiveTab('audit')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'audit' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Auditoría de Perfil
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'integrations' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          Conectores (IA & Meta)
        </button>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        {activeTab === 'audit' && (
          <>
            {/* Velocímetro de Salud (Scorecard) */}
            <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center relative overflow-hidden">
              <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span>Calificación general del perfil</span>
                <span className="text-emerald-400 font-mono font-bold">{auditReport.health_score}/100</span>
              </div>

              {/* Gauge */}
              <div className="relative w-44 h-24 my-2 flex items-end justify-center">
                <svg className="w-44 h-24 overflow-visible" viewBox="0 0 100 50">
                  <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#1E293B" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 10 50 A 40 40 0 0 1 25.8 21.7" fill="none" stroke="#EF4444" strokeWidth="10" strokeLinecap="round" />
                  <path d="M 25.8 21.7 A 40 40 0 0 1 74.2 21.7" fill="none" stroke="#F59E0B" strokeWidth="10" />
                  <path d="M 74.2 21.7 A 40 40 0 0 1 90 50" fill="none" stroke="#10B981" strokeWidth="10" strokeLinecap="round" />
                  <g transform={`rotate(${needleRotation}, 50, 50)`} className="transition-transform duration-700 ease-out">
                    <line x1="50" y1="50" x2="50" y2="16" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
                    <circle cx="50" cy="50" r="5" fill="#38BDF8" stroke="#F8FAFC" strokeWidth="2" />
                  </g>
                </svg>
              </div>

              <div className="text-center">
                <span className="text-xl font-black text-slate-100 font-mono tracking-tight">{auditReport.health_score} <span className="text-xs font-normal text-slate-400">/100</span></span>
                <p className="text-[11px] font-semibold text-emerald-400">Excelente, sigue así</p>
              </div>
            </div>

            {/* Resumen Ejecutivo */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-3.5 rounded-xl space-y-1.5">
              <h4 className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                Resumen Ejecutivo
              </h4>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {auditReport.executive_summary}
              </p>
            </div>

            {/* Auditoría de Bio (Scripty Style) */}
            <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-2xl space-y-3">
              <h4 className="font-bold text-violet-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-violet-400" />
                Optimizar Bio de Instagram
              </h4>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                <span className="text-[10px] text-slate-500 font-sans block mb-1 uppercase font-bold">Bio Actual:</span>
                {auditReport.bio_audit.current_bio}
              </div>

              <div className="bg-rose-950/20 border border-rose-500/30 p-2.5 rounded-xl space-y-1">
                <span className="font-bold text-rose-400 flex items-center gap-1 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fuga de Conversión por Fecha
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {auditReport.bio_audit.weaknesses[0]}
                </p>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 p-2.5 rounded-xl space-y-1">
                <span className="font-bold text-emerald-400 flex items-center gap-1 text-[11px]">
                  <CheckCircle className="w-3.5 h-3.5" /> Recomendación Evergreen (Atemporal)
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {auditReport.bio_audit.recommendations[0]}
                </p>
              </div>
            </div>

            {/* Fortalezas */}
            <div className="space-y-2">
              <h4 className="font-bold text-emerald-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Fortalezas Detectadas
              </h4>
              <div className="space-y-2">
                {auditReport.strengths.map((item, idx) => (
                  <div key={idx} className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-xl text-slate-300 leading-snug flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Acciones Prioritarias */}
            <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
              <h4 className="font-bold text-slate-200 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-violet-400" />
                  Acciones a Aplicar
                </span>
              </h4>
              
              <div className="space-y-2">
                {auditReport.immediate_actions.map((action, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 text-[11px]">{action.title}</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      {action.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-3">
            <div className="p-3 bg-violet-950/30 border border-violet-500/30 rounded-xl space-y-1">
              <h4 className="font-bold text-violet-300 text-xs flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-violet-400" />
                Matriz de Conectores e Integraciones
              </h4>
              <p className="text-slate-400 text-[11px]">
                Conectá las herramientas de tu negocio para sincronizar datos en vivo en el Canvas.
              </p>
            </div>

            <div className="space-y-2.5">
              {connectors.map(conn => (
                <div key={conn.id} className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {conn.provider === 'meta_business' && <MessageSquare className="w-4 h-4 text-cyan-400" />}
                      {conn.provider === 'chatgpt' && <Bot className="w-4 h-4 text-emerald-400" />}
                      {conn.provider === 'claude' && <Sparkles className="w-4 h-4 text-amber-400" />}
                      {conn.provider === 'canva' && <FileImage className="w-4 h-4 text-violet-400" />}
                      {conn.provider === 'webhook_automation' && <Activity className="w-4 h-4 text-rose-400" />}
                      <span className="font-bold text-slate-200 text-xs">{conn.name}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Activo
                    </span>
                  </div>

                  <p className="text-slate-400 text-[11px] font-mono">
                    Cuenta: <span className="text-slate-200 font-semibold">{conn.account_name}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
