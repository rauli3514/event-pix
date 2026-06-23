import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, FolderPlus, Upload, LayoutGrid, List as ListIcon, Filter, Image as ImageIcon, Video, FileAudio, FileText, Globe, Box, ListVideo, ArrowRightCircle, Tag, MoreVertical } from 'lucide-react';
import { UploadMediaModal } from '@/components/display/UploadMediaModal';

// Mock data
const MOCK_FILES = [
    { id: '1', name: 'Festival de fans de imágenes', date: '23 de junio de 2026 - 04:11', type: 'image' },
    { id: '2', name: 'Promo Verano', date: '22 de junio de 2026 - 15:30', type: 'video' },
    { id: '3', name: 'Menú Digital Base', date: '20 de junio de 2026 - 10:15', type: 'image' }
];

export function WorkspaceMedia() {
    const [viewMode, setViewMode] = useState<'list'|'grid'>('list');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState('images');

    return (
        <div className="h-full flex flex-col bg-slate-50 text-slate-900">
            {/* Top Bar for sending to screens */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm z-10">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Imágenes</h1>
                    <p className="text-sm text-slate-500 mt-1">Gestiona y organiza todos tus recursos visuales.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="bg-white text-slate-600 border-slate-200 shadow-sm">
                        <Upload className="w-4 h-4 mr-2" />
                        Exportar
                    </Button>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white shadow-md">
                        Enviar a las pantallas
                        <ArrowRightCircle className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar - Categories */}
                <div className="w-64 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
                    <div className="p-4 space-y-6">
                        {/* Todos los medios section */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-3">Todos los medios</h3>
                            <div className="space-y-1">
                                <CategoryButton 
                                    icon={ImageIcon} label="Imágenes" active={activeCategory === 'images'} 
                                    onClick={() => setActiveCategory('images')} 
                                    color="text-orange-500" 
                                />
                                <CategoryButton 
                                    icon={Video} label="Vídeos" active={activeCategory === 'videos'} 
                                    onClick={() => setActiveCategory('videos')} 
                                />
                                <CategoryButton 
                                    icon={FileAudio} label="Audio" active={activeCategory === 'audio'} 
                                    onClick={() => setActiveCategory('audio')} 
                                />
                                <CategoryButton 
                                    icon={FileText} label="Documentos" active={activeCategory === 'docs'} 
                                    onClick={() => setActiveCategory('docs')} 
                                />
                                <CategoryButton 
                                    icon={Globe} label="Páginas web" active={activeCategory === 'web'} 
                                    onClick={() => setActiveCategory('web')} 
                                />
                            </div>
                        </div>

                        {/* Other sections */}
                        <div className="border-t border-slate-100 pt-6">
                            <div className="space-y-1">
                                <CategoryButton icon={Box} label="Aplicaciones" />
                                <CategoryButton icon={ListVideo} label="Listas de reproducción" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col bg-slate-50/50">
                    <div className="p-6">
                        {/* Toolbar */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3 flex-1 max-w-xl">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <Input 
                                        placeholder="Buscar en Todos los artículos..." 
                                        className="pl-9 bg-white shadow-sm border-slate-200"
                                    />
                                </div>
                                <Button variant="outline" className="bg-white shadow-sm border-slate-200 text-slate-600">
                                    <Tag className="w-4 h-4 mr-2" /> Etiquetas
                                </Button>
                            </div>

                            <div className="flex items-center gap-3">
                                <Button variant="outline" size="icon" className="bg-white shadow-sm border-slate-200">
                                    <Filter className="w-4 h-4 text-slate-600" />
                                </Button>
                                <Button variant="outline" className="bg-white shadow-sm border-slate-200 text-slate-700">
                                    <FolderPlus className="w-4 h-4 mr-2" />
                                    Agregar carpeta
                                </Button>
                                <div className="flex bg-slate-200/50 p-1 rounded-md border border-slate-200">
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'grid' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setViewMode('grid')}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" size="sm" 
                                        className={`h-8 px-2 ${viewMode === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                        onClick={() => setViewMode('list')}
                                    >
                                        <ListIcon className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* List Header */}
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-slate-800">Todos los artículos</h2>
                            <p className="text-sm text-slate-500 mt-1">{MOCK_FILES.length} artículo(s) | Por página: 10</p>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200">
                                        <th className="px-4 py-3 w-12"><input type="checkbox" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/20" /></th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Modificado</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Etiquetas</th>
                                        <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Comportamiento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {MOCK_FILES.map(file => (
                                        <tr key={file.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-4 py-4"><input type="checkbox" className="rounded border-slate-300 text-orange-500 focus:ring-orange-500/20" /></td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                        <ImageIcon className="w-5 h-5 text-slate-400" />
                                                    </div>
                                                    <span className="font-medium text-slate-700">{file.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-sm text-slate-500">{file.date}</td>
                                            <td className="px-4 py-4">
                                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded">sin etiquetas</span>
                                            </td>
                                            <td className="px-4 py-4 text-right">
                                                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600">
                                                    <MoreVertical className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Bottom Actions */}
                        <div className="mt-6 flex items-center gap-4">
                            <Button 
                                onClick={() => setIsUploadModalOpen(true)}
                                className="bg-orange-500 hover:bg-orange-600 text-white shadow-md font-medium"
                            >
                                Agregar imagen
                            </Button>
                            <Button variant="outline" className="bg-white shadow-sm border-slate-200 text-slate-600">
                                Comportamiento
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <UploadMediaModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
            />
        </div>
    );
}

// Sidebar Button Helper
function CategoryButton({ icon: Icon, label, active, onClick, color }: any) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-slate-600 hover:bg-slate-100'}`}
        >
            <Icon className={`w-4 h-4 ${active ? color || 'text-orange-500' : 'text-slate-400'}`} />
            {label}
        </button>
    );
}
