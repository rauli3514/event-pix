// ================================================================
// UnifiedConnectionsModal.tsx
// Centro Unificado de Conexiones Reales (OpenAI, Claude, WhatsApp, Shop de Plumas)
// EventPix Intelligence — SaaS Platform Multi-Tenant
// ================================================================

import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle2, Loader2, Sparkles,
  MessageSquare, ShoppingBag, Eye, EyeOff, Check,
  Bot, RefreshCw, Key, ShieldCheck, Zap, AlertTriangle, Instagram
} from 'lucide-react';
import { UnifiedConnectionsState } from '../../types/connections';
import { ConnectionStorageService } from '../../services/intelligence/ConnectionStorageService';
import { AIProviderService } from '../../services/intelligence/AIProviderService';
import { WhatsAppCloudService } from '../../services/meta/WhatsAppCloudService';
import { InstagramMessagingService } from '../../services/meta/InstagramMessagingService';
import { ShopDePlumasSyncService } from '../../services/intelligence/ShopDePlumasSyncService';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

interface UnifiedConnectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId?: string;
  onConnectionsUpdated?: (state: UnifiedConnectionsState) => void;
  // La IA de OpenAI/Claude/Gemini la provee la plataforma: un cliente normal
  // no debe ver ni tocar esas claves, solo el super_admin.
  isSuperAdmin?: boolean;
  // El catálogo de Shop de Plumas solo aplica al negocio que lo usa.
  catalogProvider?: 'shop_de_plumas' | 'none';
}

