// ================================================================
// IntelligenceStorageService.ts
// Capa de Persistencia Híbrida: Supabase (SaaS) + LocalStorage Fallback
// EventPix Intelligence — SaaS Platform
// ================================================================

import { supabase } from '../../lib/supabase';
import {
  IntelligenceBusiness,
  BrandDNA,
  IntelligencePost,
  AccountMedianBenchmark,
  Hypothesis,
  ContentExperiment,
  LearnedInsight
} from '../../types/intelligence';
import { CanvasNode, CanvasEdge } from '../../components/intelligence/StrategyCanvas';
import { ExecutiveIntelligenceReport } from './ContentIntelligenceEngine';

import { UserProfileContext } from '../../types/strategicProfile';
import { INITIAL_BRAND_DNA } from './mockData';

const LOCAL_STORAGE_KEYS = {
  BUSINESS: 'eventpix_saas_business',
  BUSINESSES_LIST: 'eventpix_saas_businesses_list',
  ACTIVE_BUSINESS_ID: 'eventpix_saas_active_biz_id',
  BRAND_DNA: 'eventpix_saas_brand_dna',
  PROFILE_CONTEXT: 'eventpix_saas_profile_context',
  POSTS: 'eventpix_saas_posts',
  REPORTS: 'eventpix_saas_reports',
  CANVAS: 'eventpix_saas_canvas_state',
  BENCHMARK: 'eventpix_saas_benchmark',
  HYPOTHESES: 'eventpix_saas_hypotheses',
  EXPERIMENTS: 'eventpix_saas_experiments',
  LEARNED_INSIGHTS: 'eventpix_saas_learned_insights',
};

export interface NewClientRegistrationParams {
  name: string;
  instagramHandle: string;
  niche?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  metaToken?: string;
  instagramAccountId?: string;
}

export class IntelligenceStorageService {
  private static isSupabaseAvailable = false;
  private static checkedSupabase = false;

  /**
   * Verifica de forma no bloqueante si Supabase está activo y tiene las tablas creadas
   */
  private static async testSupabase(): Promise<boolean> {
    if (this.checkedSupabase) return this.isSupabaseAvailable;

    try {
      // Intento rápido de lectura con límite 1
      const { error } = await supabase
        .from('intelligence_businesses')
        .select('id')
        .limit(1);

      this.isSupabaseAvailable = !error;
    } catch {
      this.isSupabaseAvailable = false;
    }

    this.checkedSupabase = true;
    return this.isSupabaseAvailable;
  }

  // =========================================================================
  // 1. BUSINESS PROFILE & MULTI-TENANT MANAGEMENT
  // =========================================================================

  /**
   * Obtiene el ID del negocio activo seleccionado
   */
  static getActiveBusinessId(): string {
    return localStorage.getItem(LOCAL_STORAGE_KEYS.ACTIVE_BUSINESS_ID) || 'biz_001';
  }

  /**
   * Establece el negocio activo
   */
  static setActiveBusinessId(bizId: string): void {
    localStorage.setItem(LOCAL_STORAGE_KEYS.ACTIVE_BUSINESS_ID, bizId);
  }

