import { useState, useRef } from 'react';
import { 
    useTemplateCategories, 
    useCreateTemplateCategory, 
    useDeleteTemplateCategory, 
    useUpdateTemplateCategory,
    useTemplates, 
    useCreateTemplate, 
    useDeleteTemplate,
    useUpdateTemplate
} from '@/hooks/use-display-templates';
import { useUploadEventImage } from '@/hooks/use-event-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2, Plus, LayoutTemplate, PenTool, ExternalLink, Edit, Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

export default function TemplateManager() {
    const { data: categories = [] } = useTemplateCategories();
    const createCategory = useCreateTemplateCategory();
    const updateCategory = useUpdateTemplateCategory();
    const deleteCategory = useDeleteTemplateCategory();
    const uploadImage = useUploadEventImage();

    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [catForm, setCatForm] = useState({ id: '', name: '', icon: '' });
    const [isCatEdit, setIsCatEdit] = useState(false);

    const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
    const { data: templates = [] } = useTemplates(selectedCatId || undefined);
    const createTemplate = useCreateTemplate();
    const updateTemplate = useUpdateTemplate();
    const deleteTemplate = useDeleteTemplate();

    const [isTempModalOpen, setIsTempModalOpen] = useState(false);
    const [tempForm, setTempForm] = useState({ 
        id: '', name: '', description: '', thumbnail_url: '', canva_url: '', orientation: 'vertical', format: '1080x1920'
    });
    const [isTempEdit, setIsTempEdit] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Category Actions ---
    const openCreateCat = () => {
        setCatForm({ id: '', name: '', icon: '' });
        setIsCatEdit(false);
        setIsCatModalOpen(true);
    };

    const openEditCat = (cat: any) => {
        setCatForm({ id: cat.id, name: cat.name, icon: cat.icon });
        setIsCatEdit(true);
        setIsCatModalOpen(true);
    };

    const handleSaveCat = (e: React.FormEvent) => {
        e.preventDefault();
        if (isCatEdit) {
            updateCategory.mutate({ id: catForm.id, updates: { name: catForm.name, icon: catForm.icon } }, {
                onSuccess: () => setIsCatModalOpen(false)
            });
        } else {
            createCategory.mutate({ name: catForm.name, icon: catForm.icon }, {
                onSuccess: () => setIsCatModalOpen(false)
            });
        }
    };

    // --- Template Actions ---
    const openCreateTemp = () => {
        setTempForm({ id: '', name: '', description: '', thumbnail_url: '', canva_url: '', orientation: 'vertical', format: '1080x1920' });
        setIsTempEdit(false);
        setIsTempModalOpen(true);
    };

    const openEditTemp = (temp: any) => {
        setTempForm({ 
            id: temp.id, name: temp.name, description: temp.description || '', 
            thumbnail_url: temp.thumbnail_url || '', canva_url: temp.canva_url || '', 
            orientation: temp.orientation || 'vertical', format: temp.format || '1080x1920' 
        });
        setIsTempEdit(true);
        setIsTempModalOpen(true);
    };

    const handleSaveTemp = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCatId && !isTempEdit) return;
        
        if (isTempEdit) {
            updateTemplate.mutate({ id: tempForm.id, updates: { ...tempForm } as any }, {
                onSuccess: () => setIsTempModalOpen(false)
            });
        } else {
            createTemplate.mutate({ ...tempForm, category_id: selectedCatId } as any, {
                onSuccess: () => setIsTempModalOpen(false)
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            toast.info("Subiendo imagen...");
            const url = await uploadImage.mutateAsync(file);
            setTempForm(prev => ({ ...prev, thumbnail_url: url }));
            toast.success("Imagen subida");
        } catch (err: any) {
            toast.error("Error al subir imagen");
        }
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
                        <Dialog open={isCatModalOpen} onOpenChange={setIsCatModalOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" onClick={openCreateCat} className="bg-[#00C4CC] hover:bg-[#00B2B9] text-white border-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-900 border-slate-800 text-slate-100">
                                <DialogHeader>
                                    <DialogTitle>{isCatEdit ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
                                </DialogHeader>
                                <form onSubmit={handleSaveCat} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nombre (Ej: Restaurantes)</Label>
                                        <Input value={catForm.name} onChange={(e) => setCatForm({...catForm, name: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Ícono (Emoji o texto, Ej: 🍔)</Label>
                                        <Input value={catForm.icon} onChange={(e) => setCatForm({...catForm, icon: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                    </div>
                                    <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending} className="w-full bg-[#00C4CC] hover:bg-[#00B2B9] text-white">
                                        {isCatEdit ? 'Guardar Cambios' : 'Crear'}
                                    </Button>
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
                                <div className="flex items-center gap-3 truncate">
                                    <span className="text-xl shrink-0">{cat.icon}</span>
                                    <span className="text-sm font-medium text-white truncate">{cat.name}</span>
                                </div>
                                <div className="flex items-center shrink-0 ml-2">
                                    <Button 
                                        size="icon" variant="ghost" className="text-slate-400 hover:bg-slate-800 hover:text-white h-8 w-8"
                                        onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}
                                    >
                                        <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        size="icon" variant="ghost" className="text-red-500 hover:bg-red-950/30 hover:text-red-400 h-8 w-8"
                                        onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar categoría?')) deleteCategory.mutate(cat.id); }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
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
                                <Dialog open={isTempModalOpen} onOpenChange={setIsTempModalOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" onClick={openCreateTemp} className="bg-[#00C4CC] hover:bg-[#00B2B9] text-white border-0">
                                            <Plus className="w-4 h-4 mr-2" /> Agregar Plantilla
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
                                        <DialogHeader>
                                            <DialogTitle>{isTempEdit ? 'Editar Plantilla' : 'Nueva Plantilla Canva'}</DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleSaveTemp} className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>Nombre de la Plantilla</Label>
                                                <Input value={tempForm.name} onChange={(e) => setTempForm({...tempForm, name: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Imagen Miniatura</Label>
                                                <div className="flex gap-2">
                                                    <Input 
                                                        value={tempForm.thumbnail_url} 
                                                        onChange={(e) => setTempForm({...tempForm, thumbnail_url: e.target.value})} 
                                                        className="bg-slate-950 border-slate-700 text-white flex-1" 
                                                        placeholder="URL directa o súbela..."
                                                    />
                                                    <Button type="button" variant="secondary" className="shrink-0 bg-slate-800 hover:bg-slate-700 text-white" onClick={() => fileInputRef.current?.click()}>
                                                        <Upload className="w-4 h-4" />
                                                    </Button>
                                                    <input 
                                                        type="file" 
                                                        ref={fileInputRef} 
                                                        className="hidden" 
                                                        accept="image/*" 
                                                        onChange={handleFileUpload} 
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Enlace de Plantilla de Canva (URL)</Label>
                                                <Input value={tempForm.canva_url} onChange={(e) => setTempForm({...tempForm, canva_url: e.target.value})} className="bg-slate-950 border-slate-700 text-white" required />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Orientación</Label>
                                                    <select 
                                                        className="w-full h-10 px-3 rounded-md bg-slate-950 border-slate-700 text-white text-sm"
                                                        value={tempForm.orientation}
                                                        onChange={(e) => setTempForm({...tempForm, orientation: e.target.value})}
                                                    >
                                                        <option value="vertical">Vertical</option>
                                                        <option value="horizontal">Horizontal</option>
                                                        <option value="square">Cuadrado</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Breve Descripción</Label>
                                                <Input value={tempForm.description} onChange={(e) => setTempForm({...tempForm, description: e.target.value})} className="bg-slate-950 border-slate-700 text-white" />
                                            </div>
                                            <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending || uploadImage.isPending} className="w-full bg-[#00C4CC] hover:bg-[#00B2B9] text-white mt-4">
                                                {isTempEdit ? 'Guardar Cambios' : 'Crear Plantilla'}
                                            </Button>
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
                                            <div className="flex justify-between items-start gap-2">
                                                <h4 className="font-semibold text-white text-sm">{temp.name}</h4>
                                                <div className="flex -mt-1 -mr-1">
                                                    <Button size="icon" variant="ghost" className="text-slate-400 hover:text-white hover:bg-slate-800 w-6 h-6" onClick={() => openEditTemp(temp)}>
                                                        <Edit className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-400 hover:bg-red-950/30 w-6 h-6" onClick={() => { if(confirm('¿Eliminar plantilla?')) deleteTemplate.mutate(temp.id); }}>
                                                        <Trash2 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-1">{temp.orientation}</p>
                                            
                                            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between mt-auto">
                                                <Button size="sm" variant="outline" className="w-full bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-xs" onClick={() => window.open(temp.canva_url, '_blank')}>
                                                    <ExternalLink className="w-3 h-3 mr-2" /> Canva
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
