// ================================================================
// ProfileSnapshotService.ts
// Historial diario de seguidores/engagement por perfil (propio o de
// competencia, Instagram o TikTok) — alimenta el gráfico de "Crecimiento
// de Seguidores" del Análisis de Comercio.
//
// Ni Meta ni TikTok exponen histórico hacia atrás: esto solo puede
// empezar a llenarse desde el día que se guarda la primera foto. No hay
// cron en esta app, así que se guarda "de paso": cada vez que se carga
// un perfil, se intenta insertar la foto de hoy — el índice único de la
// migración hace que la segunda vez en el mismo día sea un no-op.
// ================================================================

import { supabase } from '../../lib/supabase';

export type ProfileKind = 'own' | 'competitor';
export type ProfilePlatform = 'instagram' | 'tiktok';

export interface ProfileSnapshot {
  snapshot_date: string;
  follower_count: number | null;
  following_count: number | null;
  media_count: number | null;
  total_likes: number | null;
}

export interface ProfileGrowth {
  /** Diferencia de seguidores entre la primera y la última foto disponibles. */
  netFollowerChange: number | null;
  /** % de crecimiento sobre la primera foto. */
  growthPct: number | null;
  /** Cuántos días reales de historial hay (no calendario, snapshots guardados). */
  sampleDays: number;
  history: ProfileSnapshot[];
}

export class ProfileSnapshotService {
  /**
   * Guarda la foto de hoy para este perfil si todavía no existe una.
   * Nunca falla de forma ruidosa: si Supabase no está disponible o el
   * insert choca con el índice único (ya se guardó hoy), se ignora.
   */
  static async recordSnapshotIfNeeded(params: {
    businessId: string;
    kind: ProfileKind;
    platform: ProfilePlatform;
    handle: string;
    followerCount?: number | null;
    followingCount?: number | null;
    mediaCount?: number | null;
    totalLikes?: number | null;
  }): Promise<void> {
    const cleanHandle = params.handle.replace('@', '').toLowerCase().trim();
    if (!cleanHandle || !params.businessId) return;

    try {
      await supabase.from('intelligence_profile_snapshots').upsert(
        {
          business_id: params.businessId,
          profile_kind: params.kind,
          platform: params.platform,
          handle: cleanHandle,
          follower_count: params.followerCount ?? null,
          following_count: params.followingCount ?? null,
          media_count: params.mediaCount ?? null,
          total_likes: params.totalLikes ?? null,
          snapshot_date: new Date().toISOString().slice(0, 10),
        },
        {
          onConflict: 'business_id,platform,handle,snapshot_date',
          ignoreDuplicates: true,
        }
      );
    } catch (err) {
      console.warn('ProfileSnapshotService: no se pudo guardar la foto de hoy', err);
    }
  }

  /** Historial de fotos guardadas para un perfil, de más vieja a más nueva. */
  static async getHistory(
    businessId: string,
    platform: ProfilePlatform,
    handle: string,
    days = 90
  ): Promise<ProfileSnapshot[]> {
    const cleanHandle = handle.replace('@', '').toLowerCase().trim();
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('intelligence_profile_snapshots')
        .select('snapshot_date, follower_count, following_count, media_count, total_likes')
        .eq('business_id', businessId)
        .eq('platform', platform)
        .eq('handle', cleanHandle)
        .gte('snapshot_date', since.toISOString().slice(0, 10))
        .order('snapshot_date', { ascending: true });

      if (error || !data) return [];
      return data as ProfileSnapshot[];
    } catch (err) {
      console.warn('ProfileSnapshotService: no se pudo leer el historial', err);
      return [];
    }
  }

  /** Crecimiento neto de seguidores sobre el historial real guardado (nunca estimado). */
  static async getGrowth(businessId: string, platform: ProfilePlatform, handle: string, days = 30): Promise<ProfileGrowth> {
    const history = await this.getHistory(businessId, platform, handle, days);
    const withFollowers = history.filter((h) => typeof h.follower_count === 'number');

    if (withFollowers.length === 0) {
      return { netFollowerChange: null, growthPct: null, sampleDays: 0, history };
    }

    const first = withFollowers[0].follower_count as number;
    const last = withFollowers[withFollowers.length - 1].follower_count as number;
    const netFollowerChange = last - first;
    const growthPct = first > 0 ? Math.round((netFollowerChange / first) * 1000) / 10 : null;

    return { netFollowerChange, growthPct, sampleDays: withFollowers.length, history };
  }
}
