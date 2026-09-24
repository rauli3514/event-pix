// ================================================================
// ProductCatalogManager.tsx
// Catálogo de productos por negocio, con foto — lo usa el bot de
// WhatsApp para responder preguntas de producto con la imagen real.
// EventPix Intelligence — SaaS Platform
// ================================================================

import React, { useEffect, useState } from 'react';
import { Package, Plus, Trash2, Loader2, ImagePlus, Pencil, Check } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { toast } from 'sonner';

interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  is_active: boolean;
}

interface ProductCatalogManagerProps {
  businessId: string;
}

const emptyDraft = { name: '', description: '', price: '' };

export const ProductCatalogManager: React.FC<ProductCatalogManagerProps> = ({ businessId }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [draftImageFile, setDraftImageFile] = useState<File | null>(null);

  const loadProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('intelligence_business_products')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (!error && data) setProducts(data as Product[]);
    setLoading(false);
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${businessId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('product-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });
    if (error) {
      toast.error('No se pudo subir la foto: ' + error.message);
      return null;
    }
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path);
    return data.publicUrl;
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      toast.error('Ponele un nombre al producto');
      return;
    }
    setUploadingId('new');
    let imageUrl: string | null = null;
    if (draftImageFile) {
      imageUrl = await uploadImage(draftImageFile);
    }

    const { error } = await supabase.from('intelligence_business_products').insert({
      business_id: businessId,
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      price: draft.price ? Number(draft.price) : null,
      image_url: imageUrl,
      is_active: true
    });

    setUploadingId(null);
    if (error) {
      toast.error('Error al guardar el producto: ' + error.message);
      return;
    }
    toast.success('Producto agregado al catálogo');
    setDraft(emptyDraft);
    setDraftImageFile(null);
    setIsAdding(false);
    loadProducts();
  };

  const handleReplaceImage = async (product: Product, file: File) => {
    setUploadingId(product.id);
    const imageUrl = await uploadImage(file);
    if (imageUrl) {
      await supabase.from('intelligence_business_products').update({ image_url: imageUrl }).eq('id', product.id);
      loadProducts();
    }
    setUploadingId(null);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('intelligence_business_products').delete().eq('id', id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  const handleToggleActive = async (product: Product) => {
    await supabase
      .from('intelligence_business_products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    loadProducts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-100 font-serif tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-pink-400" />
            Catálogo de Productos ({products.length})
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            El bot de WhatsApp usa este catálogo para responder con la foto y el precio real cuando un cliente pregunta por un producto.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white text-xs font-bold shadow-md shadow-pink-600/20 transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo Producto
        </button>
      </div>

      {isAdding && (
        <div className="p-4 rounded-xl bg-slate-950 border border-pink-500/40 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-pink-300">Agregar producto al catálogo</span>
            <button
              type="button"
              onClick={() => { setIsAdding(false); setDraft(emptyDraft); setDraftImageFile(null); }}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Nombre del producto *</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Ej: Pantalla Vertical 55&quot;"
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Precio (opcional)</label>
              <input
                type="number"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                placeholder="Ej: 450000"
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs font-mono text-slate-100 outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Descripción</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Lo que la IA le va a contar al cliente sobre este producto"
              rows={2}
              className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-slate-100 outline-none focus:border-pink-500 resize-none"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Foto del producto</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setDraftImageFile(e.target.files?.[0] || null)}
              className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:text-xs"
            />
          </div>

          <button
            type="button"
            onClick={handleCreate}
            disabled={uploadingId === 'new'}
            className="w-full py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2"
          >
            {uploadingId === 'new' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Guardar Producto
          </button>
        </div>
      )}

      {products.length === 0 && !isAdding && (
        <div className="text-center py-10 text-slate-500 text-xs">
          Todavía no cargaste ningún producto. Los que agregues acá son los que el bot puede recomendar y mostrar por foto.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {products.map((product) => (
          <div
            key={product.id}
            className={`rounded-xl border overflow-hidden ${product.is_active ? 'border-slate-800 bg-slate-950' : 'border-slate-800/50 bg-slate-950/50 opacity-60'}`}
          >
            <div className="relative aspect-video bg-slate-900 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <ImagePlus className="w-6 h-6 text-slate-600" />
              )}
              <label className="absolute bottom-2 right-2 w-7 h-7 rounded-lg bg-slate-950/90 border border-slate-700 flex items-center justify-center cursor-pointer hover:border-pink-500/60">
                {uploadingId === product.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-400" />
                ) : (
                  <Pencil className="w-3.5 h-3.5 text-slate-300" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleReplaceImage(product, file);
                  }}
                />
              </label>
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-slate-100">{product.name}</span>
                <button
                  type="button"
                  onClick={() => handleDelete(product.id)}
                  className="text-slate-500 hover:text-rose-400 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {product.price !== null && (
                <div className="text-xs font-mono text-emerald-400">${product.price.toLocaleString('es-AR')}</div>
              )}
              {product.description && (
                <p className="text-[11px] text-slate-400 line-clamp-2">{product.description}</p>
              )}
              <button
                type="button"
                onClick={() => handleToggleActive(product)}
                className={`mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  product.is_active
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-500 border border-slate-700'
                }`}
              >
                {product.is_active ? 'Visible para el bot' : 'Oculto'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
