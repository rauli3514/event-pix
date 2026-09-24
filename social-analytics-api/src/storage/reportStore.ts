import { ProfileReport } from '../types/profile.js';

/**
 * Almacenamiento en memoria de los reportes generados. Alcanza para desarrollo
 * y demos; si se necesita persistencia entre reinicios o multiples instancias,
 * reemplazar esta clase por una respaldada en una base de datos (misma interfaz).
 */
class ReportStore {
  private reports = new Map<string, ProfileReport>();

  save(report: ProfileReport): void {
    this.reports.set(report.id, report);
  }

  getById(id: string): ProfileReport | undefined {
    return this.reports.get(id);
  }

  list(): ProfileReport[] {
    return [...this.reports.values()].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }
}

export const reportStore = new ReportStore();
