import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HardDrive, UploadCloud, Images, Box, PlaySquare, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadMediaModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TABS = [
    { id: 'upload', label: 'Subir' },
    { id: 'images', label: 'Imágenes' },
    { id: 'videos', label: 'Vídeos' },
    { id: 'audio', label: 'Audio' },
    { id: 'docs', label: 'Documentos' },
    { id: 'web', label: 'Páginas web' }
];

const SOURCES = [
    { id: 'device', label: 'Mi dispositivo', icon: HardDrive, color: 'text-orange-500', bg: 'bg-orange-50' },
    { id: 'onedrive', label: 'OneDrive', icon: UploadCloud, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'sharepoint', label: 'SharePoint', icon: Box, color: 'text-teal-600', bg: 'bg-teal-50' },
    { id: 'dropbox', label: 'Dropbox', icon: Box, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'gdrive', label: 'Google Drive', icon: PlaySquare, color: 'text-green-500', bg: 'bg-green-50' }, // Mock icons for now
    { id: 'gphotos', label: 'Google Fotos', icon: Images, color: 'text-red-400', bg: 'bg-red-50' }
];

export const UploadMediaModal = ({ isOpen, onClose }: UploadMediaModalProps) => {
    const [activeTab, setActiveTab] = useState('upload');
    const [selectedSource, setSelectedSource] = useState('device');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between bg-white">
                    <DialogTitle className="text-xl font-bold">
                        Todos los medios
                    </DialogTitle>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex px-6 border-b border-slate-200 bg-white overflow-x-auto hide-scrollbar">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "px-6 py-4 font-medium text-sm transition-colors whitespace-nowrap",
                                activeTab === tab.id 
                                    ? "text-orange-500 border-b-2 border-orange-500" 
                                    : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="p-8 bg-slate-50/50 flex-1 overflow-y-auto">
                    {activeTab === 'upload' && (
                        <div className="max-w-2xl mx-auto text-center space-y-12">
                            <h2 className="text-2xl font-medium text-slate-700">
                                Arrastra y suelta, <span className="text-orange-500 cursor-pointer hover:underline">busca</span> o importa desde:
                            </h2>

                            <div className="flex flex-wrap justify-center gap-6">
                                {SOURCES.map(source => (
                                    <button 
                                        key={source.id}
                                        onClick={() => setSelectedSource(source.id)}
                                        className="flex flex-col items-center gap-3 group outline-none"
                                    >
                                        <div className={cn(
                                            "w-20 h-20 bg-white rounded-2xl flex items-center justify-center border shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md",
                                            selectedSource === source.id ? "border-orange-400 ring-2 ring-orange-400/20" : "border-slate-100"
                                        )}>
                                            <source.icon className={cn("w-8 h-8", source.color)} />
                                        </div>
                                        <span className={cn(
                                            "text-sm font-medium transition-colors",
                                            selectedSource === source.id ? "text-slate-900" : "text-slate-600 group-hover:text-slate-900"
                                        )}>
                                            {source.label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-4 pt-8">
                                <p className="text-slate-500 text-sm">
                                    Los formatos de archivo compatibles incluyen JPG, PNG, MP3, WAV, MP4, PDF, PPT, DOC y XLSX, <span className="text-orange-500 cursor-pointer">entre otros.</span>
                                </p>
                                <p className="text-slate-600 font-medium text-sm">
                                    Límite de importación de medios: <span className="font-bold">100 archivos</span>
                                </p>
                                
                                <p className="text-slate-400 text-sm mt-6">
                                    💡 ¿Utilizas otro servicio? <span className="text-orange-500 cursor-pointer">Sugiere el tuyo aquí.</span>
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {activeTab !== 'upload' && (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <FileText className="w-12 h-12 mb-4 opacity-20" />
                            <p>Selecciona la pestaña "Subir" para agregar nuevos {TABS.find(t => t.id === activeTab)?.label.toLowerCase()}.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="bg-slate-100 border-0 hover:bg-slate-200 text-slate-700 font-medium">
                        Cancelar
                    </Button>
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-8 shadow-sm">
                        Subir
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
