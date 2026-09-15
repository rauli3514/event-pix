// ================================================================
// NewClientRegistrationModal.tsx
// Onboarding y Registro de Nuevos Comercios / Clientes (Multi-Tenant)
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useState } from 'react';
import {
  X,
  Store,
  Instagram,
  PhoneCall,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Lock,
  Key,
  HelpCircle
} from 'lucide-react';
import { IntelligenceBusiness } from '../../types/intelligence';
import { IntelligenceStorageService } from '../../services/intelligence/IntelligenceStorageService';
import { MetaGraphService, MetaCredentials } from '../../services/meta/MetaGraphService';
import { ConnectionStorageService } from '../../services/intelligence/ConnectionStorageService';
import { toast } from 'sonner';

interface NewClientRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientRegistered: (business: IntelligenceBusiness) => void;
}

const BUSINESS_NICHES = [
  'Gastronomía & Bares',
  'Salud & Farmacias',
  'Indumentaria & Calzado',
  'Estética & Barberías',
  'Gimnasios & Deporte',
  'Comercios & Retail',
  'Entretenimiento & Eventos',
  'Servicios Profesionales',
  'Otro Rubro'
];

export const NewClientRegistrationModal: React.FC<NewClientRegistrationModalProps> = ({
  isOpen,
  onClose,
  onClientRegistered
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  // Paso 1: Datos del Negocio
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('Gastronomía & Bares');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');

  // Paso 2: Instagram del Negocio
  const [instagramHandle, setInstagramHandle] = useState('');
  const [hasMetaToken, setHasMetaToken] = useState(false);
  const [metaAccessToken, setMetaAccessToken] = useState('');
  const [instagramAccountId, setInstagramAccountId] = useState('');

  // Paso 3: WhatsApp del Negocio
  const [phone, setPhone] = useState('+54 9 ');

  if (!isOpen) return null;

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) {
      if (!name.trim()) {
        toast.error('Ingresá el nombre del comercio');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!instagramHandle.trim()) {
        toast.error('Ingresá el usuario de Instagram del local (ej. @milocallocal)');
        return;
      }
      setStep(3);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // 1. Registrar comercio en IntelligenceStorageService
      const newBusiness = await IntelligenceStorageService.registerClientAccount({
        name: name.trim(),
        instagramHandle: instagramHandle.trim(),
        niche,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });

      // 2. Si cargó credenciales de Meta Graph API, guardarlas aisladas para este negocio
      if (hasMetaToken && metaAccessToken.trim() && instagramAccountId.trim()) {
        const creds: MetaCredentials = {
          appId: '2345235469580053',
          appSecret: '',
          accessToken: metaAccessToken.trim(),
          instagramAccountId: instagramAccountId.trim(),
          accountUsername: instagramHandle.replace('@', '')
        };
        MetaGraphService.saveCredentials(creds, newBusiness.id);
      }

      // 3. Guardar configuración de WhatsApp en ConnectionStorageService
      if (phone.trim()) {
        const conns = ConnectionStorageService.loadConnections(newBusiness.id);
        ConnectionStorageService.saveConnections(newBusiness.id, {
          ...conns,
          business_id: newBusiness.id,
          whatsapp: {
            ...conns.whatsapp,
            phoneNumberId: conns.whatsapp.phoneNumberId || 'phone_' + Date.now()
          }
        });
      }

      toast.success(`¡Comercio "${newBusiness.name}" creado con éxito!`);
      onClientRegistered(newBusiness);
      onClose();
    } catch (err: any) {
      toast.error('Error al registrar el cliente: ' + (err?.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Registrar Nuevo Cliente / Local
              </h3>
              <p className="text-xs text-slate-400">
                Onboarding Multi-Tenant para Cartelería Digital e Instagram IA
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper Indicator */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
              step >= 1 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              1
            </div>
            <span className={step >= 1 ? 'font-bold text-slate-200' : 'text-slate-500'}>
              Comercio
            </span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 2 ? 'bg-violet-600' : 'bg-slate-800'}`} />
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
              step >= 2 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              2
            </div>
            <span className={step >= 2 ? 'font-bold text-slate-200' : 'text-slate-500'}>
              Instagram
            </span>
          </div>
          <div className={`h-0.5 flex-1 mx-3 ${step >= 3 ? 'bg-violet-600' : 'bg-slate-800'}`} />
          <div className="flex items-center gap-2 text-xs">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
              step === 3 ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              3
            </div>
            <span className={step === 3 ? 'font-bold text-slate-200' : 'text-slate-500'}>
              WhatsApp & Activación
            </span>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-200">
          
          {/* PASO 1: DATOS DEL COMERCIO */}
          {step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nombre del Comercio o Empresa *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ej. Café Martínez, Farmacia San Martín, Barbería Deluxe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Rubro Comercial *
                  </label>
                  <select
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-violet-500"
                  >
                    {BUSINESS_NICHES.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Nombre del Responsable / Contacto
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    placeholder="Ej. Martín Benítez (Dueño)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Correo Electrónico de Notificaciones
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="contacto@comercio.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="bg-violet-950/20 border border-violet-500/20 rounded-xl p-3 flex items-start gap-2.5 text-xs text-slate-400">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                <span>
                  Al registrar el local, EventPix creará automáticamente su espacio de <strong>Cartelería Digital</strong> (pantallas verticales) y su <strong>CRM de Inteligencia</strong>.
                </span>
              </div>

              <div className="pt-3 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 flex items-center gap-2 transition-all"
                >
                  Continuar a Instagram <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* PASO 2: CONEXIÓN DE INSTAGRAM */}
          {step === 2 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Usuario de Instagram del Comercio *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pink-400 font-bold text-sm">@</span>
                  <input
                    type="text"
                    value={instagramHandle.replace('@', '')}
                    onChange={e => setInstagramHandle('@' + e.target.value.trim())}
                    placeholder="cafemartinez_ar"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500 font-mono"
                    required
                    autoFocus
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Los Reels y consultas de este usuario se vincularán al CRM del local.
                </span>
              </div>

              {/* Opción Avanzada: Credenciales de Meta Graph API */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Key className="w-4 h-4 text-pink-400" />
                    <span>¿Tenés el Access Token de Meta Graph API de esta cuenta?</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={hasMetaToken}
                    onChange={e => setHasMetaToken(e.target.checked)}
                    className="w-4 h-4 accent-pink-600 rounded cursor-pointer"
                  />
                </div>

                {hasMetaToken ? (
                  <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        User Access Token de Meta
                      </label>
                      <input
                        type="password"
                        value={metaAccessToken}
                        onChange={e => setMetaAccessToken(e.target.value)}
                        placeholder="EAA..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Instagram Business Account ID
                      </label>
                      <input
                        type="text"
                        value={instagramAccountId}
                        onChange={e => setInstagramAccountId(e.target.value)}
                        placeholder="178414..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Si no tenés el token a mano ahora, podés continuar solo con el usuario <strong className="text-pink-300">@{instagramHandle.replace('@', '') || 'local'}</strong> y vincular la API más adelante desde el panel de Conexiones.
                  </p>
                )}
              </div>

              {/* Recordatorio de IA Centralizada */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-300/90">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>IA Incluida por EventPix:</strong> Los motores de Claude Sonnet y ChatGPT son provistos por la plataforma. Este cliente no necesita pagar ni crear cuentas en OpenAI.
                </span>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-lg shadow-pink-600/20 flex items-center gap-2 transition-all"
                >
                  Continuar a WhatsApp <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: WHATSAPP Y CONFIRMACIÓN */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Número de WhatsApp Comercial del Local *
                </label>
                <div className="relative">
                  <PhoneCall className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400" />
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+54 9 362 405-5257"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    autoFocus
                  />
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Formato internacional con código de país (ej. +54 9 para Argentina).
                </span>
              </div>

              {/* Resumen Final de la Cuenta */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
                  Resumen de la Nueva Cuenta
                </span>
                
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Comercio:</span>
                    <strong className="text-slate-100">{name}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Rubro:</span>
                    <span className="text-slate-300">{niche}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Instagram:</span>
                    <span className="text-pink-400 font-mono font-bold">{instagramHandle}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">WhatsApp:</span>
                    <span className="text-emerald-400 font-mono">{phone}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {loading ? 'Creando cuenta...' : 'Activar Comercio y Comenzar'}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