  /**
   * Lista todos los negocios / clientes registrados
   */
  static async listBusinesses(): Promise<IntelligenceBusiness[]> {
    const isSupa = await this.testSupabase();
    let supaBusinesses: IntelligenceBusiness[] = [];

    if (isSupa) {
      try {
        const { data, error } = await supabase
          .from('intelligence_businesses')
          .select('*')
          .order('name');
        if (!error && data && data.length > 0) {
          supaBusinesses = data as IntelligenceBusiness[];
        }
      } catch (err) {
        console.warn('Error al listar negocios desde Supabase:', err);
      }
    }

    // LocalStorage
    let localList: IntelligenceBusiness[] = [];
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.BUSINESSES_LIST);
      if (stored) {
        localList = JSON.parse(stored) as IntelligenceBusiness[];
      }
    } catch (e) {
      console.error('Error leyendo lista de negocios local:', e);
    }

    // Default inicial con Display Digital / Shop de Plumas
    const defaultInitial: IntelligenceBusiness = {
      id: 'biz_001',
      user_id: 'user_default',
      name: 'Display Digital & Shop de Plumas',
      niche: 'Cartelería Digital & Pantallas Verticales para Comercios',
      target_audience: 'Comercios, vidrieras, bares, farmacias y franquicias',
      brand_tone: 'directo',
      instagram_handle: '@display_digital',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      catalog_provider: 'shop_de_plumas'
    };

    // Unir sin duplicados por ID
    const combinedMap = new Map<string, IntelligenceBusiness>();
    combinedMap.set(defaultInitial.id, defaultInitial);

    for (const b of localList) {
      if (b && b.id) combinedMap.set(b.id, b);
    }
    for (const b of supaBusinesses) {
      if (b && b.id) combinedMap.set(b.id, b);
    }

    const result = Array.from(combinedMap.values());
    
    // Guardar lista unificada localmente
    try {
      localStorage.setItem(LOCAL_STORAGE_KEYS.BUSINESSES_LIST, JSON.stringify(result));
    } catch {
      // ignore
    }

    return result;
  }

  /**
   * Registra una nueva cuenta de cliente / comercio (Onboarding Multi-Tenant)
   */
  static async registerClientAccount(params: NewClientRegistrationParams): Promise<IntelligenceBusiness> {
    const cleanHandle = params.instagramHandle.trim().startsWith('@')
      ? params.instagramHandle.trim()
      : `@${params.instagramHandle.trim()}`;

    // Antes esto generaba un id de texto ("biz_172...") que la columna
    // UUID de Supabase rechazaba en silencio (atrapado por el try/catch de
    // abajo): el negocio nunca se creaba de verdad en la base, solo vivía
    // en localStorage. Un UUID real es indispensable para que el negocio
    // exista de verdad y el webhook de WhatsApp/Instagram pueda encontrarlo.
    const newBizId = crypto.randomUUID();
    const newBiz: IntelligenceBusiness = {
      id: newBizId,
      user_id: `user_${Date.now()}`,
      name: params.name.trim(),
      niche: params.niche || 'Comercio Local & Servicios',
      target_audience: `Clientes y público objetivo de ${params.name}`,
      brand_tone: 'cercano',
      instagram_handle: cleanHandle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Guardar en Supabase si está disponible
    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const { data: authData } = await supabase.auth.getUser();

        if (authData?.user) {
          // Hay una sesión real (recién registrado o el super_admin creando
          // un cliente): usamos la función que crea el negocio Y lo vincula
          // a esa cuenta en intelligence_business_users en el mismo paso.
          // Las políticas RLS no dejan insertar intelligence_businesses
          // directo a nadie que no sea super_admin, así que sin esto el
          // dueño real del negocio quedaba sin acceso a su propio panel.
          const { error: rpcError } = await supabase.rpc('register_intelligence_business', {
            p_id: newBiz.id,
            p_name: newBiz.name,
            p_instagram_handle: newBiz.instagram_handle,
            p_niche: newBiz.niche,
            p_target_audience: newBiz.target_audience,
            p_brand_tone: newBiz.brand_tone
          });
          if (rpcError) console.warn('Error vinculando negocio al usuario:', rpcError);
        } else {
          await supabase.from('intelligence_businesses').upsert({
            id: newBiz.id,
            name: newBiz.name,
            instagram_handle: newBiz.instagram_handle,
            niche: newBiz.niche,
            target_audience: newBiz.target_audience,
            brand_tone: newBiz.brand_tone
          });
        }

        // Crear también en display_commerces para Cartelería Digital
        await supabase.from('display_commerces').upsert({
          id: newBiz.id,
          name: newBiz.name,
          email: params.email || undefined
        });
      } catch (err) {
        console.warn('Error guardando nuevo cliente en Supabase:', err);
      }
    }

    // 2. Guardar en lista local
    const currentList = await this.listBusinesses();
    const updatedList = [newBiz, ...currentList.filter(b => b.id !== newBiz.id && b.instagram_handle !== newBiz.instagram_handle)];
    localStorage.setItem(LOCAL_STORAGE_KEYS.BUSINESSES_LIST, JSON.stringify(updatedList));

    // 3. Crear Brand DNA inicial adaptado al rubro
    const tailoredBrandDna: BrandDNA = {
      business_id: newBiz.id,
      identity: {
        mission: `Brindar las mejores soluciones de ${newBiz.niche} para nuestros clientes en ${newBiz.name}.`,
        unique_value_proposition: `Calidad, atención personalizada y rapidez en ${newBiz.name}.`,
        target_avatar: newBiz.target_audience || 'Clientes del local y la zona comercial'
      },
      voice_and_tone: {
        primary_tone: 'directo',
        favorite_catchphrases: [`¡Te esperamos en ${newBiz.name}!`, 'Escribinos por WhatsApp y te asesoramos'],
        forbidden_words: ['imposible', 'no podemos', 'complicado'],
        pacing: 'moderado'
      },
      offers: {
        main_products: [`Servicio / Producto Estrella de ${newBiz.name}`],
        call_to_actions: ['Escribinos por WhatsApp', 'Consultá por mensaje directo'],
        whatsapp_link: params.phone ? `https://wa.me/${params.phone.replace(/[^0-9]/g, '')}` : undefined
      },
      samples: []
    };

    await this.saveBrandDna(newBiz.id, tailoredBrandDna);

    // 4. Establecer como activo
    this.setActiveBusinessId(newBiz.id);

    return newBiz;
  }

  static async getOrCreateBusiness(
    handle = '@display_digital',
    name = 'Display Digital & Tecno eventos'
  ): Promise<IntelligenceBusiness> {
    const activeId = this.getActiveBusinessId();
    const list = await this.listBusinesses();
    const found = list.find(b => b.id === activeId || b.instagram_handle === handle);
    if (found) return found;

    return list[0] || {
      id: 'biz_001',
      user_id: 'user_default',
      name,
      niche: 'Cartelería Digital & Pantallas Inteligentes para Locales',
      target_audience: 'Comercios, locales gastronómicos, moda y retail',
      brand_tone: 'directo',
      instagram_handle: handle,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  // =========================================================================
  // 2. BRAND DNA PERSISTENCE
  // =========================================================================

  static async saveBrandDna(businessId: string, brandDna: BrandDNA): Promise<boolean> {
    // 1. Cache local con clave aislada por negocio
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEYS.BRAND_DNA}_${businessId}`, JSON.stringify(brandDna));
      if (businessId === 'biz_001' || businessId === 'biz_default') {
        localStorage.setItem(LOCAL_STORAGE_KEYS.BRAND_DNA, JSON.stringify(brandDna));
      }
    } catch (e) {
      console.error('Error guardando Brand DNA en localStorage:', e);
    }

    // 2. Supabase
    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const payload = {
          business_id: businessId,
          identity: brandDna.identity,
          voice_and_tone: brandDna.voice_and_tone,
          offers: brandDna.offers,
          samples: brandDna.samples,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from('intelligence_brand_dna')
          .upsert(payload, { onConflict: 'business_id' });

        return !error;
      } catch (err) {
        console.warn('Error al guardar Brand DNA en Supabase:', err);
      }
    }

    return true;
  }

  /**
   * Normaliza cualquier BrandDNA (antiguo o nuevo) para garantizar que los arrays existan siempre
   */
  static normalizeBrandDna(dna: any, businessId: string): BrandDNA {
    if (!dna) return { ...INITIAL_BRAND_DNA, business_id: businessId };

    const favorite_catchphrases =
      dna.voice_and_tone?.favorite_catchphrases ||
      dna.voice_and_tone?.catchphrases ||
      ['¡Hola! Te esperamos en nuestro local', 'Escribinos por WhatsApp y te asesoramos'];

    const forbidden_words = dna.voice_and_tone?.forbidden_words || ['imposible', 'no podemos'];

    let main_products: string[] = [];
    let call_to_actions: string[] = ['Escribinos por WhatsApp', 'Consultá por mensaje directo'];
    let whatsapp_link = dna.offers?.whatsapp_link || '';

    if (Array.isArray(dna.offers)) {
      main_products = dna.offers.map((o: any) => o.name || '').filter(Boolean);
    } else if (Array.isArray(dna.offers?.main_products)) {
      main_products = dna.offers.main_products;
      if (Array.isArray(dna.offers?.call_to_actions)) {
        call_to_actions = dna.offers.call_to_actions;
      }
    } else {
      main_products = ['Servicio / Producto Principal'];
    }

    return {
      id: dna.id,
      business_id: businessId,
      identity: {
        mission: dna.identity?.mission || dna.identity?.purpose || 'Brindar la mejor atención y calidad.',
        unique_value_proposition: dna.identity?.unique_value_proposition || dna.identity?.voice || 'Calidad y atención personalizada.',
        target_avatar: dna.identity?.target_avatar || dna.identity?.audience || 'Clientes del comercio'
      },
      voice_and_tone: {
        primary_tone: dna.voice_and_tone?.primary_tone || 'directo',
        secondary_tone: dna.voice_and_tone?.secondary_tone,
        favorite_catchphrases,
        forbidden_words,
        pacing: dna.voice_and_tone?.pacing || 'moderado'
      },
      offers: {
        main_products: main_products.length > 0 ? main_products : ['Servicio / Producto Principal'],
        call_to_actions,
        whatsapp_link
      },
      samples: Array.isArray(dna.samples) ? dna.samples : []
    };
  }

  static async loadBrandDna(businessId: string): Promise<BrandDNA | null> {
    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const { data, error } = await supabase
          .from('intelligence_brand_dna')
          .select('*')
          .eq('business_id', businessId)
          .maybeSingle();

        if (!error && data) {
          return this.normalizeBrandDna(data, businessId);
        }
      } catch (err) {
        console.warn('Error al cargar Brand DNA de Supabase:', err);
      }
    }

    const tenantCached = localStorage.getItem(`${LOCAL_STORAGE_KEYS.BRAND_DNA}_${businessId}`);
    if (tenantCached) {
      try {
        return this.normalizeBrandDna(JSON.parse(tenantCached), businessId);
      } catch {}
    }

    const cached = localStorage.getItem(LOCAL_STORAGE_KEYS.BRAND_DNA);
    if (cached) {
      try {
        return this.normalizeBrandDna(JSON.parse(cached), businessId);
      } catch {
        return null;
      }
    }

    return null;
  }

  // =========================================================================
  // 2.5 USER PROFILE & AI STRATEGIC CONTEXT
  // =========================================================================

  static async saveProfileContext(businessId: string, context: UserProfileContext): Promise<boolean> {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEYS.PROFILE_CONTEXT}_${businessId}`, JSON.stringify(context));
    } catch (e) {
      console.error('Error guardando perfil y contexto IA:', e);
    }
    return true;
  }

  static async loadProfileContext(businessId: string): Promise<UserProfileContext> {
    // 1. Intentar cargar desde localStorage aislado a ESTE negocio únicamente.
    // (Antes había un fallback a una clave global compartida: un negocio nuevo
    // terminaba heredando el perfil guardado de otro comercio distinto.)
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEYS.PROFILE_CONTEXT}_${businessId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.profile && parsed.ai_context) {
          return { ...parsed, business_id: businessId };
        }
      } catch (e) {
        console.warn('Error parseando contexto de perfil:', e);
      }
    }

    // 2. Fallback inteligente: construir a partir del BrandDNA y Business actuales
    const brandDna = await this.loadBrandDna(businessId);
    const businesses = await this.listBusinesses();
    const currentBiz = businesses.find(b => b.id === businessId) || businesses[0];

    const defaultContext: UserProfileContext = {
      business_id: businessId,
      profile: {
        avatar_url: '',
        instagram_handle: currentBiz?.instagram_handle?.replace('@', '') || '',
        niche: currentBiz?.niche || '',
        language: 'Español (Latinoamérica)',
        about_content: brandDna?.identity?.mission || ''
      },
      ai_context: {
        tone: (brandDna?.voice_and_tone?.primary_tone as any) || 'directo',
        must_do_rules: [
          'Mantener ganchos directos, provocadores y con alto contraste en los primeros 3 segundos.',
          'Usar lenguaje cercano y conversacional latinoamericano (evitar términos excesivamente técnicos sin bajada práctica).',
          'Enfocar los guiones en objeciones reales de compra y dolores del cliente.'
        ],
        forbidden_rules: [
          'Nunca sonar como locutor de publicidad tradicional ni usar frases clichés de infomercial.',
          'No inventar datos falsos ni prometer fórmulas mágicas de la noche a la mañana.',
          'Evitar saludos lentos tipo "¿Cómo están chicos?" al inicio de los videos.'
        ],
        favorite_catchphrases: brandDna?.voice_and_tone?.favorite_catchphrases || []
      },
      cta_list: [
        {
          id: 'cta_1',
          keyword: 'APP',
          full_phrase: 'Comenta "APP" y te la envío ya mismo!! 🤩👇',
          action_type: 'comment_keyword',
          is_favorite: true
        },
        {
          id: 'cta_3',
          keyword: 'WHATSAPP',
          full_phrase: 'Escribinos un mensaje privado o al WhatsApp del perfil para coordinar una llamada.',
          action_type: 'whatsapp',
          is_favorite: false
        }
      ],
      updated_at: new Date().toISOString()
    };

    // Guardar para futuros usos
    this.saveProfileContext(businessId, defaultContext);
    return defaultContext;
  }

  // =========================================================================
  // 3. POSTS & REELS HISTÓRICOS
  // =========================================================================

  static async savePosts(businessId: string, posts: IntelligencePost[]): Promise<boolean> {
    // Cache local aislada a ESTE negocio
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEYS.POSTS}_${businessId}`, JSON.stringify(posts));
    } catch (e) {
      console.error(e);
    }

    const isSupa = await this.testSupabase();
    if (isSupa && posts.length > 0) {
      try {
        const rows = posts.map(p => ({
          id: p.id,
          business_id: businessId,
          platform: 'instagram',
          title: p.title,
          caption: p.title,
          video_url: p.video_url,
          thumbnail_url: p.thumbnail_url,
          duration_seconds: p.duration_seconds,
          objective: p.objective,
          published_at: p.published_at,
          metrics: p.metrics || {},
          analysis: p.analysis || {},
        }));

        const { error } = await supabase
          .from('intelligence_posts')
          .upsert(rows, { onConflict: 'id' });

        return !error;
      } catch (err) {
        console.warn('Error al guardar posts en Supabase:', err);
      }
    }

    return true;
  }

  static async loadPosts(businessId: string): Promise<IntelligencePost[] | null> {
    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const { data, error } = await supabase
          .from('intelligence_posts')
          .select('*')
          .eq('business_id', businessId)
          .order('published_at', { ascending: false });

        // Supabase respondió: confiamos en su resultado tal cual, incluso si
        // está vacío (negocio nuevo sin posts todavía). Antes, un array vacío
        // caía al cache local sin scopear y terminaba mostrando los posts de
        // OTRO negocio.
        if (!error && data) {
          return data.map(row => ({
            id: row.id,
            business_id: row.business_id,
            title: row.title,
            video_url: row.video_url,
            thumbnail_url: row.thumbnail_url,
            duration_seconds: row.duration_seconds,
            objective: row.objective,
            published_at: row.published_at,
            created_at: row.created_at,
            metrics: row.metrics,
            analysis: row.analysis,
          }));
        }
      } catch (err) {
        console.warn('Error al cargar posts desde Supabase:', err);
      }
    }

    // Supabase no disponible: fallback a caché local aislada a ESTE negocio.
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEYS.POSTS}_${businessId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return null;
      }
    }

    return null;
  }

  // =========================================================================
  // 4. EXECUTIVE REPORTS PERSISTENCE
  // =========================================================================

  static async saveReport(
    businessId: string,
    report: ExecutiveIntelligenceReport
  ): Promise<boolean> {
    try {
      const existing = this.loadLocalReports(businessId);
      existing.unshift(report);
      localStorage.setItem(`${LOCAL_STORAGE_KEYS.REPORTS}_${businessId}`, JSON.stringify(existing.slice(0, 10)));
    } catch (e) {
      console.error(e);
    }

    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const { error } = await supabase.from('intelligence_reports').insert({
          business_id: businessId,
          account_handle: report.account_handle,
          health_score: report.global_health_score,
          report_data: report,
        });
        return !error;
      } catch (err) {
        console.warn('Error al guardar reporte en Supabase:', err);
      }
    }

    return true;
  }

  private static loadLocalReports(businessId: string): ExecutiveIntelligenceReport[] {
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEYS.REPORTS}_${businessId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        return [];
      }
    }
    return [];
  }

  // =========================================================================
  // 5. CANVAS STATE PERSISTENCE (NODOS Y CONEXIONES)
  // =========================================================================

  static async saveCanvasState(
    businessId: string,
    nodes: CanvasNode[],
    edges: CanvasEdge[]
  ): Promise<boolean> {
    try {
      localStorage.setItem(
        `${LOCAL_STORAGE_KEYS.CANVAS}_${businessId}`,
        JSON.stringify({ nodes, edges, updated_at: new Date().toISOString() })
      );
    } catch (e) {
      console.error(e);
    }

    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const { error } = await supabase
          .from('intelligence_canvas_state')
          .upsert(
            {
              business_id: businessId,
              nodes,
              edges,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'business_id' }
          );
        return !error;
      } catch (err) {
        console.warn('Error al guardar estado de canvas en Supabase:', err);
      }
    }

    return true;
  }

  static async loadCanvasState(
    businessId: string
  ): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null> {
    const isSupa = await this.testSupabase();
    if (isSupa) {
      try {
        const { data, error } = await supabase
          .from('intelligence_canvas_state')
          .select('nodes, edges')
          .eq('business_id', businessId)
          .maybeSingle();

        // Supabase respondió: confiamos en su resultado. Si este negocio no
        // tiene canvas guardado todavía (data null), devolvemos null en vez
        // de caer al cache sin scopear de OTRO negocio.
        if (!error) {
          if (data && data.nodes) {
            return {
              nodes: data.nodes as CanvasNode[],
              edges: (data.edges || []) as CanvasEdge[],
            };
          }
          return null;
        }
      } catch (err) {
        console.warn('Error al cargar estado del canvas desde Supabase:', err);
      }
    }

    // Supabase no disponible: fallback a caché local aislada a ESTE negocio.
    const cached = localStorage.getItem(`${LOCAL_STORAGE_KEYS.CANVAS}_${businessId}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.nodes)) {
          return { nodes: parsed.nodes, edges: parsed.edges || [] };
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  // ================================================================
  // PERSISTENCIA DEL SISTEMA DE APRENDIZAJE ESTRATÉGICO
  // ================================================================

  static saveBenchmark(businessId: string, benchmark: AccountMedianBenchmark): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.BENCHMARK);
      const map = stored ? JSON.parse(stored) : {};
      map[businessId] = benchmark;
      localStorage.setItem(LOCAL_STORAGE_KEYS.BENCHMARK, JSON.stringify(map));
    } catch (e) {
      console.warn('Error al guardar benchmark en localStorage:', e);
    }
  }

  static getBenchmark(businessId: string): AccountMedianBenchmark | null {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.BENCHMARK);
      if (!stored) return null;
      const map = JSON.parse(stored);
      return map[businessId] || null;
    } catch {
      return null;
    }
  }

  static saveHypotheses(businessId: string, hypotheses: Hypothesis[]): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.HYPOTHESES);
      const map = stored ? JSON.parse(stored) : {};
      map[businessId] = hypotheses;
      localStorage.setItem(LOCAL_STORAGE_KEYS.HYPOTHESES, JSON.stringify(map));
    } catch (e) {
      console.warn('Error al guardar hipótesis:', e);
    }
  }

  static getHypotheses(businessId: string): Hypothesis[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.HYPOTHESES);
      if (!stored) return [];
      const map = JSON.parse(stored);
      return map[businessId] || [];
    } catch {
      return [];
    }
  }

  static saveExperiment(businessId: string, experiment: ContentExperiment): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.EXPERIMENTS);
      const map: Record<string, ContentExperiment[]> = stored ? JSON.parse(stored) : {};
      const list = map[businessId] || [];
      const existingIdx = list.findIndex(e => e.experiment_id === experiment.experiment_id);
      if (existingIdx >= 0) {
        list[existingIdx] = experiment;
      } else {
        list.unshift(experiment);
      }
      map[businessId] = list;
      localStorage.setItem(LOCAL_STORAGE_KEYS.EXPERIMENTS, JSON.stringify(map));
    } catch (e) {
      console.warn('Error al guardar experimento:', e);
    }
  }

  static getExperiments(businessId: string): ContentExperiment[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.EXPERIMENTS);
      if (!stored) return [];
      const map = JSON.parse(stored);
      return map[businessId] || [];
    } catch {
      return [];
    }
  }

  static saveLearnedInsight(businessId: string, insight: LearnedInsight): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LEARNED_INSIGHTS);
      const map: Record<string, LearnedInsight[]> = stored ? JSON.parse(stored) : {};
      const list = map[businessId] || [];
      const existingIdx = list.findIndex(i => i.insight_id === insight.insight_id);
      if (existingIdx >= 0) {
        list[existingIdx] = insight;
      } else {
        list.unshift(insight);
      }
      map[businessId] = list;
      localStorage.setItem(LOCAL_STORAGE_KEYS.LEARNED_INSIGHTS, JSON.stringify(map));
    } catch (e) {
      console.warn('Error al guardar aprendizaje estratégico:', e);
    }
  }

  static getLearnedInsights(businessId: string): LearnedInsight[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.LEARNED_INSIGHTS);
      if (!stored) return [];
      const map = JSON.parse(stored);
      return map[businessId] || [];
    } catch {
      return [];
    }
  }

  /**
   * "Reiniciar a 0" real: la versión anterior solo borraba claves globales
   * legacy que ya nadie escribe (todo se guarda scopeado por negocio como
   * `${KEY}_${businessId}`), así que en la práctica no borraba nada y el
   * negocio seguía mostrando su contenido "viejo" después de resetear.
   * Ahora borra el cache local de ESTE negocio y, cuando hay Supabase
   * disponible, también su propio canvas/posts/reportes guardados (no toca
   * conversaciones de CRM: esas son mensajes reales de clientes, no datos
   * de análisis/estrategia, y no deben poder borrarse sin querer).
   */
  static async clearAllData(businessId: string): Promise<void> {
    try {
      // Claves legacy sin scopear (por si quedó algo de versiones viejas)
      localStorage.removeItem(LOCAL_STORAGE_KEYS.BUSINESS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.BRAND_DNA);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.POSTS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.REPORTS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.CANVAS);
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PROFILE_CONTEXT);

      // Claves reales, scopeadas a este negocio
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.BRAND_DNA}_${businessId}`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.PROFILE_CONTEXT}_${businessId}`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.POSTS}_${businessId}`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.REPORTS}_${businessId}`);
      localStorage.removeItem(`${LOCAL_STORAGE_KEYS.CANVAS}_${businessId}`);

      // Mapas compartidos: solo borrar la entrada de ESTE negocio, no el mapa entero
      for (const key of [
        LOCAL_STORAGE_KEYS.BENCHMARK,
        LOCAL_STORAGE_KEYS.HYPOTHESES,
        LOCAL_STORAGE_KEYS.EXPERIMENTS,
        LOCAL_STORAGE_KEYS.LEARNED_INSIGHTS,
      ]) {
        const stored = localStorage.getItem(key);
        if (!stored) continue;
        try {
          const map = JSON.parse(stored);
          delete map[businessId];
          localStorage.setItem(key, JSON.stringify(map));
        } catch {
          // ignore
        }
      }
    } catch (e) {
      console.error('Error al limpiar datos locales:', e);
    }

    const isSupa = await this.testSupabase();
    if (!isSupa) return;

    try {
      await Promise.all([
        supabase.from('intelligence_posts').delete().eq('business_id', businessId),
        supabase.from('intelligence_reports').delete().eq('business_id', businessId),
        supabase.from('intelligence_canvas_state').delete().eq('business_id', businessId),
      ]);
    } catch (err) {
      console.warn('Error al limpiar datos de Supabase en el reset:', err);
    }
  }
}
