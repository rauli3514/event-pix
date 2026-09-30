// ================================================================
// FacebookMessengerService.ts
// Conector Oficial con la API de Messenger de Facebook (mensajes de
// la Página) — mismo patrón que WhatsAppCloudService.
// EventPix Intelligence — SaaS Platform
// ================================================================

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export interface FacebookTestResult {
  success: boolean;
  pageId?: string;
  pageName?: string;
  error?: string;
}

export class FacebookMessengerService {
  /**
   * Prueba la validez del token y el ID de la Página de Facebook
   */
  static async testConnection(accessToken: string, pageId: string): Promise<FacebookTestResult> {
    if (!accessToken.trim() || !pageId.trim()) {
      return {
        success: false,
        error: 'Access Token y Page ID son requeridos.'
      };
    }

    try {
      const url = `${GRAPH_BASE}/${pageId.trim()}?fields=id,name`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken.trim()}` }
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || `Error de Meta API (${res.status})`
        };
      }

      return { success: true, pageId: data.id, pageName: data.name };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Fallo de red al conectar con la Graph API de Facebook.'
      };
    }
  }
}