export const UnifiedConnectionsModal: React.FC<UnifiedConnectionsModalProps> = ({
  isOpen,
  onClose,
  businessId = 'biz_default',
  onConnectionsUpdated,
  isSuperAdmin = false,
  catalogProvider = 'none'
}) => {
  const [connections, setConnections] = useState<UnifiedConnectionsState>(() => {
    return ConnectionStorageService.loadConnections(businessId);
  });

  const [activeTab, setActiveTab] = useState<'openai' | 'claude' | 'gemini' | 'whatsapp' | 'instagram' | 'shop_plumas'>(
    isSuperAdmin ? 'openai' : 'whatsapp'
  );

  // Recargar conexiones frescas cada vez que se abre el modal o cambia el comercio,
  // y asegurar que un cliente normal no quede parado en una pestaña que no puede ver.
  useEffect(() => {
    if (isOpen) {
      const latest = ConnectionStorageService.loadConnections(businessId);
      setConnections(latest);

      const aiOnlyTab = activeTab === 'openai' || activeTab === 'claude' || activeTab === 'gemini';
      const catalogNotAllowed = activeTab === 'shop_plumas' && catalogProvider !== 'shop_de_plumas';
      if ((!isSuperAdmin && aiOnlyTab) || catalogNotAllowed) {
        setActiveTab('whatsapp');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, businessId, isSuperAdmin, catalogProvider]);
  const [showKeyOpenAI, setShowKeyOpenAI] = useState(false);
  const [showKeyClaude, setShowKeyClaude] = useState(false);
  const [showKeyGemini, setShowKeyGemini] = useState(false);
  const [showTokenWhatsApp, setShowTokenWhatsApp] = useState(false);
  const [showTokenInstagram, setShowTokenInstagram] = useState(false);

  // Estados de carga de tests
  const [isTestingOpenAI, setIsTestingOpenAI] = useState(false);
  const [isTestingClaude, setIsTestingClaude] = useState(false);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isTestingInstagram, setIsTestingInstagram] = useState(false);
  const [isSyncingPlumas, setIsSyncingPlumas] = useState(false);

  if (!isOpen) return null;

  // 1. Probar OpenAI
  const handleTestOpenAI = async () => {
    setIsTestingOpenAI(true);
    const result = await AIProviderService.testOpenAI(connections.openai.apiKey);
    setIsTestingOpenAI(false);

    if (result.success) {
      const updated: UnifiedConnectionsState = {
        ...connections,
        openai: {
          ...connections.openai,
          status: 'connected',
          isActive: true,
          errorMessage: undefined,
          lastTestedAt: new Date().toISOString()
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      toast.success('¡Conexión exitosa con OpenAI (ChatGPT)!');
    } else {
      const isQuotaError = result.hasCredits === false || result.error?.toLowerCase().includes('saldo') || result.error?.toLowerCase().includes('quota');
      const updated: UnifiedConnectionsState = {
        ...connections,
        openai: {
          ...connections.openai,
          status: isQuotaError ? 'connected' : 'error',
          isActive: true,
          errorMessage: result.error
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      if (isQuotaError) {
        toast.warning('OpenAI: Clave válida pero sin saldo ($0.00). Podés alternar a Gemini o Claude.');
      } else {
        toast.error(`Fallo OpenAI: ${result.error}`);
      }
    }
  };

  // 2. Probar Claude
  const handleTestClaude = async () => {
    setIsTestingClaude(true);
    const result = await AIProviderService.testClaude(
      connections.claude.apiKey,
      connections.claude.model || 'claude-3-5-sonnet-20241022',
      connections.claude.workspaceId
    );
    setIsTestingClaude(false);

    if (result.success) {
      const updated: UnifiedConnectionsState = {
        ...connections,
        claude: {
          ...connections.claude,
          workspaceId: result.workspaceId || connections.claude.workspaceId,
          model: (result.model as any) || connections.claude.model,
          status: 'connected',
          isActive: true,
          errorMessage: undefined,
          lastTestedAt: new Date().toISOString()
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      toast.success('¡Conexión exitosa con Anthropic (Claude)!');
    } else {
      const updated: UnifiedConnectionsState = {
        ...connections,
        claude: {
          ...connections.claude,
          status: 'error',
          errorMessage: result.error
        }
      };
      setConnections(updated);
      toast.error(`Fallo Claude: ${result.error}`);
    }
  };

  // 3. Probar Google Gemini
  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    const result = await AIProviderService.testGemini(
      connections.gemini?.apiKey || '',
      connections.gemini?.model || 'gemini-1.5-flash'
    );
    setIsTestingGemini(false);

    if (result.success) {
      const updated: UnifiedConnectionsState = {
        ...connections,
        gemini: {
          ...(connections.gemini || { model: 'gemini-1.5-flash' }),
          apiKey: connections.gemini?.apiKey || '',
          status: 'connected',
          isActive: true,
          errorMessage: undefined,
          lastTestedAt: new Date().toISOString()
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      toast.success('¡Conexión exitosa con Google Gemini!');
    } else {
      const updated: UnifiedConnectionsState = {
        ...connections,
        gemini: {
          ...(connections.gemini || { model: 'gemini-1.5-flash', apiKey: '' }),
          status: 'error',
          errorMessage: result.error
        }
      };
      setConnections(updated);
      toast.error(`Fallo Gemini: ${result.error}`);
    }
  };

  // 4. Probar WhatsApp Cloud API
  const handleTestWhatsApp = async () => {
    setIsTestingWhatsApp(true);
    const result = await WhatsAppCloudService.testConnection(
      connections.whatsapp.accessToken,
      connections.whatsapp.phoneNumberId
    );
    setIsTestingWhatsApp(false);

    if (result.success) {
      const updated: UnifiedConnectionsState = {
        ...connections,
        whatsapp: {
          ...connections.whatsapp,
          status: 'connected',
          isActive: true,
          displayPhoneNumber: result.displayPhoneNumber,
          verifiedName: result.verifiedName,
          errorMessage: undefined,
          lastTestedAt: new Date().toISOString()
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      toast.success(`¡WhatsApp Verificado! Tel: ${result.displayPhoneNumber || 'OK'}`);

      // El bot corre en el servidor: necesita poder leer este número/token
      // desde la base de datos, no alcanza con guardarlo en este navegador.
      try {
        await supabase
          .from('intelligence_businesses')
          .update({
            whatsapp_phone_number_id: connections.whatsapp.phoneNumberId.trim(),
            whatsapp_access_token: connections.whatsapp.accessToken.trim()
          })
          .eq('id', businessId);
      } catch (err) {
        console.warn('No se pudo sincronizar WhatsApp con Supabase:', err);
      }
    } else {
      const updated: UnifiedConnectionsState = {
        ...connections,
        whatsapp: {
          ...connections.whatsapp,
          status: 'error',
          errorMessage: result.error
        }
      };
      setConnections(updated);
      toast.error(`Fallo WhatsApp: ${result.error}`);
    }
  };

  // 4b. Probar Instagram Messaging API
  const handleTestInstagram = async () => {
    setIsTestingInstagram(true);
    const result = await InstagramMessagingService.testConnection(
      connections.instagram.accessToken,
      connections.instagram.instagramAccountId
    );
    setIsTestingInstagram(false);

    if (result.success) {
      const updated: UnifiedConnectionsState = {
        ...connections,
        instagram: {
          ...connections.instagram,
          status: 'connected',
          isActive: true,
          username: result.username,
          errorMessage: undefined,
          lastTestedAt: new Date().toISOString()
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      toast.success(`¡Instagram Verificado! @${result.username || 'OK'}`);

      // El bot corre en el servidor: necesita poder leer esta cuenta/token
      // desde la base de datos, no alcanza con guardarlo en este navegador.
      try {
        await supabase
          .from('intelligence_businesses')
          .update({
            instagram_account_id: connections.instagram.instagramAccountId.trim(),
            instagram_access_token: connections.instagram.accessToken.trim()
          })
          .eq('id', businessId);
      } catch (err) {
        console.warn('No se pudo sincronizar Instagram con Supabase:', err);
      }
    } else {
      const updated: UnifiedConnectionsState = {
        ...connections,
        instagram: {
          ...connections.instagram,
          status: 'error',
          errorMessage: result.error
        }
      };
      setConnections(updated);
      toast.error(`Fallo Instagram: ${result.error}`);
    }
  };

  // 4. Sincronizar Catálogo Shop de Plumas
  const handleSyncShopDePlumas = async () => {
    setIsSyncingPlumas(true);
    const result = await ShopDePlumasSyncService.syncCatalog(
      connections.shopDePlumas.supabaseUrl,
      connections.shopDePlumas.supabaseAnonKey
    );
    setIsSyncingPlumas(false);

    if (result.success) {
      const updated: UnifiedConnectionsState = {
        ...connections,
        shopDePlumas: {
          ...connections.shopDePlumas,
          status: 'connected',
          isActive: true,
          syncedProductsCount: result.products.length,
          syncedProducts: result.products,
          exchangeRateUsdToArs: result.exchangeRate,
          lastSyncedAt: new Date().toISOString(),
          errorMessage: undefined
        }
      };
      setConnections(updated);
      ConnectionStorageService.saveConnections(businessId, updated);
      onConnectionsUpdated?.(updated);
      toast.success(`¡Sincronización exitosa! ${result.products.length} productos en stock cargados desde Shop de Plumas.`);
    } else {
      const updated: UnifiedConnectionsState = {
        ...connections,
        shopDePlumas: {
          ...connections.shopDePlumas,
          status: 'error',
          errorMessage: result.error
        }
      };
      setConnections(updated);
      toast.error(`Error al sincronizar: ${result.error}`);
    }
  };

  const handleSaveAll = () => {
    const openaiKey = (connections.openai?.apiKey || '').trim();
    const claudeKey = (connections.claude?.apiKey || '').trim();
    const geminiKey = (connections.gemini?.apiKey || '').trim();

    const hasOpenaiKey = openaiKey.length > 5;
    const hasClaudeKey = claudeKey.length > 5;
    const hasGeminiKey = geminiKey.length > 5;

    let preferred = connections.preferredAIProvider;
    if (preferred === 'openai' && !hasOpenaiKey) {
      preferred = hasGeminiKey ? 'gemini' : (hasClaudeKey ? 'claude' : 'openai');
    } else if (preferred === 'claude' && !hasClaudeKey) {
      preferred = hasGeminiKey ? 'gemini' : (hasOpenaiKey ? 'openai' : 'claude');
    } else if (preferred === 'gemini' && !hasGeminiKey) {
      preferred = hasClaudeKey ? 'claude' : (hasOpenaiKey ? 'openai' : 'gemini');
    }

    const updated: UnifiedConnectionsState = {
      ...connections,
      preferredAIProvider: preferred,
      openai: {
        ...connections.openai,
        apiKey: openaiKey,
        isActive: hasOpenaiKey,
        status: hasOpenaiKey ? 'connected' : 'disconnected'
      },
      claude: {
        ...connections.claude,
        apiKey: claudeKey,
        isActive: hasClaudeKey,
        status: hasClaudeKey ? 'connected' : 'disconnected'
      },
      gemini: {
        ...(connections.gemini || { model: 'gemini-1.5-flash' }),
        apiKey: geminiKey,
        isActive: hasGeminiKey,
        status: hasGeminiKey ? 'connected' : 'disconnected'
      }
    };
    ConnectionStorageService.saveConnections(businessId, updated);
    setConnections(updated);
    onConnectionsUpdated?.(updated);
    toast.success('¡Configuración de conexiones guardada y activa!');
    onClose();
  };

  const activeCount = ConnectionStorageService.countActiveConnections(connections);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-600/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">
                  Centro de Conexiones & APIs Reales
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-mono ${
                  activeCount > 0 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {activeCount} / 6 Conectadas
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Conectá tus cuentas para salir del modo demo y operar con datos e IA 100% reales
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

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 p-1.5 gap-1 text-xs overflow-x-auto shrink-0">
          {isSuperAdmin && (
            <>
              <button
                onClick={() => setActiveTab('openai')}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'openai'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span>ChatGPT (OpenAI)</span>
                {(connections.openai.status === 'connected' || Boolean(connections.openai.apiKey && connections.openai.apiKey.length > 5)) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('claude')}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'claude'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Claude (Anthropic)</span>
                {(connections.claude.status === 'connected' || Boolean(connections.claude.apiKey && connections.claude.apiKey.length > 5)) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('gemini')}
                className={`px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${
                  activeTab === 'gemini'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-sky-400" />
                <span>Google Gemini</span>
                {(connections.gemini?.status === 'connected' || Boolean(connections.gemini?.apiKey && connections.gemini.apiKey.length > 5)) && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                )}
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${
              activeTab === 'whatsapp'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>WhatsApp Cloud API</span>
            {connections.whatsapp.status === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('instagram')}
            className={`px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${
              activeTab === 'instagram'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Instagram className="w-3.5 h-3.5 text-pink-400" />
            <span>Instagram DM</span>
            {connections.instagram.status === 'connected' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
            )}
          </button>

          {catalogProvider === 'shop_de_plumas' && (
            <button
              onClick={() => setActiveTab('shop_plumas')}
              className={`px-3.5 py-2 rounded-xl flex items-center gap-2 font-semibold transition-all whitespace-nowrap ${
                activeTab === 'shop_plumas'
                  ? 'bg-violet-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5 text-pink-400" />
              <span>Shop de Plumas (Catálogo)</span>
              {connections.shopDePlumas.status === 'connected' && (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              )}
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar text-xs">
          
          {/* TAB 1: OPENAI */}
          {isSuperAdmin && activeTab === 'openai' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    Estado de ChatGPT (OpenAI)
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Utilizado para generar guiones virales de Reels y respuestas inteligentes en el chat
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  connections.openai.errorMessage?.toLowerCase().includes('saldo') || connections.openai.errorMessage?.toLowerCase().includes('quota')
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : (connections.openai.status === 'connected' || (connections.openai.apiKey && connections.openai.apiKey.length > 5))
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {connections.openai.errorMessage?.toLowerCase().includes('saldo') || connections.openai.errorMessage?.toLowerCase().includes('quota') ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sin Saldo ($0.00)</span>
                    </>
                  ) : (connections.openai.status === 'connected' || (connections.openai.apiKey && connections.openai.apiKey.length > 5)) ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Conectado</span>
                    </>
                  ) : (
                    <span>Desconectado</span>
                  )}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    OpenAI API Key:
                  </label>
                  <div className="relative">
                    <input
                      type={showKeyOpenAI ? 'text' : 'password'}
                      value={connections.openai.apiKey}
                      onChange={e => {
                        const val = e.target.value;
                        setConnections({
                          ...connections,
                          openai: {
                            ...connections.openai,
                            apiKey: val,
                            isActive: Boolean(val.trim()),
                            status: val.trim().length > 5 ? 'connected' : 'disconnected'
                          }
                        });
                      }}
                      placeholder="sk-proj-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 font-mono focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyOpenAI(!showKeyOpenAI)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showKeyOpenAI ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Tu clave se almacena de forma segura en tu navegador y nunca sale de tu comercio.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Modelo Recomendado:
                    </label>
                    <select
                      value={connections.openai.model}
                      onChange={e => setConnections({
                        ...connections,
                        openai: { ...connections.openai, model: e.target.value as any }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      <option value="gpt-4o-mini">GPT-4o mini (Ultra rápido & Económico)</option>
                      <option value="gpt-4o">GPT-4o (Máxima capacidad creativa)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestOpenAI}
                      disabled={isTestingOpenAI || !connections.openai.apiKey.trim()}
                      className="w-full py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isTestingOpenAI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      Probar y Validar Clave
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CLAUDE */}
          {isSuperAdmin && activeTab === 'claude' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    Estado de Anthropic (Claude)
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Utilizado para análisis estratégico profundo y detección de hooks de alta retención
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  connections.claude.status === 'connected' || (connections.claude.apiKey && connections.claude.apiKey.length > 5)
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {connections.claude.status === 'connected' || (connections.claude.apiKey && connections.claude.apiKey.length > 5) ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {connections.claude.status === 'connected' || (connections.claude.apiKey && connections.claude.apiKey.length > 5) ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Anthropic Claude API Key:
                  </label>
                  <div className="relative">
                    <input
                      type={showKeyClaude ? 'text' : 'password'}
                      value={connections.claude.apiKey}
                      onChange={e => {
                        const val = e.target.value;
                        setConnections({
                          ...connections,
                          claude: {
                            ...connections.claude,
                            apiKey: val,
                            isActive: Boolean(val.trim()),
                            status: val.trim().length > 5 ? 'connected' : 'disconnected'
                          }
                        });
                      }}
                      placeholder="sk-ant-api03-..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 font-mono focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyClaude(!showKeyClaude)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showKeyClaude ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Tu clave se almacena de forma segura en tu navegador y nunca sale de tu comercio.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                    <span>Workspace ID (Opcional):</span>
                    <span className="text-[10px] text-slate-500 font-normal">Requerido solo si tu clave no está asignada a un espacio</span>
                  </label>
                  <input
                    type="text"
                    value={connections.claude.workspaceId || ''}
                    onChange={e => setConnections({
                      ...connections,
                      claude: { ...connections.claude, workspaceId: e.target.value }
                    })}
                    placeholder="default (o dejalo vacío para autodetección)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-violet-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Modelo Recomendado:
                    </label>
                    <select
                      value={connections.claude.model}
                      onChange={e => setConnections({
                        ...connections,
                        claude: { ...connections.claude, model: e.target.value as any }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      <option value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Nuevo & Recomendado)</option>
                      <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Latest)</option>
                      <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (v2)</option>
                      <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Rápido & Económico)</option>
                      <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                      <option value="claude-3-haiku-20240307">Claude 3 Haiku (Legacy)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestClaude}
                      disabled={isTestingClaude || !connections.claude.apiKey.trim()}
                      className="w-full py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isTestingClaude ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      Probar y Validar Clave
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: GEMINI */}
          {isSuperAdmin && activeTab === 'gemini' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    Estado de Google Gemini
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Motor ultra veloz de Google AI para redacción y adaptación fluida de guiones de Instagram
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  connections.gemini?.status === 'connected' || Boolean(connections.gemini?.apiKey && connections.gemini.apiKey.length > 5)
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {connections.gemini?.status === 'connected' || Boolean(connections.gemini?.apiKey && connections.gemini.apiKey.length > 5) ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {connections.gemini?.status === 'connected' || Boolean(connections.gemini?.apiKey && connections.gemini.apiKey.length > 5) ? 'Conectado' : 'Desconectado'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-300 font-semibold">
                      Google Gemini API Key:
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                    >
                      Obtener clave gratis en Google AI Studio ↗
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showKeyGemini ? 'text' : 'password'}
                      value={connections.gemini?.apiKey || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setConnections({
                          ...connections,
                          gemini: {
                            ...(connections.gemini || { model: 'gemini-1.5-flash' }),
                            apiKey: val,
                            isActive: Boolean(val.trim()),
                            status: val.trim().length > 5 ? 'connected' : 'disconnected'
                          }
                        });
                      }}
                      placeholder="AIzaSy..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 font-mono focus:outline-none focus:border-violet-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeyGemini(!showKeyGemini)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showKeyGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Tu clave se almacena de forma segura en tu navegador y nunca sale de tu comercio.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Modelo Recomendado:
                    </label>
                    <select
                      value={connections.gemini?.model || 'gemini-1.5-flash'}
                      onChange={e => setConnections({
                        ...connections,
                        gemini: {
                          ...(connections.gemini || { apiKey: '', isActive: true, status: 'disconnected' }),
                          model: e.target.value
                        }
                      })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-violet-500"
                    >
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash (Recomendado: ultra rápido & alta retención)</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro (Máximo razonamiento & redacción profunda)</option>
                      <option value="gemini-2.0-flash">Gemini 2.0 Flash (Nueva generación ultra veloz)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestGemini}
                      disabled={isTestingGemini || !connections.gemini?.apiKey?.trim()}
                      className="w-full py-2 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isTestingGemini ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                      Probar y Validar Clave
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: WHATSAPP */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    Meta Cloud API (WhatsApp Oficial)
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Envío directo de respuestas y cotizaciones a tus clientes sin riesgo de baneo
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  connections.whatsapp.status === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {connections.whatsapp.status === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {connections.whatsapp.status === 'connected' ? 'Verificado' : 'Sin Configurar'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Permanent Access Token de Meta:
                  </label>
                  <div className="relative">
                    <input
                      type={showTokenWhatsApp ? 'text' : 'password'}
                      value={connections.whatsapp.accessToken}
                      onChange={e => setConnections({
                        ...connections,
                        whatsapp: { ...connections.whatsapp, accessToken: e.target.value }
                      })}
                      placeholder="EAA..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokenWhatsApp(!showTokenWhatsApp)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showTokenWhatsApp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Phone Number ID:
                    </label>
                    <input
                      type="text"
                      value={connections.whatsapp.phoneNumberId}
                      onChange={e => setConnections({
                        ...connections,
                        whatsapp: { ...connections.whatsapp, phoneNumberId: e.target.value }
                      })}
                      placeholder="Ej: 1092837465920"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestWhatsApp}
                      disabled={isTestingWhatsApp || !connections.whatsapp.accessToken.trim() || !connections.whatsapp.phoneNumberId.trim()}
                      className="w-full py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isTestingWhatsApp ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Verificar Número en Meta
                    </button>
                  </div>
                </div>

                {connections.whatsapp.displayPhoneNumber && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Número activo en Meta: <strong>{connections.whatsapp.displayPhoneNumber}</strong> ({connections.whatsapp.verifiedName || 'Verificado'})</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: INSTAGRAM DM */}
          {activeTab === 'instagram' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    Instagram API (Mensajes Directos)
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Respuestas automáticas con IA a los DM de Instagram, grounded en tu catálogo real
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  connections.instagram.status === 'connected'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {connections.instagram.status === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {connections.instagram.status === 'connected' ? 'Verificado' : 'Sin Configurar'}
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Access Token de Instagram:
                  </label>
                  <div className="relative">
                    <input
                      type={showTokenInstagram ? 'text' : 'password'}
                      value={connections.instagram.accessToken}
                      onChange={e => setConnections({
                        ...connections,
                        instagram: { ...connections.instagram, accessToken: e.target.value }
                      })}
                      placeholder="IGAA..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-slate-200 font-mono focus:outline-none focus:border-pink-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokenInstagram(!showTokenInstagram)}
                      className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    >
                      {showTokenInstagram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Instagram Account ID:
                    </label>
                    <input
                      type="text"
                      value={connections.instagram.instagramAccountId}
                      onChange={e => setConnections({
                        ...connections,
                        instagram: { ...connections.instagram, instagramAccountId: e.target.value }
                      })}
                      placeholder="Ej: 178956234..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleTestInstagram}
                      disabled={isTestingInstagram || !connections.instagram.accessToken.trim() || !connections.instagram.instagramAccountId.trim()}
                      className="w-full py-2 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      {isTestingInstagram ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      Verificar Cuenta en Meta
                    </button>
                  </div>
                </div>

                {connections.instagram.username && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Cuenta activa en Meta: <strong>@{connections.instagram.username}</strong></span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SHOP DE PLUMAS */}
          {catalogProvider === 'shop_de_plumas' && activeTab === 'shop_plumas' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl">
                <div>
                  <h4 className="font-bold text-slate-200 flex items-center gap-2">
                    Base de Datos Shop de Plumas (Ventas & Stock)
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    Sincronización en tiempo real de precios y productos sin doble carga
                  </p>
                </div>
                <span className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 ${
                  connections.shopDePlumas.status === 'connected'
                    ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {connections.shopDePlumas.status === 'connected' ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                  {connections.shopDePlumas.status === 'connected' ? `${connections.shopDePlumas.syncedProductsCount} Productos` : 'Sin Sincronizar'}
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Instancia Supabase Vinculada:</span>
                  <div className="text-xs font-mono text-slate-300 truncate">
                    {connections.shopDePlumas.supabaseUrl}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSyncShopDePlumas}
                  disabled={isSyncingPlumas}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 transition-all"
                >
                  {isSyncingPlumas ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sincronizar Catálogo y Precios en Vivo Ahora
                </button>

                {connections.shopDePlumas.syncedProducts.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Vista previa de productos detectados en vivo ({connections.shopDePlumas.syncedProducts.length}):
                    </span>
                    <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                      {connections.shopDePlumas.syncedProducts.slice(0, 8).map(prod => (
                        <div key={prod.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-200 block">{prod.name}</span>
                            <span className="text-[10px] text-slate-400">
                              Cat: {prod.category} | Stock: {prod.stock} u.
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-400">
                            ${prod.price.toLocaleString('es-AR')} {prod.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/80 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Aislamiento estricto multi-tenant: las claves pertenecen solo a este comercio.</span>
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-violet-600/20 transition-all flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Guardar Conexiones
          </button>
        </div>

      </div>
    </div>
  );
};
