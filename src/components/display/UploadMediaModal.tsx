import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HardDrive, UploadCloud, FileText, Image as ImageIcon, Video, FileAudio } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadMediaModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload?: (files: FileList | null) => void;
}

export const UploadMediaModal = ({ isOpen, onClose, onUpload }: UploadMediaModalProps) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            if (onUpload) onUpload(e.dataTransfer.files);
            onClose();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            if (onUpload) onUpload(e.target.files);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-white text-slate-900 border-0 shadow-2xl max-w-2xl p-0 overflow-hidden sm:rounded-xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 flex flex-row items-center justify-between bg-white">
                    <DialogTitle className="text-xl font-bold">
                        Subir Archivos
                    </DialogTitle>
                </DialogHeader>

                <div className="p-8 bg-slate-50 flex-1 overflow-y-auto">
                    <div className="max-w-xl mx-auto text-center space-y-6">
                        
                        <div 
                            className={cn(
                                "border-2 border-dashed rounded-2xl p-12 transition-colors flex flex-col items-center justify-center cursor-pointer",
                                isDragging ? "border-orange-500 bg-orange-50" : "border-slate-300 hover:border-orange-400 hover:bg-slate-50 bg-white"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <input 
                                id="file-upload" 
                                type="file" 
                                className="hidden" 
                                multiple 
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
                                onChange={handleFileChange}
                            />
                            
                            <UploadCloud className={cn("w-16 h-16 mb-4", isDragging ? "text-orange-500" : "text-slate-400")} />
                            
                            <h2 className="text-2xl font-medium text-slate-700 mb-2">
                                Arrastra y suelta tus archivos aquí
                            </h2>
                            <p className="text-slate-500 mb-6">
                                o haz clic para buscar en tu dispositivo
                            </p>

                            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-8 shadow-sm" onClick={(e) => { e.stopPropagation(); document.getElementById('file-upload')?.click(); }}>
                                <HardDrive className="w-4 h-4 mr-2" />
                                Seleccionar de Mi Dispositivo
                            </Button>
                        </div>

                        <div className="space-y-4 pt-4">
                            <div className="flex items-center justify-center gap-6 text-slate-400">
                                <div className="flex items-center gap-1"><ImageIcon className="w-4 h-4" /> JPG, PNG</div>
                                <div className="flex items-center gap-1"><Video className="w-4 h-4" /> MP4</div>
                                <div className="flex items-center gap-1"><FileAudio className="w-4 h-4" /> MP3</div>
                                <div className="flex items-center gap-1"><FileText className="w-4 h-4" /> PDF, DOCX</div>
                            </div>
                            <p className="text-slate-500 text-xs">
                                Límite de tamaño: 50MB por archivo.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} className="bg-slate-100 border-0 hover:bg-slate-200 text-slate-700 font-medium">
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
