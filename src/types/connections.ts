// ================================================================
// connections.ts
// Tipos para Conexiones y APIs Reales (OpenAI, Claude, WhatsApp, Shop de Plumas)
// EventPix Intelligence — SaaS Platform Multi-Tenant
// ================================================================

export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing';

export interface OpenAIConnection {
  apiKey: string;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
  isActive: boolean;
  status: ConnectionStatus;
  errorMessage?: string;
  lastTestedAt?: string;
}

export interface ClaudeConnection {
  apiKey: string;
  model: string;
  workspaceId?: string;
  isActive: boolean;
  status: ConnectionStatus;
  errorMessage?: string;
  lastTestedAt?: string;
}

export interface WhatsAppConnection {
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
  displayPhoneNumber?: string;
  verifiedName?: string;
  isActive: boolean;
  status: ConnectionStatus;
  errorMessage?: string;
  lastTestedAt?: string;
}

export interface ShopProduct {
  id: string;
  code?: string;
  name: string;
  price: number;
  cost?: number;
  stock: number;
  category?: string;
  size?: string;
  color?: string;
  brand?: string;
  currency: string;
  image_url?: string;
  status: string;
}

export interface ShopDePlumasConnection {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isActive: boolean;
  status: ConnectionStatus;
  syncedProductsCount: number;
  syncedProducts: ShopProduct[];
  exchangeRateUsdToArs?: number;
  lastSyncedAt?: string;
  errorMessage?: string;
}

export interface GeminiConnection {
  apiKey: string;
  model: string; // 'gemini-1.5-flash' | 'gemini-1.5-pro' | 'gemini-2.0-flash'
  isActive: boolean;
  status: ConnectionStatus;
  errorMessage?: string;
  lastTestedAt?: string;
}

export interface UnifiedConnectionsState {
  business_id: string;
  preferredAIProvider: 'openai' | 'claude' | 'gemini' | 'local_engine' | 'auto';
  openai: OpenAIConnection;
  claude: ClaudeConnection;
  gemini: GeminiConnection;
  whatsapp: WhatsAppConnection;
  shopDePlumas: ShopDePlumasConnection;
}
