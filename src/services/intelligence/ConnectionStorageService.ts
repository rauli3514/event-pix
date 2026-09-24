// ================================================================
// ConnectionStorageService.ts
// Gestión Segura de Credenciales y Conexiones Multi-Tenant
// Con Herencia Maestra Permanente de Claves de IA (OpenAI, Claude, Gemini)
// EventPix Intelligence — SaaS Platform
// ================================================================

import { UnifiedConnectionsState } from '../../types/connections';

const STORAGE_PREFIX = 'eventpix_connections_';
const GLOBAL_KEY = 'eventpix_connections_global';
const LEGACY_KEY = 'eventpix_connections';

const MASTER_KEYS = {
  OPENAI: 'eventpix_master_openai_key',
  CLAUDE: 'eventpix_master_claude_key',
  GEMINI: 'eventpix_master_gemini_key',
  PREFERRED_AI: 'eventpix_master_preferred_ai'
};

const DEFAULT_SHOP_DE_PLUMAS_URL = 'https://bsicoqackurqvoyzrcjb.supabase.co';
const DEFAULT_SHOP_DE_PLUMAS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJzaWNvcWFja3VycXZveXpyY2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyNTM4MjEsImV4cCI6MjA4MzgyOTgyMX0.dU6gj8dOR3qpDm4fALngj8gS_4EFikjXAwM2jiuRCbI';

export class ConnectionStorageService {
  private static getKey(businessId: string): string {
    return `${STORAGE_PREFIX}${businessId}`;
  }

  /**
   * Busca en todos los registros de localStorage si existe alguna clave de IA guardada previamente.
   * Evita desconexiones accidentales al cambiar de cliente, recargar o registrar un nuevo comercio.
   */
  private static findKeyAcrossAllStorage(provider: 'openai' | 'claude' | 'gemini'): string {
    // 1. Clave maestra directa
    const masterKeyName = provider === 'openai' 
      ? MASTER_KEYS.OPENAI 
      : provider === 'claude' 
      ? MASTER_KEYS.CLAUDE 
      : MASTER_KEYS.GEMINI;

    const direct = localStorage.getItem(masterKeyName);
    if (direct && direct.trim().length > 5) return direct.trim();

    // 2. Registro global
    try {
      const globalRaw = localStorage.getItem(GLOBAL_KEY) || localStorage.getItem(LEGACY_KEY);
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        const key = parsed[provider]?.apiKey?.trim();
        if (key && key.length > 5) return key;
      }
    } catch {}

