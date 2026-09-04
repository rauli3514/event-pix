import React from 'react';
import { BusinessAuditReport, IntelligenceBusiness } from '../../types/intelligence';
import { Activity, AlertTriangle, CheckCircle, Lightbulb, ChevronRight, ChevronLeft, ArrowUpRight } from 'lucide-react';

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
  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed right-0 top-24 z-40 bg-slate-900/90 border border-slate-800 border-r-0 text-emerald-400 p-2.5 rounded-l-xl shadow-xl backdrop-blur-md hover:bg-slate-800 transition-all flex items-center gap-2 group"
        title="Abrir Auditoría de Comercio & Acciones"
      >
        <ChevronLeft className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold tracking-wide text-slate-200 hidden md:inline">Auditoría & Salud</span>
        <Activity className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
      </button>
    );
  }

  // Ángulo de la aguja del velocímetro según la puntuación de salud (0 a 100)
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
              Auditoría del Comercio
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono">LIVE</span>
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[190px]">{business.name}</p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Audit Report Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar text-xs">
        
        {/* Velocímetro de Salud de Cuenta (Scorecard) */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex flex-col items-center relative overflow-hidden">
          <div className="w-full flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span>Salud del Contenido</span>
            <span className="text-emerald-400 font-mono font-bold">{auditReport.health_score}/100 pts</span>
          </div>

          {/* SVG Speedometer Gauge */}
          <div className="relative w-44 h-24 my-2 flex items-end justify-center">
            <svg className="w-44 h-24 overflow-visible" viewBox="0 0 100 50">
              {/* Sombra de arco de fondo */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#1E293B"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Arco Rojo (0-40) */}
              <path
                d="M 10 50 A 40 40 0 0 1 25.8 21.7"
                fill="none"
                stroke="#EF4444"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Arco Ámbar (40-70) */}
              <path
                d="M 25.8 21.7 A 40 40 0 0 1 74.2 21.7"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="10"
              />
              {/* Arco Verde (70-100) */}
              <path
                d="M 74.2 21.7 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#10B981"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Aguja del Velocímetro */}
              <g transform={`rotate(${needleRotation}, 50, 50)`} className="transition-transform duration-700 ease-out">
                <line x1="50" y1="50" x2="50" y2="16" stroke="#F8FAFC" strokeWidth="3" strokeLinecap="round" />
                <circle cx="50" cy="50" r="5" fill="#38BDF8" stroke="#F8FAFC" strokeWidth="2" />
              </g>
            </svg>
          </div>

          {/* Calificación */}
          <div className="text-center">
            <span className="text-lg font-black text-slate-100 font-mono tracking-tight">{auditReport.health_score} <span className="text-xs font-normal text-slate-400">/100</span></span>
            <p className="text-[11px] font-semibold text-emerald-400">
              {auditReport.health_score >= 80 ? 'Excelente rendimiento estratégico' : auditReport.health_score >= 60 ? 'Rendimiento aceptable con oportunidades' : 'Requiere optimización de ganchos'}
            </p>
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

        {/* Fortalezas Detectadas */}
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

        {/* Qué está frenando el perfil */}
        <div className="space-y-2">
          <h4 className="font-bold text-rose-400 flex items-center gap-1.5 text-xs uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Frenos de Conversión Detectados
          </h4>
          <div className="space-y-2">
            {auditReport.conversion_bottlenecks.map((item, idx) => (
              <div key={idx} className="bg-rose-950/20 border border-rose-500/20 p-2.5 rounded-xl text-slate-300 leading-snug flex items-start gap-2">
                <span className="text-rose-400 font-bold">•</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Acciones Inmediatas a Aplicar */}
        <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
          <h4 className="font-bold text-slate-200 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5">
              <ArrowUpRight className="w-4 h-4 text-violet-400" />
              Plan de Acción Recomendado
            </span>
            <span className="text-[10px] text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">Prioritario</span>
          </h4>
          
          <div className="space-y-2.5">
            {auditReport.immediate_actions.map((action, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200 text-[11px]">{action.title}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                    action.priority === 'Alta' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {action.priority}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {action.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </aside>
  );
};
