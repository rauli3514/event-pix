// ================================================================
// MetaGraphService.ts
// Servicio completo para Meta Graph API v19.0 / Instagram Graph API
// App: eventPix intelligence (ID: 2345235469580053)
// ================================================================

import { MetaAdCampaign } from '../../types/ads';

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
  /** Cuenta publicitaria de Meta Ads, formato "act_1234567890". */
  adAccountId?: string;
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
    if (!businessId || businessId === 'biz_default') {
      return CREDENTIALS_KEY;
    }
    return `${CREDENTIALS_KEY}_${businessId}`;
  }

  static saveCredentials(creds: MetaCredentials, businessId?: string): void {
    localStorage.setItem(this.getStorageKey(businessId), JSON.stringify(creds));
  }

  // Antes, un negocio nuevo sin token propio caía a la clave global
  // compartida (`CREDENTIALS_KEY`) y terminaba usando el Access Token /
  // Instagram Account ID de OTRO negocio — mismo patrón de fuga ya
  // corregido en el perfil y el CRM. Ahora cada negocio está aislado a
  // su propia clave; si no tiene credenciales, simplemente no está
  // conectado todavía (no hereda las de otro).
  static loadCredentials(businessId?: string): MetaCredentials | null {
    try {
      const raw = localStorage.getItem(this.getStorageKey(businessId));
      if (raw) return JSON.parse(raw) as MetaCredentials;

      // Migración única: "Display Digital" (biz_001) es el único negocio
      // que llegó a guardar sus credenciales bajo la clave global vieja,
      // de cuando biz_001 todavía compartía esa clave a propósito. Si
      // todavía viven ahí, las adoptamos a su clave propia una sola vez
      // en vez de dejarlas huérfanas (lo que hacía que "desaparecieran").
      if (businessId === 'biz_001') {
        const legacyRaw = localStorage.getItem(CREDENTIALS_KEY);
        if (legacyRaw) {
          localStorage.setItem(this.getStorageKey(businessId), legacyRaw);
          return JSON.parse(legacyRaw) as MetaCredentials;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  static clearCredentials(businessId?: string): void {
    localStorage.removeItem(this.getStorageKey(businessId));
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
    params: Record<string, string> = {},
    businessId?: string
  ): Promise<T> {
    const creds = MetaGraphService.loadCredentials(businessId);
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
  static async testConnection(businessId?: string): Promise<boolean> {
    try {
      const creds = MetaGraphService.loadCredentials(businessId);
      if (!creds?.accessToken) return false;
      const res = await MetaGraphService.testAndDiscoverAccounts(creds.accessToken, creds.instagramAccountId);
      return res.success;
    } catch {
      return false;
    }
  }

  /** Obtiene el perfil de la cuenta de Instagram Business */
  static async getProfile(businessId?: string): Promise<MetaProfileInsights> {
    const creds = MetaGraphService.loadCredentials(businessId);
    if (!creds) throw new Error('Credenciales no configuradas');

    if (creds.isBasicDisplay) {
      const data = await MetaGraphService.apiFetch<{
        id: string;
        username: string;
        account_type?: string;
        media_count?: number;
      }>('/me', {
        fields: 'id,username,account_type,media_count',
      }, businessId);
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
      },
      businessId
    );
  }

  /** Obtiene los últimos media posts (filtra por REELS y VIDEO) */
  static async getReels(limit = 20, businessId?: string): Promise<MetaMediaItem[]> {
    const creds = MetaGraphService.loadCredentials(businessId);
    if (!creds) return [];

    if (creds.isBasicDisplay) {
      const data = await MetaGraphService.apiFetch<{ data: MetaMediaItem[] }>('/me/media', {
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp',
        limit: String(limit),
      }, businessId);
      return (data.data || []).filter(
        (item) => item.media_type === 'REELS' || item.media_type === 'VIDEO'
      );
    }

    const data = await MetaGraphService.apiFetch<{ data: MetaMediaItem[] }>(
      `/${creds.instagramAccountId}/media`,
      {
        fields: 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,like_count,comments_count',
        limit: String(limit),
      },
      businessId
    );
    return (data.data || []).filter(
      (item) => item.media_type === 'REELS' || item.media_type === 'VIDEO'
    );
  }

  /** Obtiene insights de un media específico */
  static async getMediaInsights(mediaId: string, businessId?: string): Promise<MetaMediaInsights> {
    const creds = MetaGraphService.loadCredentials(businessId);
    if (creds?.isBasicDisplay) {
      // Basic Display no expone insights. Declararlo, no simular ceros.
      return {
        media_id: mediaId,
        unavailable: true,
        unavailable_reason: 'El token es de Instagram Basic Display, que no expone métricas de insights. Requiere Instagram Graph API con una cuenta Business o Creator vinculada a una página de Facebook.',
      };
    }

    try {
      // "impressions" y "total_interactions" combinados con "views" (el
      // reemplazo de "plays") hacen que Meta rechace la llamada ENTERA con
      // error #100 ("metric[4] must be one of the following values..."),
      // tirando abajo las insights de todos los Reels de una — no solo esas
      // métricas. "views,reach,saved,shares,likes,comments" es el set que
      // Meta efectivamente acepta junto a nivel de media individual.
      const data = await MetaGraphService.apiFetch<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
        `/${mediaId}/insights`,
        {
          metric: 'views,reach,saved,shares,likes,comments',
        },
        businessId
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

      // Meta ya no devuelve "total_interactions" en este mismo llamado (ver
      // comentario arriba), así que se suma a partir de las métricas reales
      // que sí llegaron. Si ninguna llegó, queda undefined — no se inventa 0.
      const interactionParts = [metricsMap['likes'], metricsMap['comments'], metricsMap['shares'], metricsMap['saved']]
        .filter((v): v is number => typeof v === 'number');
      const totalInteractions = interactionParts.length > 0
        ? interactionParts.reduce((a, b) => a + b, 0)
        : undefined;

      return {
        media_id: mediaId,
        reach: metricsMap['reach'],
        saved: metricsMap['saved'],
        shares: metricsMap['shares'],
        plays: metricsMap['views'],
        total_interactions: totalInteractions,
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
    limit = 10,
    businessId?: string
  ): Promise<Array<MetaMediaItem & { insights?: MetaMediaInsights }>> {
    const reels = await MetaGraphService.getReels(limit, businessId);

    const reelsWithInsights = await Promise.allSettled(
      reels.map(async (reel) => {
        try {
          const insights = await MetaGraphService.getMediaInsights(reel.id, businessId);
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

  // =========================================================================
  // META ADS (MARKETING API) — campañas y presupuesto pago reales
  // =========================================================================

  private static formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /**
   * Suma el/los tipo/s de acción de Meta que representan una conversión real
   * (compra, lead o conversación de WhatsApp iniciada). Nunca inventa un
   * número: si Meta no reportó ninguna de estas acciones, devuelve 0.
   */
  private static extractConversions(actions?: Array<{ action_type: string; value: string }>): number {
    if (!actions || actions.length === 0) return 0;
    const priority = [
      'purchase',
      'offsite_conversion.fb_pixel_purchase',
      'lead',
      'onsite_conversion.lead_grouped',
      'onsite_conversion.messaging_conversation_started_7d',
      'onsite_conversion.total_messaging_connection',
    ];
    for (const type of priority) {
      const match = actions.find(a => a.action_type === type);
      if (match) return Math.round(Number(match.value) || 0);
    }
    return 0;
  }

  private static async fetchAdInsights(
    adAccountId: string,
    since: string,
    until: string,
    businessId?: string
  ): Promise<Map<string, { spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number; conversions: number; roas?: number }>> {
    const data = await MetaGraphService.apiFetch<{
      data: Array<{
        campaign_id: string;
        spend?: string;
        impressions?: string;
        clicks?: string;
        ctr?: string;
        cpc?: string;
        cpm?: string;
        actions?: Array<{ action_type: string; value: string }>;
        purchase_roas?: Array<{ value: string }>;
      }>;
    }>(
      `/${adAccountId}/insights`,
      {
        level: 'campaign',
        fields: 'campaign_id,spend,impressions,clicks,ctr,cpc,cpm,actions,purchase_roas',
        time_range: JSON.stringify({ since, until }),
      },
      businessId
    );

    const map = new Map<string, { spend: number; impressions: number; clicks: number; ctr: number; cpc: number; cpm: number; conversions: number; roas?: number }>();
    for (const row of data.data || []) {
      map.set(row.campaign_id, {
        spend: Number(row.spend) || 0,
        impressions: Number(row.impressions) || 0,
        clicks: Number(row.clicks) || 0,
        ctr: Number(row.ctr) || 0,
        cpc: Number(row.cpc) || 0,
        cpm: Number(row.cpm) || 0,
        conversions: MetaGraphService.extractConversions(row.actions),
        roas: row.purchase_roas?.[0]?.value ? Number(row.purchase_roas[0].value) : undefined,
      });
    }
    return map;
  }

  /**
   * Trae las campañas reales de la cuenta publicitaria de Meta Ads y las
   * clasifica (ganadora / desperdiciando presupuesto / fatiga / óptima /
   * en aprendizaje) comparando cada una contra el promedio de la propia
   * cuenta — nunca contra umbrales absolutos inventados. La tendencia
   * semanal compara los últimos 7 días reales contra los 7 anteriores.
   */
  static async getAdCampaigns(businessId?: string): Promise<MetaAdCampaign[]> {
    const creds = MetaGraphService.loadCredentials(businessId);
    if (!creds?.adAccountId) {
      throw new Error('No hay una cuenta publicitaria de Meta Ads conectada para este negocio.');
    }

    const adAccountId = creds.adAccountId.startsWith('act_') ? creds.adAccountId : `act_${creds.adAccountId}`;

    const campaignsData = await MetaGraphService.apiFetch<{
      data: Array<{ id: string; name: string; status: string; objective: string; daily_budget?: string }>;
    }>(
      `/${adAccountId}/campaigns`,
      { fields: 'id,name,status,objective,daily_budget', limit: '100' },
      businessId
    );

    const campaigns = campaignsData.data || [];
    if (campaigns.length === 0) return [];

    const now = new Date();
    const last7Start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const prev7Start = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
    const prev7End = new Date(now.getTime() - 8 * 24 * 3600 * 1000);
    const last30Start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

    const [last30Insights, last7Insights, prev7Insights] = await Promise.all([
      MetaGraphService.fetchAdInsights(adAccountId, MetaGraphService.formatDate(last30Start), MetaGraphService.formatDate(now), businessId),
      MetaGraphService.fetchAdInsights(adAccountId, MetaGraphService.formatDate(last7Start), MetaGraphService.formatDate(now), businessId),
      MetaGraphService.fetchAdInsights(adAccountId, MetaGraphService.formatDate(prev7Start), MetaGraphService.formatDate(prev7End), businessId),
    ]);

    const OBJECTIVE_MAP: Record<string, MetaAdCampaign['objective']> = {
      OUTCOME_LEADS: 'LEADS', LEAD_GENERATION: 'LEADS',
      OUTCOME_SALES: 'SALES', CONVERSIONS: 'SALES',
      OUTCOME_TRAFFIC: 'TRAFFIC', LINK_CLICKS: 'TRAFFIC',
      OUTCOME_ENGAGEMENT: 'ENGAGEMENT', POST_ENGAGEMENT: 'ENGAGEMENT', MESSAGES: 'ENGAGEMENT',
    };

    const built: Array<Omit<MetaAdCampaign, 'status_verdict' | 'trend_vs_last_week' | 'recommendation'> & { _prevCpa: number | null; _last7Cpa: number | null }> = campaigns.map(c => {
      const insights = last30Insights.get(c.id);
      const spend = insights?.spend ?? 0;
      const conversions = insights?.conversions ?? 0;
      const cpa = conversions > 0 ? Number((spend / conversions).toFixed(2)) : 0;

      // Comparación semana vs. semana anterior (misma cantidad de días en ambos períodos)
      const last7 = last7Insights.get(c.id);
      const last7Cpa = last7 && last7.conversions > 0 ? last7.spend / last7.conversions : null;
      const prev = prev7Insights.get(c.id);
      const prevConversions = prev?.conversions ?? 0;
      const prevCpa = prev && prevConversions > 0 ? prev.spend / prevConversions : null;

      return {
        id: c.id,
        name: c.name,
        status: (c.status === 'ACTIVE' ? 'ACTIVE' : c.status === 'PAUSED' ? 'PAUSED' : 'ARCHIVED'),
        objective: OBJECTIVE_MAP[c.objective] || 'TRAFFIC',
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : 0,
        spend,
        impressions: insights?.impressions ?? 0,
        clicks: insights?.clicks ?? 0,
        ctr: insights?.ctr ?? 0,
        cpc: insights?.cpc ?? 0,
        cpm: insights?.cpm ?? 0,
        conversions,
        cpa,
        roas: insights?.roas,
        _prevCpa: prevCpa,
        _last7Cpa: last7Cpa,
      };
    });

    // Promedio de la propia cuenta (solo campañas con conversiones reales) para clasificar sin umbrales inventados
    const withCpa = built.filter(c => c.conversions > 0);
    const accountAvgCpa = withCpa.length > 0
      ? withCpa.reduce((s, c) => s + c.cpa, 0) / withCpa.length
      : 0;

    return built.map(c => {
      let trend: MetaAdCampaign['trend_vs_last_week'] = 'estable';
      if (c._prevCpa !== null && c._last7Cpa !== null) {
        if (c._last7Cpa <= c._prevCpa * 0.85) trend = 'mejorando';
        else if (c._last7Cpa >= c._prevCpa * 1.2) trend = 'deteriorandose';
      }

      let verdict: MetaAdCampaign['status_verdict'] = 'en_aprendizaje';
      let recommendation = `"${c.name}" todavía no acumuló suficientes conversiones para evaluar su rendimiento con confianza.`;

      if (c.conversions === 0 && c.spend > 30) {
        verdict = 'desperdiciando_presupuesto';
        recommendation = `Gastó $${c.spend.toFixed(2)} sin generar ninguna conversión registrada. Revisar segmentación o pausar.`;
      } else if (accountAvgCpa > 0 && c.conversions > 0) {
        if (c.cpa <= accountAvgCpa * 0.6) {
          verdict = 'ganadora';
          recommendation = `Costo por conversión de $${c.cpa.toFixed(2)}, muy por debajo del promedio de la cuenta ($${accountAvgCpa.toFixed(2)}). Candidata a escalar presupuesto.`;
        } else if (c.cpa >= accountAvgCpa * 1.8) {
          verdict = 'desperdiciando_presupuesto';
          recommendation = `Costo por conversión de $${c.cpa.toFixed(2)}, muy por encima del promedio de la cuenta ($${accountAvgCpa.toFixed(2)}). Evaluar pausar o rehacer la segmentación.`;
        } else if (trend === 'deteriorandose') {
          verdict = 'fatiga';
          recommendation = `El costo por conversión empeoró frente a la semana anterior. Posible fatiga de audiencia: renovar creativo.`;
        } else {
          verdict = 'optima';
          recommendation = `Rinde en línea con el promedio de la cuenta ($${c.cpa.toFixed(2)} por conversión).`;
        }
      }

      const { _prevCpa, _last7Cpa, ...rest } = c;
      return { ...rest, status_verdict: verdict, trend_vs_last_week: trend, recommendation };
    });
  }

  /** Pausa o reactiva una campaña real en Meta Ads Manager */
  static async setCampaignStatus(campaignId: string, status: 'ACTIVE' | 'PAUSED', businessId?: string): Promise<void> {
    const creds = MetaGraphService.loadCredentials(businessId);
    if (!creds?.accessToken) throw new Error('No hay credenciales de Meta configuradas.');

    const res = await fetch(`${META_GRAPH_BASE}/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ status, access_token: creds.accessToken }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `No se pudo actualizar el estado de la campaña (${res.status})`);
    }
  }
}
