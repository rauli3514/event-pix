// ================================================================
// ShopDePlumasSyncService.ts
// Sincronizador de Catálogo y Stock en Tiempo Real con Shop de Plumas
// EventPix Intelligence — SaaS Platform Multi-Tenant
// ================================================================

import { createClient } from '@supabase/supabase-js';
import { ShopProduct } from '../../types/connections';

export class ShopDePlumasSyncService {
  /**
   * Sincroniza productos y cotizaciones desde la base de datos de Shop de Plumas
   */
  static async syncCatalog(
    supabaseUrl: string,
    supabaseAnonKey: string
  ): Promise<{
    success: boolean;
    products: ShopProduct[];
    exchangeRate?: number;
    error?: string;
  }> {
    if (!supabaseUrl || !supabaseAnonKey) {
      return {
        success: false,
        products: [],
        error: 'URL de Supabase o clave anónima faltante.'
      };
    }

    try {
      const client = createClient(supabaseUrl, supabaseAnonKey);

      // 1. Obtener productos activos
      const { data: prodData, error: prodError } = await client
        .from('products')
        .select('*')
        .order('name', { ascending: true });

      if (prodError) {
        console.error('Error al consultar tabla products en Shop de Plumas:', prodError);
        return {
          success: false,
          products: [],
          error: `Error al leer productos: ${prodError.message}`
        };
      }

      // 2. Obtener cotización de divisa (USD -> ARS) si existe
      let usdRate: number | undefined = undefined;
      try {
        const { data: rateData } = await client
          .from('exchange_rates')
          .select('*')
          .eq('from_currency', 'USD')
          .eq('to_currency', 'ARS')
          .order('date', { ascending: false })
          .limit(1);

        if (rateData && rateData.length > 0) {
          usdRate = Number(rateData[0].rate);
        }
      } catch (e) {
        console.warn('No se pudo obtener exchange_rate de Shop de Plumas:', e);
      }

      const mappedProducts: ShopProduct[] = (prodData || []).map((p: any) => ({
        id: p.id,
        code: p.code || undefined,
        name: p.name,
        price: Number(p.price) || 0,
        cost: p.cost ? Number(p.cost) : undefined,
        stock: Number(p.stock) || 0,
        category: p.category || 'General',
        size: p.size || undefined,
        color: p.color || undefined,
        brand: p.brand || undefined,
        currency: p.currency || 'ARS',
        image_url: p.image_url || undefined,
        status: p.status || 'in_stock'
      }));

      return {
        success: true,
        products: mappedProducts,
        exchangeRate: usdRate
      };
    } catch (err: any) {
      console.error('Fallo en sincronización con Shop de Plumas:', err);
      return {
        success: false,
        products: [],
        error: err.message || 'Error de red al conectar con Supabase.'
      };
    }
  }

  /**
   * Busca productos coincidentes en el catálogo sincronizado
   */
  static searchMatchingProduct(query: string, products: ShopProduct[]): ShopProduct | null {
    if (!query.trim() || products.length === 0) return null;
    const q = query.toLowerCase().trim();

    // 1. Coincidencia exacta o parcial de nombre
    const exact = products.find(p => p.name.toLowerCase().includes(q));
    if (exact) return exact;

    // 2. Por código
    const byCode = products.find(p => p.code && p.code.toLowerCase() === q);
    if (byCode) return byCode;

    // 3. Por categoría
    const byCategory = products.find(p => p.category && p.category.toLowerCase().includes(q));
    if (byCategory) return byCategory;

    // 4. Token match
    const words = q.split(' ').filter(w => w.length > 2);
    for (const p of products) {
      const pName = p.name.toLowerCase();
      if (words.some(w => pName.includes(w))) {
        return p;
      }
    }

    return null;
  }

  /**
   * Formatea el precio del producto para respuestas conversacionales
   */
  static formatPriceText(product: ShopProduct, usdRate = 1200): string {
    if (product.currency === 'USD') {
      const inArs = Math.round(product.price * usdRate);
      return `$${product.price} USD (aprox $${inArs.toLocaleString('es-AR')} ARS)`;
    }
    return `$${product.price.toLocaleString('es-AR')} ARS`;
  }
}
