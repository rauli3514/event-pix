// ================================================================
// BusinessSwitcher.tsx
// Selector y Switcher Multi-Tenant de Comercios / Clientes
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  ChevronDown,
  Plus,
  Check,
  Instagram,
  Store
} from 'lucide-react';
import { IntelligenceBusiness } from '../../types/intelligence';
import { IntelligenceStorageService } from '../../services/intelligence/IntelligenceStorageService';

interface BusinessSwitcherProps {
  currentBusiness: IntelligenceBusiness;
  onSelectBusiness: (business: IntelligenceBusiness) => void;
  onOpenNewClientModal?: () => void;
}

export const BusinessSwitcher: React.FC<BusinessSwitcherProps> = ({
  currentBusiness,
  onSelectBusiness,
  onOpenNewClientModal
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [businesses, setBusinesses] = useState<IntelligenceBusiness[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadList = async () => {
    const list = await IntelligenceStorageService.listBusinesses();
    setBusinesses(list);
  };

  useEffect(() => {
    loadList();
  }, [currentBusiness?.id]);

  // Cerrar al clickear afuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Botón Principal del Switcher */}
      <button
        type="button"
        onClick={() => {
          loadList();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all text-left shadow-sm group"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-violet-600/30">
          <Store className="w-3.5 h-3.5" />
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-100 truncate max-w-[140px] sm:max-w-[190px]">
              {currentBusiness?.name || 'Comercio'}
            </span>
            <span className="text-[10px] font-mono text-violet-400 font-bold bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.2 rounded-md">
              {currentBusiness?.instagram_handle || '@comercio'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
            {currentBusiness?.niche || 'Cartelería & IA'}
          </span>
        </div>

        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          
          <div className="p-3 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-violet-400" />
              Comercios & Clientes
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {businesses.length} registrados
            </span>
          </div>

          {/* Lista de Comercios */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
            {businesses.map((biz) => {
              if (!biz || !biz.id) return null;
              const isSelected = biz.id === currentBusiness?.id;
              return (
                <div
                  key={biz.id}
                  onClick={() => {
                    IntelligenceStorageService.setActiveBusinessId(biz.id);
                    onSelectBusiness(biz);
                    setIsOpen(false);
                  }}
                  className={`p-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                    isSelected 
                      ? 'bg-violet-950/40 border border-violet-500/40 text-violet-200' 
                      : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isSelected 
                        ? 'bg-violet-600/30 border-violet-500/50 text-violet-300' 
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}>
                      <Store className="w-3.5 h-3.5" />
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-100 block truncate">
                        {biz.name || 'Comercio'}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Instagram className="w-2.5 h-2.5 text-pink-400" />
                        <span className="font-mono text-slate-300 truncate">{biz.instagram_handle || '@comercio'}</span>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center text-white shrink-0">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer: Botón para Registrar Nuevo Cliente */}
          <div className="p-2 border-t border-slate-800 bg-slate-950/60">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                if (onOpenNewClientModal) {
                  onOpenNewClientModal();
                } else {
                  window.location.href = '/register';
                }
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Nuevo Cliente / Local
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
