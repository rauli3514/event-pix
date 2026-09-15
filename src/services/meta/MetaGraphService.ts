// ================================================================
// MetaGraphService.ts
// Servicio completo para Meta Graph API v19.0 / Instagram Graph API
// App: eventPix intelligence (ID: 2345235469580053)
// ================================================================

const META_GRAPH_BASE = 'https://graph.facebook.com/v19.0';
const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com';
const CREDENTIALS_KEY = 'eventpix_meta_credentials';

// ---- Types ----

export interface MetaCredentials {
  appId: string;
  appSecret: string;
  accessToken: string;
  instagramAccountId: string;
  facebookPageId?: string;
  facebookPageName?: string;
  pageAccessToken?: string;
  accountUsername?: string;
  accountName?: string;
  accountAvatar?: string;
  isBasicDisplay?: boolean;
}

export interface DiscoveredAccount {
  instagramAccountId: string;
  username: string;
  name: string;
  profilePictureUrl?: string;
  followersCount?: number;
  mediaCount?: number;
  facebookPageId?: string;
  facebookPageName?: string;
  pageAccessToken?: string;
  isBasicDisplay?: boolean;
}

export interface MetaDiscoveryResult {
  success: boolean;
  accounts: DiscoveredAccount[];
  userName?: string;
  userId?: string;
  error?: string;
  warning?: string;
}

export interface MetaMediaItem {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

/**
 * Insights de un medio. TODOS los campos numéricos son opcionales a propósito:
 * `undefined` significa "Meta no reportó esta métrica" y es distinto de `0`,
 * que significa "Meta reportó cero". Devolver 0 ante un fallo de la API
 * contaminaba las medianas de la cuenta con datos inventados.
 */
export interface MetaMediaInsights {
  media_id: string;
  impressions?: number;
  reach?: number;
  saved?: number;
  shares?: number;
  plays?: number;
  ig_reels_avg_watch_time?: number;
  ig_reels_video_view_total_time?: number;
  total_interactions?: number;
  /** true cuando no se pudieron obtener insights para este medio. */
  unavailable?: boolean;
  unavailable_reason?: string;
}

export interface MetaProfileInsights {
  id: string;
  name: string;
  biography: string;
  username: string;
  followers_count: number;
  media_count: number;
  profile_picture_url?: string;
  website?: string;
}

export interface MetaConnectionStatus {
  connected: boolean;
  profile?: MetaProfileInsights;
  error?: string;
}

// ---- Service ----

export class MetaGraphService {
  // ----- Credential Management -----

  private static getStorageKey(businessId?: string): string {
    if (!businessId || businessId === 'biz_default' || businessId === 'biz_001') {
      return CREDENTIALS_KEY;
    }
    return `${CREDENTIALS_KEY}_${businessId}`;
  }

  static saveCredentials(creds: MetaCredentials, businessId?: string): void {
    const key = this.getStorageKey(businessId);
    localStorage.setItem(key, JSON.stringify(creds));
    // Guardar también en la global si es default
    if (!businessId || businessId === 'biz_default') {
      localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(creds));
    }
  }

