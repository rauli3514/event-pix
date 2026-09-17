// ================================================================
// AuditSnapshotService.ts
// Persiste "fotos" del puntaje de Auditoría Personalizada (punto de
// partida + check-ins posteriores) para poder comparar progreso real
// a los 30/60/90 días en vez de mostrar un número suelto sin historia.
// EventPix Intelligence — SaaS Platform
// ================================================================

import { supabase } from '../../lib/supabase';
import { AuditSnapshot, AuditSnapshotMetrics, UnifiedBusinessAudit } from '../../types/intelligence';

export class AuditSnapshotService {
  /**
   * Guarda una foto del estado actual. Si `asBaseline` es true, primero
   * desmarca cualquier punto de partida previo de este negocio (solo puede
   * haber uno activo a la vez).
   */
  static async saveSnapshot(
    businessId: string,
    audit: UnifiedBusinessAudit,
    metrics: AuditSnapshotMetrics,
    asBaseline: boolean
  ): Promise<boolean> {
    try {
      if (asBaseline) {
        await supabase
          .from('intelligence_audit_snapshots')
          .update({ is_baseline: false })
          .eq('business_id', businessId)
          .eq('is_baseline', true);
      }

      const { error } = await supabase.from('intelligence_audit_snapshots').insert({
        business_id: businessId,
        is_baseline: asBaseline,
        overall_score: audit.overall_score,
        category_scores: audit.categories,
        supporting_metrics: metrics,
      });

      if (error) {
        console.error('Error guardando snapshot de auditoría:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error guardando snapshot de auditoría:', err);
      return false;
    }
  }

  static async getBaseline(businessId: string): Promise<AuditSnapshot | null> {
    try {
      const { data, error } = await supabase
        .from('intelligence_audit_snapshots')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_baseline', true)
        .maybeSingle();

      if (error || !data) return null;
      return data as AuditSnapshot;
    } catch {
      return null;
    }
  }

  static async listSnapshots(businessId: string): Promise<AuditSnapshot[]> {
    try {
      const { data, error } = await supabase
        .from('intelligence_audit_snapshots')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: true });

      if (error || !data) return [];
      return data as AuditSnapshot[];
    } catch {
      return [];
    }
  }
}
