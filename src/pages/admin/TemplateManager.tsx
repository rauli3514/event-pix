import { useState } from 'react';
import { useTemplateCategories, useCreateTemplateCategory, useDeleteTemplateCategory, useTemplates, useCreateTemplate, useDeleteTemplate } from '@/hooks/use-display-templates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, LayoutTemplate, PenTool, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function TemplateManager() {
    const { data: categories = [] } = useTemplateCategories();
    const createCategory = useCreateTemplateCategory();
    const deleteCategory = useDeleteTemplateCategory();

    const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
    const [newCat, setNewCat] = useState({ name: '', icon: '' });

    const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
    const { data: templates = [] } = useTemplates(selectedCatId || undefined);
    const createTemplate = useCreateTemplate();
    const deleteTemplate = useDeleteTemplate();

    const [isCreateTempOpen, setIsCreateTempOpen] = useState(false);
    const [newTemp, setNewTemp] = useState({ 
        name: '', description: '', thumbnail_url: '', canva_url: '', orientation: 'vertical', format: '1080x1920'
    });

    const handleCreateCat = (e: React.FormEvent) => {
        e.preventDefault();
        createCategory.mutate(newCat, {
            onSuccess: () => {
                setIsCreateCatOpen(false);
                setNewCat({ name: '', icon: '' });
            }
        });
    };

    const handleCreateTemp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCatId) return;
        createTemplate.mutate({ ...newTemp, category_id: selectedCatId } as any, {
            onSuccess: () => {
                setIsCreateTempOpen(false);
                setNewTemp({ name: '', description: '', thumbnail_url: '', canva_url: '', orientation: 'vertical', format: '1080x1920' });
            }
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <PenTool className="w-5 h-5 text-[#00C4CC]" />
                    Gestión de Plantillas Canva
                </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Categorías */}
                <div className="col-span-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-semibold text-white">Categorías</h3>
                        <Dialog open={isCreateCatOpen} onOpenChange={setIsCreateCatOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" className="bg-[#00C4CC] hover:bg-[#00B2B9] text-white border-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                                <DialogHeader>
                                    <DialogTitle>Nueva Categoría</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleCreateCat} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nombre (Ej: Restaurantes)</Label>
                                        <Input value={newCat.name} onChange={(e) => setNewCat({...newCat, name: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ícono (Emoji o texto, Ej: 🍔)</Label>
                                        <Input value={newCat.icon} onChange={(e) => setNewCat({...newCat, icon: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                    </div>
                                    <Button type="submit" className="w-full bg-[#00C4CC] hover:bg-[#00B2B9] text-white">Crear</Button>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="space-y-2">
                        {categories.map(cat => (
                            <div 
                                key={cat.id} 
                                onClick={() => setSelectedCatId(cat.id)}
                                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${selectedCatId === cat.id ? 'bg-[#00C4CC]/10 border-[#00C4CC]/50' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{cat.icon}</span>
                                    <span className="text-sm font-medium text-white">{cat.name}</span>
                                </div>
                                <Button 
                                    size="icon" variant="ghost" className="text-red-500 hover:bg-red-950/30 hover:text-red-400 h-8 w-8"
                                    onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar categoría?')) deleteCategory.mutate(cat.id); }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        ))}
                        {categories.length === 0 && <p className="text-xs text-slate-500 text-center py-4">No hay categorías</p>}
                    </div>
                </div>

                {/* Plantillas de la Categoría */}
                <div className="col-span-2 bg-slate-900/50 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-6">
                    {!selectedCatId ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 min-h-[300px]">
                            <LayoutTemplate className="w-12 h-12 mb-4 opacity-50" />
                            <p>Selecciona una categoría para ver sus plantillas</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-semibold text-white">Plantillas en {categories.find(c => c.id === selectedCatId)?.name}</h3>
                                <Dialog open={isCreateTempOpen} onOpenChange={setIsCreateTempOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="bg-[#00C4CC] hover:bg-[#00B2B9] text-white border-0">
                                            <Plus className="w-4 h-4 mr-2" /> Agregar Plantilla
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>Nueva Plantilla Canva</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleCreateTemp} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Nombre de la Plantilla</Label>
                                                <Input value={newTemp.name} onChange={(e) => setNewTemp({...newTemp, name: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>URL de Miniatura (PNG/JPG)</Label>
                                                <Input value={newTemp.thumbnail_url} onChange={(e) => setNewTemp({...newTemp, thumbnail_url: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Enlace de Plantilla de Canva (URL)</Label>
                                                <Input value={newTemp.canva_url} onChange={(e) => setNewTemp({...newTemp, canva_url: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Orientación</Label>
                                                    <select 
                                                        className="w-full h-10 px-3 rounded-md bg-slate-950 border-slate-700 text-white text-sm"
                                                        value={newTemp.orientation}
                                                        onChange={(e) => setNewTemp({...newTemp, orientation: e.target.value})}
                                                    >
                                                        <option value="vertical">Vertical</option>
                                                        <option value="horizontal">Horizontal</option>
                                                        <option value="square">Cuadrado</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Breve Descripción</Label>
                                                <Input value={newTemp.description} onChange={(e) => setNewTemp({...newTemp, description: e.target.value})} className="bg-slate-950 border-slate-700 text-white" />
                                            </div>
                                            <Button type="submit" className="w-full bg-[#00C4CC] hover:bg-[#00B2B9] text-white mt-4">Crear Plantilla</Button>
                                        </form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {templates.map(temp => (
                                    <Card key={temp.id} className="bg-slate-950 border-slate-800 overflow-hidden flex flex-col group">
                                        <div className="aspect-[4/3] bg-slate-900 relative">
                                            {temp.thumbnail_url ? (
                                                <img src={temp.thumbnail_url} alt={temp.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-slate-700"><LayoutTemplate className="w-8 h-8" /></div>
                                            )}
                                        </div>
                                        <div className="p-4 flex-1 flex flex-col">
                                            <h4 className="font-semibold text-white text-sm">{temp.name}</h4>
                                            <p className="text-xs text-slate-400 mt-1">{temp.orientation}</p>
                                            
                                            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between gap-2 mt-auto">
                                                <Button size="sm" variant="outline" className="flex-1 bg-transparent border-slate-700 hover:bg-slate-800 text-xs" onClick={() => window.open(temp.canva_url, '_blank')}>
                                                    <ExternalLink className="w-3 h-3 mr-1" /> Canva
                                                </Button>
                                                <Button size="icon" variant="outline" className="text-red-500 border-slate-700 hover:bg-red-950/30 w-8 h-8 shrink-0" onClick={() => { if(confirm('¿Eliminar plantilla?')) deleteTemplate.mutate(temp.id); }}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                                {templates.length === 0 && <p className="col-span-2 text-xs text-slate-500 text-center py-8">No hay plantillas en esta categoría.</p>}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
