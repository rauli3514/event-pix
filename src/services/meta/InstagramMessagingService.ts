// ================================================================
// InstagramMessagingService.ts
// Conector Oficial con Instagram API (Instagram Login) para DMs
// EventPix Intelligence — SaaS Platform
// ================================================================

const GRAPH_BASE = 'https://graph.instagram.com/v21.0';

export interface InstagramTestResult {
  success: boolean;
  instagramAccountId?: string;
  username?: string;
  error?: string;
}

export class InstagramMessagingService {
  /**
   * Prueba la validez del token y el ID de la cuenta de Instagram Business
   */
  static async testConnection(
    accessToken: string,
    instagramAccountId: string
  ): Promise<InstagramTestResult> {
    if (!accessToken.trim() || !instagramAccountId.trim()) {
      return {
        success: false,
        error: 'Access Token e Instagram Account ID son requeridos.'
      };
    }

    try {
      const url = `${GRAPH_BASE}/${instagramAccountId.trim()}?fields=id,username`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`
        }
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || `Error de Meta API (${res.status})`
        };
      }

      return {
        success: true,
        instagramAccountId: data.id,
        username: data.username
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Fallo de red al conectar con Instagram Graph API.'
      };
    }
  }
}
