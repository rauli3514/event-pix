import { useState, useMemo } from 'react';
import { useTemplateCategories, useTemplates } from '@/hooks/use-display-templates';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Eye, PenTool, LayoutTemplate, MonitorSmartphone, Monitor, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WorkspaceTemplates() {
    const { data: categories = [], isLoading: loadingCats } = useTemplateCategories();
    // Cargamos todas las plantillas desde el inicio
    const { data: allTemplates = [], isLoading: loadingTemps } = useTemplates();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
    const [selectedOrientation, setSelectedOrientation] = useState<string>('all');

    // Filtrado local instantáneo
    const filteredTemplates = useMemo(() => {
        return allTemplates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                  t.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategoryId === 'all' || t.category_id === selectedCategoryId;
            const matchesOrientation = selectedOrientation === 'all' || t.orientation === selectedOrientation;
            return matchesSearch && matchesCategory && matchesOrientation;
        });
    }, [allTemplates, searchQuery, selectedCategoryId, selectedOrientation]);

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground overflow-hidden">
            
            {/* Header & Filtros (Fijo en la parte superior) */}
            <div className="shrink-0 bg-card border-b border-border z-10 flex flex-col">
                {/* Título y Búsqueda */}
                <div className="px-6 py-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                    <div>
                        <h1 className="text-2xl font-bold font-[Orbitron] text-foreground tracking-tight flex items-center gap-2">
                            <Layers className="w-6 h-6 text-[#00C4CC]" /> Centro de Plantillas
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">Explora, filtra y edita diseños listos para usar en tus pantallas.</p>
                    </div>
                    
                    <div className="relative w-full md:w-80">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar plantilla..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-muted/50 border-border focus-visible:ring-[#00C4CC]"
                        />
                    </div>
                </div>

                {/* Filtros Rápidos (Categorías y Orientación) */}
                <div className="px-6 py-3 border-t border-border/50 bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    {/* Pills de Categorías */}
                    <div className="flex items-center gap-2 overflow-x-auto w-full pb-2 sm:pb-0 scrollbar-none">
                        <Button
                            variant={selectedCategoryId === 'all' ? 'default' : 'outline'}
                            onClick={() => setSelectedCategoryId('all')}
                            className={cn("rounded-full h-8 px-4 text-xs shrink-0 transition-all", 
                                selectedCategoryId === 'all' ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent" : "bg-card text-muted-foreground border-border hover:bg-muted"
                            )}
                        >
                            Todas
                        </Button>
                        {!loadingCats && categories.map(cat => (
                            <Button
                                key={cat.id}
                                variant={selectedCategoryId === cat.id ? 'default' : 'outline'}
                                onClick={() => setSelectedCategoryId(cat.id)}
                                className={cn("rounded-full h-8 px-4 text-xs shrink-0 transition-all flex items-center gap-1.5", 
                                    selectedCategoryId === cat.id ? "bg-indigo-600 hover:bg-indigo-700 text-white border-transparent" : "bg-card text-muted-foreground border-border hover:bg-muted"
                                )}
                            >
                                <span>{cat.icon}</span> {cat.name}
                            </Button>
                        ))}
                    </div>

                    {/* Filtro de Orientación */}
                    <div className="flex items-center bg-card rounded-lg border border-border p-1 shrink-0 shadow-sm">
                        <button
                            onClick={() => setSelectedOrientation('all')}
                            className={cn("px-3 py-1.5 text-xs rounded-md transition-colors font-medium", selectedOrientation === 'all' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setSelectedOrientation('horizontal')}
                            className={cn("px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 font-medium", selectedOrientation === 'horizontal' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            <Monitor className="w-3.5 h-3.5" /> Horizontales
                        </button>
                        <button
                            onClick={() => setSelectedOrientation('vertical')}
                            className={cn("px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 font-medium", selectedOrientation === 'vertical' ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            <MonitorSmartphone className="w-3.5 h-3.5" /> Verticales
                        </button>
                    </div>
                </div>
            </div>

            {/* Grid de Plantillas */}
            <div className="flex-1 overflow-y-auto p-6 bg-background/50">
                {loadingTemps ? (
                    <div className="flex items-center justify-center h-40">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00C4CC]"></div>
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-8 border border-dashed border-border rounded-3xl bg-card/30 max-w-lg mx-auto">
                        <LayoutTemplate className="w-16 h-16 text-muted-foreground/30 mb-4" />
                        <h3 className="text-xl font-bold text-foreground">No hay plantillas</h3>
                        <p className="text-muted-foreground mt-2">No encontramos plantillas que coincidan con tus filtros. Intenta cambiar la categoría o la orientación.</p>
                        <Button 
                            variant="outline" 
                            className="mt-6 border-border text-foreground hover:bg-muted"
                            onClick={() => {
                                setSearchQuery('');
                                setSelectedCategoryId('all');
                                setSelectedOrientation('all');
                            }}
                        >
                            Limpiar Filtros
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 pb-20">
                        {filteredTemplates.map(template => (
                            <Card key={template.id} className="overflow-hidden bg-card border-border flex flex-col group hover:border-[#00C4CC]/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                                <div className={cn("bg-zinc-900 relative overflow-hidden flex items-center justify-center border-b border-border/50", template.orientation === 'vertical' ? "aspect-[9/16]" : "aspect-video")}>
                                    {template.thumbnail_url ? (
                                        <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                                            <LayoutTemplate className="w-10 h-10 mb-2 opacity-30" />
                                            <span className="text-xs">Sin Vista Previa</span>
                                        </div>
                                    )}
                                    
                                    {/* Insignia de Orientación */}
                                    <div className="absolute top-2 left-2">
                                        {template.orientation === 'vertical' ? (
                                            <span className="bg-black/70 backdrop-blur-md text-white text-[10px] font-medium px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 shadow-sm">
                                                <MonitorSmartphone className="w-3 h-3 text-[#00C4CC]"/> Vertical
                                            </span>
                                        ) : (
                                            <span className="bg-black/70 backdrop-blur-md text-white text-[10px] font-medium px-2 py-1 rounded-md border border-white/10 flex items-center gap-1 shadow-sm">
                                                <Monitor className="w-3 h-3 text-[#00C4CC]"/> Horizontal
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Capa Hover (Glassmorphism) con botones */}
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 p-4">
                                        <Button asChild className="w-full bg-[#00C4CC] hover:bg-[#00B2B9] text-white shadow-lg shadow-[#00C4CC]/30 font-medium">
                                            <a href={template.canva_url} target="_blank" rel="noopener noreferrer">
                                                <PenTool className="w-4 h-4 mr-2" /> Usar Plantilla
                                            </a>
                                        </Button>
                                        <Button variant="secondary" className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-md" onClick={() => window.open(template.thumbnail_url || template.canva_url, '_blank')}>
                                            <Eye className="w-4 h-4 mr-2" /> Ver en Grande
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col flex-1 bg-gradient-to-b from-card to-card/50">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <h3 className="font-semibold text-foreground text-base leading-tight">{template.name}</h3>
                                        <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0 border border-border/50">
                                            {categories.find(c => c.id === template.category_id)?.name || 'General'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{template.description}</p>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
