// ================================================================
// InstagramMessagingService.ts
// Conector Oficial con Instagram API (Instagram Login) para DMs
// EventPix Intelligence — SaaS Platform
// ================================================================

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
  // graph.instagram.com no responde el preflight CORS que exige un fetch
  // con header Authorization, así que llamarlo directo desde el navegador
  // siempre falla con "Failed to fetch" sin importar si el token es válido.
  // Pasa por un proxy serverless (server-to-server, sin problema de CORS).
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
      const res = await fetch('/api/instagram-connection-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: accessToken.trim(),
          instagramAccountId: instagramAccountId.trim()
        })
      });
      const data = await res.json();

      if (!data.success) {
        return { success: false, error: data.error || `Error de Meta API (${res.status})` };
      }

      return {
        success: true,
        instagramAccountId: data.instagramAccountId,
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
