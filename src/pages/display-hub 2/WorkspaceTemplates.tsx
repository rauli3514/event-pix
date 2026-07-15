import { useState } from 'react';
import { useTemplateCategories, useTemplates } from '@/hooks/use-display-templates';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Eye, PenTool, LayoutTemplate, MonitorSmartphone, Monitor } from 'lucide-react';

export default function WorkspaceTemplates() {
    const { data: categories = [], isLoading: loadingCats } = useTemplateCategories();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    const { data: templates = [], isLoading: loadingTemps } = useTemplates(selectedCategoryId || undefined);

    const activeCategory = categories.find(c => c.id === selectedCategoryId);

    if (selectedCategoryId) {
        return (
            <div className="flex-1 flex flex-col h-full bg-background/50">
                <div className="p-4 md:p-6 border-b border-border bg-card shrink-0 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedCategoryId(null)} className="text-muted-foreground hover:text-foreground">
                            <ChevronLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h2 className="text-xl font-bold font-[Orbitron] text-foreground flex items-center gap-2">
                                {activeCategory?.icon} {activeCategory?.name}
                            </h2>
                            <p className="text-xs text-muted-foreground mt-1">Explora las plantillas y edítalas en Canva</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {loadingTemps ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                        </div>
                    ) : templates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-card/50 rounded-xl border border-border">
                            <LayoutTemplate className="w-12 h-12 text-muted-foreground/50 mb-4" />
                            <h3 className="text-lg font-medium text-foreground">No hay plantillas disponibles</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-md">Muy pronto agregaremos nuevas plantillas para esta categoría.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {templates.map(template => (
                                <Card key={template.id} className="overflow-hidden bg-card border-border flex flex-col group hover:border-indigo-500/50 transition-colors">
                                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                                        {template.thumbnail_url ? (
                                            <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                                <LayoutTemplate className="w-8 h-8 opacity-20" />
                                            </div>
                                        )}
                                        <div className="absolute top-2 right-2 flex gap-1">
                                            {template.orientation === 'vertical' && <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/10 flex items-center gap-1"><MonitorSmartphone className="w-3 h-3"/> Vertical</span>}
                                            {template.orientation === 'horizontal' && <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-md border border-white/10 flex items-center gap-1"><Monitor className="w-3 h-3"/> Horizontal</span>}
                                        </div>
                                    </div>
                                    <div className="p-4 flex flex-col flex-1">
                                        <h3 className="font-semibold text-foreground">{template.name}</h3>
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                                        
                                        <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-border mt-auto">
                                            <Button asChild className="w-full bg-[#00C4CC] hover:bg-[#00B2B9] text-white shadow-lg shadow-[#00C4CC]/20">
                                                <a href={template.canva_url} target="_blank" rel="noopener noreferrer">
                                                    <PenTool className="w-4 h-4 mr-2" /> Editar en Canva
                                                </a>
                                            </Button>
                                            <div className="flex gap-2">
                                                <Button variant="outline" className="flex-1 bg-transparent border-border hover:bg-muted" onClick={() => window.open(template.thumbnail_url || template.canva_url, '_blank')}>
                                                    <Eye className="w-4 h-4 mr-2" /> Vista Previa
                                                </Button>
                                                <Button variant="outline" className="flex-1 bg-transparent border-border hover:bg-muted" disabled>
                                                    Usar Plantilla
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground">
            {/* Banner superior */}
            <div className="p-4 md:p-8 pb-0 shrink-0">
                <div className="relative overflow-hidden rounded-3xl bg-card border border-border shadow-xl flex items-center min-h-[140px] px-6 md:px-10 py-6">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#00C4CC]/10 to-indigo-500/10 pointer-events-none" />
                    
                    <div className="relative z-10 w-full flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold font-[Orbitron] text-foreground tracking-tight">
                                Centro de <span className="text-[#00C4CC]">Plantillas</span>
                            </h1>
                            <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-xl">
                                Selecciona una categoría y comienza a crear contenido increíble usando nuestras plantillas listas para Canva.
                            </p>
                        </div>
                        <div className="hidden md:flex w-20 h-20 bg-card rounded-2xl border border-border items-center justify-center shadow-inner rotate-3">
                            <LayoutTemplate className="w-10 h-10 text-[#00C4CC]" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Categorías */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8">
                {loadingCats ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C4CC]"></div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setSelectedCategoryId(category.id)}
                                className="group flex flex-col items-center justify-center text-center p-6 md:p-8 bg-card border border-border rounded-2xl hover:bg-card/80 hover:border-[#00C4CC]/50 transition-all duration-300 hover:-translate-y-1 shadow-sm"
                            >
                                <div className="w-16 h-16 md:w-20 md:h-20 bg-muted rounded-2xl flex items-center justify-center text-3xl md:text-4xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                                    {category.icon || '📁'}
                                </div>
                                <h3 className="font-semibold text-foreground text-sm md:text-base">{category.name}</h3>
                            </button>
                        ))}
                        {categories.length === 0 && (
                            <div className="col-span-full py-12 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-card/50">
                                <LayoutTemplate className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                <p>Aún no hay categorías de plantillas disponibles.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