  static loadCredentials(businessId?: string): MetaCredentials | null {
    try {
      if (businessId && businessId !== 'biz_default' && businessId !== 'biz_001') {
        const tenantRaw = localStorage.getItem(`${CREDENTIALS_KEY}_${businessId}`);
        if (tenantRaw) return JSON.parse(tenantRaw) as MetaCredentials;
      }
      const raw = localStorage.getItem(CREDENTIALS_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as MetaCredentials;
    } catch {
      return null;
    }
  }

  static clearCredentials(businessId?: string): void {
    if (businessId) {
      localStorage.removeItem(`${CREDENTIALS_KEY}_${businessId}`);
    }
    localStorage.removeItem(CREDENTIALS_KEY);
  }

  static isConfigured(businessId?: string): boolean {
    const creds = MetaGraphService.loadCredentials(businessId);
    return !!(creds?.accessToken && creds?.instagramAccountId);
  }

  // ----- OAuth URL Builder -----

  static buildOAuthUrl(): string {
    const appId = import.meta.env.VITE_META_APP_ID || '2345235469580053';
    const redirectUri = encodeURIComponent(
      import.meta.env.VITE_META_REDIRECT_URI || `${window.location.origin}/auth/meta/callback`
    );
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'instagram_manage_comments',
      'instagram_manage_messages',
      'pages_read_engagement',
      'pages_show_list',
    ].join(',');

    return (
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${appId}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code` +
      `&state=eventpix_meta_auth`
    );
  }

  // ----- Auto-Discovery & Token Verification -----

  /**
   * Verifica el token recibido y auto-descubre qué cuentas de Instagram Business o Creador están vinculadas.
   * Si el token es inválido o no tiene permisos, devuelve el error exacto de Meta sin ocultarlo.
   */
  static async testAndDiscoverAccounts(token: string, manualAccountId?: string): Promise<MetaDiscoveryResult> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      return { success: false, accounts: [], error: 'El Access Token está vacío.' };
    }

    // 1. Probar vía Facebook Graph API (/me)
    let fbMeData: { id: string; name: string } | null = null;
    let fbError: any = null;

    try {
      const res = await fetch(`${META_GRAPH_BASE}/me?access_token=${trimmedToken}`);
      const data = await res.json();
      if (res.ok && !data.error) {
        fbMeData = data;
      } else {
        fbError = data.error;
      }
    } catch (e: any) {
      fbError = { message: e?.message || 'Fallo de red al conectar con Facebook Graph' };
    }

    // 2. Si Facebook Graph falló, probar si es un token directo de Instagram Basic Display
    if (!fbMeData) {
      try {
        const igRes = await fetch(
          `${INSTAGRAM_GRAPH_BASE}/me?fields=id,username,account_type,media_count&access_token=${trimmedToken}`
        );
        const igData = await igRes.json();
        if (igRes.ok && !igData.error && igData.id) {
          return {
            success: true,
            userName: igData.username,
            userId: igData.id,
            accounts: [
              {
                instagramAccountId: igData.id,
                username: igData.username,
                name: igData.username,
                mediaCount: igData.media_count || 0,
                isBasicDisplay: true,
                pageAccessToken: trimmedToken,
              },
            ],
          };
        }
      } catch (igErr) {
        console.warn('Instagram basic test failed:', igErr);
      }

      // Ambos fallaron: devolver el error exacto reportado por Meta
      const codeStr = fbError?.code ? ` [Código ${fbError.code}]` : '';
      const subcodeStr = fbError?.error_subcode ? ` (Subcódigo ${fbError.error_subcode})` : '';
      const msg = fbError?.message || 'Token de acceso no reconocido o expirado por Meta.';
      return {
        success: false,
        accounts: [],
        error: `Meta Error${codeStr}${subcodeStr}: ${msg}`,
      };
    }

    // 3. Token de Facebook válido. Buscar Páginas y cuentas vinculadas de Instagram Business
    const accounts: DiscoveredAccount[] = [];

    try {
      const pagesRes = await fetch(
        `${META_GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}&access_token=${trimmedToken}`
      );
      const pagesData = await pagesRes.json();

      if (pagesData.data && Array.isArray(pagesData.data)) {
        for (const page of pagesData.data) {
          if (page.instagram_business_account) {
            const ig = page.instagram_business_account;
            accounts.push({
              instagramAccountId: ig.id,
              username: ig.username || page.name,
              name: ig.name || page.name,
              profilePictureUrl: ig.profile_picture_url,
              followersCount: ig.followers_count || 0,
              mediaCount: ig.media_count || 0,
              facebookPageId: page.id,
              facebookPageName: page.name,
              pageAccessToken: page.access_token || trimmedToken,
              isBasicDisplay: false,
            });
          }
        }
      }
    } catch (pageErr) {
      console.warn('Error al listar páginas de Facebook:', pageErr);
    }

    // 4. Si el usuario ingresó un ID manual o no se detectaron páginas, probar ese ID directamente
    if (manualAccountId?.trim() && !accounts.some((a) => a.instagramAccountId === manualAccountId.trim())) {
      try {
        const directRes = await fetch(
          `${META_GRAPH_BASE}/${manualAccountId.trim()}?fields=id,name,username,profile_picture_url,followers_count,media_count&access_token=${trimmedToken}`
        );
        const directData = await directRes.json();
        if (directRes.ok && !directData.error && directData.id) {
          accounts.push({
            instagramAccountId: directData.id,
            username: directData.username || directData.name || 'instagram_account',
            name: directData.name || directData.username || 'Cuenta Instagram',
            profilePictureUrl: directData.profile_picture_url,
            followersCount: directData.followers_count || 0,
            mediaCount: directData.media_count || 0,
            pageAccessToken: trimmedToken,
            isBasicDisplay: false,
          });
        }
      } catch (dirErr) {
        console.warn('Verificación directa de cuenta falló:', dirErr);
      }
    }

    if (accounts.length === 0) {
      return {
        success: true,
        userName: fbMeData.name,
        userId: fbMeData.id,
        accounts: [],
        warning: `El token es válido para tu usuario de Meta ("${fbMeData.name}"), pero no se detectaron cuentas de Instagram Business vinculadas a tus Páginas de Facebook. Asegurate de tener una Página en Meta Business Suite vinculada a tu Instagram profesional o agregar los permisos "pages_show_list" e "instagram_basic".`,
      };
    }

    return {
      success: true,
      userName: fbMeData.name,
      userId: fbMeData.id,
      accounts,
    };
  }

  // ----- Internal fetch helper -----

  private static async apiFetch<T>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const creds = MetaGraphService.loadCredentials();
    if (!creds?.accessToken) {
      throw new Error('No hay credenciales de Meta configuradas. Por favor conectá tu cuenta primero.');
    }

    const tokenToUse = creds.pageAccessToken || creds.accessToken;
    const base = creds.isBasicDisplay ? INSTAGRAM_GRAPH_BASE : META_GRAPH_BASE;
    const url = new URL(`${base}${path}`);
    url.searchParams.set('access_token', tokenToUse);
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, val);
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (!res.ok || data.error) {
      const msg = data.error?.message || `Error de API (${res.status})`;
      throw new Error(`Meta Graph API: ${msg}`);
    }

    return data as T;
  }

  // ----- API Methods -----

  /** Verifica que el token sea válido llamando a /me */
  static async testConnection(): Promise<boolean> {
    try {
      const creds = MetaGraphService.loadCredentials();
      if (!creds?.accessToken) return false;
      const res = await MetaGraphService.testAndDiscoverAccounts(creds.accessToken, creds.instagramAccountId);
      return res.success;
    } catch {
      return false;
    }
  }

  /** Obtiene el perfil de la cuenta de Instagram Business */
  static async getProfile(): Promise<MetaProfileInsights> {
    const creds = MetaGraphService.loadCredentials();
    if (!creds) throw new Error('Credenciales no configuradas');

    if (creds.isBasicDisplay) {
      const data = await MetaGraphService.apiFetch<{
        id: string;
        username: string;
        account_type?: string;
        media_count?: number;
      }>('/me', {
        fields: 'id,username,account_type,media_count',
      });
      return {
        id: data.id,
        name: creds.accountName || data.username,
        biography: '',
        username: data.username,
        followers_count: creds.accountAvatar ? 0 : 0,
        media_count: data.media_count || 0,
        profile_picture_url: creds.accountAvatar,
      };
    }

    return MetaGraphService.apiFetch<MetaProfileInsights>(
      `/${creds.instagramAccountId}`,
      {
        fields: 'id,name,biography,username,followers_count,media_count,profile_picture_url,website',
      }
    );
  }

  /** Obtiene los últimos media posts (filtra por REELS y VIDEO) */
  static async getReels(limit = 20): Promise<MetaMediaItem[]> {
    const creds = MetaGraphService.loadCredentials();
    if (!creds) return [];

    if (creds.isBasicDisplay) {
      const data = await MetaGraphService.apiFetch<{ data: MetaMediaItem[] }>('/me/media', {
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp',
        limit: String(limit),
      });
      return (data.data || []).filter(
        (item) => item.media_type === 'REELS' || item.media_type === 'VIDEO'
      );
    }

    const data = await MetaGraphService.apiFetch<{ data: MetaMediaItem[] }>(
      `/${creds.instagramAccountId}/media`,
      {
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count',
        limit: String(limit),
      }
    );
    return (data.data || []).filter(
      (item) => item.media_type === 'REELS' || item.media_type === 'VIDEO'
    );
  }

  /** Obtiene insights de un media específico */
  static async getMediaInsights(mediaId: string): Promise<MetaMediaInsights> {
    const creds = MetaGraphService.loadCredentials();
    if (creds?.isBasicDisplay) {
      // Basic Display no expone insights. Declararlo, no simular ceros.
      return {
        media_id: mediaId,
        unavailable: true,
        unavailable_reason: 'El token es de Instagram Basic Display, que no expone métricas de insights. Requiere Instagram Graph API con una cuenta Business o Creator vinculada a una página de Facebook.',
      };
    }

    try {
      const data = await MetaGraphService.apiFetch<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
        `/${mediaId}/insights`,
        {
          metric: 'impressions,reach,saved,shares,plays,total_interactions',
        }
      );

      // Solo se registran las métricas efectivamente devueltas por Meta.
      // Una métrica ausente queda `undefined`, nunca 0.
      const metricsMap: Record<string, number> = {};
      for (const metric of data.data || []) {
        const value = metric.values?.[0]?.value;
        if (typeof value === 'number') {
          metricsMap[metric.name] = value;
        }
      }

      const hasAny = Object.keys(metricsMap).length > 0;

      return {
        media_id: mediaId,
        impressions: metricsMap['impressions'],
        reach: metricsMap['reach'],
        saved: metricsMap['saved'],
        shares: metricsMap['shares'],
        plays: metricsMap['plays'],
        total_interactions: metricsMap['total_interactions'],
        unavailable: !hasAny,
        unavailable_reason: hasAny
          ? undefined
          : 'Meta respondió sin ninguna métrica para este medio.',
      };
    } catch (err: any) {
      // Insights no disponibles para este post: se declara explícitamente.
      // Devolver ceros haría que el benchmark tratara el fallo como rendimiento nulo real.
      return {
        media_id: mediaId,
        unavailable: true,
        unavailable_reason: err?.message || 'La API de Meta no devolvió insights para este medio.',
      };
    }
  }

  /** Obtiene Reels con sus insights combinados */
  static async getReelsWithInsights(
    limit = 10
  ): Promise<Array<MetaMediaItem & { insights?: MetaMediaInsights }>> {
    const reels = await MetaGraphService.getReels(limit);

    const reelsWithInsights = await Promise.allSettled(
      reels.map(async (reel) => {
        try {
          const insights = await MetaGraphService.getMediaInsights(reel.id);
          return { ...reel, insights };
        } catch {
          return { ...reel };
        }
      })
    );

    return reelsWithInsights
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<MetaMediaItem & { insights?: MetaMediaInsights }>).value);
  }
}