    // 3. Barrido de todas las claves de comercios en localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          const val = localStorage.getItem(k);
          if (val) {
            const parsed = JSON.parse(val);
            const key = parsed[provider]?.apiKey?.trim();
            if (key && key.length > 5) return key;
          }
        }
      }
    } catch {}

    return '';
  }

  /**
   * Carga la configuración de conexiones del comercio asegurando que las claves de IA
   * nunca se pierdan al alternar de negocio o recargar el navegador.
   */
  static loadConnections(businessId = 'biz_001'): UnifiedConnectionsState {
    // Buscar claves guardadas en almacenamiento permanente
    const discoveredOpenAiKey = this.findKeyAcrossAllStorage('openai') || (import.meta as any).env?.VITE_OPENAI_API_KEY || '';
    const discoveredClaudeKey = this.findKeyAcrossAllStorage('claude') || (import.meta as any).env?.VITE_ANTHROPIC_API_KEY || '';
    const discoveredGeminiKey = this.findKeyAcrossAllStorage('gemini') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';

    const hasAnyOpenAi = Boolean(discoveredOpenAiKey && discoveredOpenAiKey.length > 5);
    const hasAnyClaude = Boolean(discoveredClaudeKey && discoveredClaudeKey.length > 5);
    const hasAnyGemini = Boolean(discoveredGeminiKey && discoveredGeminiKey.length > 5);

    const savedPreferredAI = (localStorage.getItem(MASTER_KEYS.PREFERRED_AI) as any) ||
      (hasAnyClaude ? 'claude' : hasAnyGemini ? 'gemini' : hasAnyOpenAi ? 'openai' : 'claude');

    const defaultState: UnifiedConnectionsState = {
      business_id: businessId,
      preferredAIProvider: savedPreferredAI,
      openai: {
        apiKey: discoveredOpenAiKey,
        model: 'gpt-4o-mini',
        isActive: hasAnyOpenAi,
        status: hasAnyOpenAi ? 'connected' : 'disconnected'
      },
      claude: {
        apiKey: discoveredClaudeKey,
        model: 'claude-3-5-sonnet-20241022',
        workspaceId: undefined,
        isActive: hasAnyClaude,
        status: hasAnyClaude ? 'connected' : 'disconnected'
      },
      gemini: {
        apiKey: discoveredGeminiKey,
        model: 'gemini-1.5-flash',
        isActive: hasAnyGemini,
        status: hasAnyGemini ? 'connected' : 'disconnected'
      },
      whatsapp: {
        accessToken: (import.meta as any).env?.VITE_WHATSAPP_ACCESS_TOKEN || '',
        phoneNumberId: (import.meta as any).env?.VITE_WHATSAPP_PHONE_ID || '',
        wabaId: (import.meta as any).env?.VITE_WHATSAPP_WABA_ID || '',
        isActive: false,
        status: 'disconnected'
      },
      instagram: {
        accessToken: '',
        instagramAccountId: '',
        isActive: false,
        status: 'disconnected'
      },
      shopDePlumas: {
        supabaseUrl: DEFAULT_SHOP_DE_PLUMAS_URL,
        supabaseAnonKey: DEFAULT_SHOP_DE_PLUMAS_KEY,
        isActive: false,
        status: 'disconnected',
        syncedProductsCount: 0,
        syncedProducts: []
      }
    };

    try {
      let raw = localStorage.getItem(this.getKey(businessId));
      if (!raw && businessId !== 'biz_default') {
        raw = localStorage.getItem(this.getKey('biz_default'));
      }
      if (!raw) {
        raw = localStorage.getItem(GLOBAL_KEY) || localStorage.getItem(LEGACY_KEY);
      }

      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UnifiedConnectionsState>;
        
        // Las claves de IA se consolidan: si el negocio específico no tiene clave, hereda la maestra encontrada
        const finalOpenAiKey = parsed.openai?.apiKey?.trim() || discoveredOpenAiKey;
        const finalClaudeKey = parsed.claude?.apiKey?.trim() || discoveredClaudeKey;
        const finalGeminiKey = parsed.gemini?.apiKey?.trim() || discoveredGeminiKey;

        const activeOpenAi = Boolean(finalOpenAiKey && finalOpenAiKey.length > 5);
        const activeClaude = Boolean(finalClaudeKey && finalClaudeKey.length > 5);
        const activeGemini = Boolean(finalGeminiKey && finalGeminiKey.length > 5);

        let preferredAI = parsed.preferredAIProvider || savedPreferredAI;
        if (preferredAI === 'gemini' && !activeGemini) {
          preferredAI = activeClaude ? 'claude' : (activeOpenAi ? 'openai' : 'claude');
        } else if (preferredAI === 'claude' && !activeClaude) {
          preferredAI = activeGemini ? 'gemini' : (activeOpenAi ? 'openai' : 'gemini');
        } else if (preferredAI === 'openai' && !activeOpenAi) {
          preferredAI = activeGemini ? 'gemini' : (activeClaude ? 'claude' : 'gemini');
        }

        return {
          ...defaultState,
          ...parsed,
          business_id: businessId,
          preferredAIProvider: preferredAI,
          openai: {
            ...defaultState.openai,
            ...(parsed.openai || {}),
            apiKey: finalOpenAiKey,
            isActive: activeOpenAi,
            status: activeOpenAi ? 'connected' : 'disconnected'
          },
          claude: {
            ...defaultState.claude,
            ...(parsed.claude || {}),
            apiKey: finalClaudeKey,
            workspaceId: parsed.claude?.workspaceId || undefined,
            isActive: activeClaude,
            status: activeClaude ? 'connected' : 'disconnected'
          },
          gemini: {
            ...defaultState.gemini,
            ...(parsed.gemini || {}),
            apiKey: finalGeminiKey,
            isActive: activeGemini,
            status: activeGemini ? 'connected' : 'disconnected'
          },
          whatsapp: {
            ...defaultState.whatsapp,
            ...(parsed.whatsapp || {}),
            accessToken: parsed.whatsapp?.accessToken?.trim() || defaultState.whatsapp.accessToken,
            phoneNumberId: parsed.whatsapp?.phoneNumberId?.trim() || defaultState.whatsapp.phoneNumberId,
            wabaId: parsed.whatsapp?.wabaId?.trim() || defaultState.whatsapp.wabaId
          },
          instagram: {
            ...defaultState.instagram,
            ...(parsed.instagram || {}),
            accessToken: parsed.instagram?.accessToken?.trim() || defaultState.instagram.accessToken,
            instagramAccountId: parsed.instagram?.instagramAccountId?.trim() || defaultState.instagram.instagramAccountId
          },
          shopDePlumas: { ...defaultState.shopDePlumas, ...(parsed.shopDePlumas || {}) }
        };
      }
    } catch (e) {
      console.error('Error al cargar conexiones:', e);
    }

    return defaultState;
  }

  /**
   * Guarda la configuración de conexiones del comercio y sincroniza las claves de IA maestras
   */
  static saveConnections(businessId: string, state: UnifiedConnectionsState): void {
    try {
      // 1. Guardar para este comercio específico
      localStorage.setItem(this.getKey(businessId), JSON.stringify(state));

      // 2. Guardar en clave global y legacy para compatibilidad universal
      localStorage.setItem(GLOBAL_KEY, JSON.stringify(state));
      localStorage.setItem(LEGACY_KEY, JSON.stringify(state));

      // 3. Sincronizar claves maestras de IA si están presentes
      if (state.openai?.apiKey?.trim() && state.openai.apiKey.trim().length > 5) {
        localStorage.setItem(MASTER_KEYS.OPENAI, state.openai.apiKey.trim());
      }
      if (state.claude?.apiKey?.trim() && state.claude.apiKey.trim().length > 5) {
        localStorage.setItem(MASTER_KEYS.CLAUDE, state.claude.apiKey.trim());
      }
      if (state.gemini?.apiKey?.trim() && state.gemini.apiKey.trim().length > 5) {
        localStorage.setItem(MASTER_KEYS.GEMINI, state.gemini.apiKey.trim());
      }
      if (state.preferredAIProvider) {
        localStorage.setItem(MASTER_KEYS.PREFERRED_AI, state.preferredAIProvider);
      }
    } catch (e) {
      console.error('Error al guardar conexiones:', e);
    }
  }

  /**
   * Cuenta cuántas conexiones reales están activas actualmente
   */
  static countActiveConnections(state: UnifiedConnectionsState): number {
    let count = 0;
    if (state.openai?.apiKey?.trim() && (state.openai.isActive || state.openai.status === 'connected')) count++;
    if (state.claude?.apiKey?.trim() && (state.claude.isActive || state.claude.status === 'connected')) count++;
    if (state.gemini?.apiKey?.trim() && (state.gemini.isActive || state.gemini.status === 'connected')) count++;
    if (state.whatsapp?.accessToken?.trim() && state.whatsapp.isActive) count++;
    if (state.instagram?.accessToken?.trim() && state.instagram.isActive) count++;
    if (state.shopDePlumas?.isActive) count++;
    return count;
  }
}
