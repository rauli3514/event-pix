import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { AppId } from './AppCatalogModal';
import { DisplayMedia } from '@/types/display';
import { useUploadDisplayMedia, useUpdateDisplayMedia } from '@/hooks/use-display-media';
import { toast } from 'sonner';

import { WeatherForm, WeatherPreview } from './weather/WeatherApp';
import { SplitScreenForm, SplitScreenPreview } from './split-screen/SplitScreenApp';
import { DolarForm, DolarPreview } from './dolar/DolarApp';
// import { TickerForm, TickerPreview } from './ticker/TickerApp';

interface AppEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onBack: () => void;
    appId: AppId;
    commerceId: string;
    currentFolder: string;
    editingApp?: DisplayMedia;
}

export const AppEditorModal = ({ isOpen, onClose, onBack, appId, commerceId, currentFolder, editingApp }: AppEditorModalProps) => {
    const [appName, setAppName] = useState('');
    const [appConfig, setAppConfig] = useState<any>({});
    const uploadMedia = useUploadDisplayMedia();
    const updateMedia = useUpdateDisplayMedia();

    // Reset state when modal opens or editingApp changes
    useEffect(() => {
        if (isOpen) {
            setAppName(editingApp?.name || '');
            setAppConfig(editingApp?.metadata?.config || {});
        }
    }, [isOpen, editingApp]);

    // Dynamically select the Form and Preview components based on appId
    const renderForm = () => {
        switch (appId) {
            case 'weather':
                return <WeatherForm config={appConfig} onChange={setAppConfig} />;
            case 'split-screen':
                return <SplitScreenForm config={appConfig} onChange={setAppConfig} commerceId={commerceId} appName={appName} setAppName={setAppName} />;
            case 'dolar':
                return <DolarForm config={appConfig} onChange={setAppConfig} />;
            /*
            case 'ticker':
                return <TickerForm config={appConfig} onChange={setAppConfig} />;
            */
            default:
                return <div className="text-slate-500 p-4">App form not implemented yet.</div>;
        }
    };

    const renderPreview = () => {
        switch (appId) {
            case 'weather':
                return <WeatherPreview config={appConfig} />;
            case 'split-screen':
                return <SplitScreenPreview config={appConfig} />;
            case 'dolar':
                return <DolarPreview config={appConfig} />;
            /*
            case 'ticker':
                return <TickerPreview config={appConfig} />;
            */
            default:
                return <div className="text-slate-500 flex items-center justify-center h-full">App preview not implemented yet.</div>;
        }
    };

    const handleSave = async () => {
        if (!appName.trim()) {
            toast.error("Por favor, dale un nombre a tu App.");
            return;
        }

        const toastId = toast.loading("Guardando App...");
        try {
            const metadata = {
                appId,
                config: appConfig
            };

            if (editingApp) {
                // Update existing app
                await updateMedia.mutateAsync({
                    id: editingApp.id,
                    updates: {
                        name: appName.trim(),
                        metadata: metadata,
                        url: 'app://' + appId // ensure url matches if changed?
                    }
                });
            } else {
                // Create new app
                await uploadMedia.mutateAsync({
                    commerceId,
                    folderPath: currentFolder,
                    webUrl: 'app://' + appId,
                    webName: appName.trim(),
                    type: 'app',
                    metadata: metadata
                } as any);
            }

            toast.success("App guardada correctamente", { id: toastId });
            onClose();
        } catch (error) {
            console.error("Failed to save app:", error);
            toast.error("Error al guardar la App", { id: toastId });
        }
    };

    const isPending = uploadMedia.isPending || updateMedia.isPending;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0A101D] text-slate-200 border-slate-800 shadow-2xl max-w-7xl p-0 overflow-hidden sm:rounded-2xl h-[90vh] flex flex-col">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={onBack} className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <DialogTitle className="text-xl text-white font-semibold">Configurar App</DialogTitle>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
                            Cancelar
                        </Button>
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
                            onClick={handleSave}
                            disabled={isPending}
                        >
                            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                            {editingApp ? 'Guardar Cambios' : 'Guardar App'}
                        </Button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex flex-1 overflow-hidden">
                    
                    {/* Left Panel: Settings Form */}
                    <div className="w-full md:w-96 border-r border-slate-800 bg-slate-900 flex flex-col overflow-y-auto">
                        <div className="p-6 space-y-6">
                            {/* General Settings (Hidden for split-screen since it has its own tabs) */}
                            {appId !== 'split-screen' && (
                                <>
                                    <div className="space-y-3">
                                        <Label className="text-slate-300">Nombre de la App <span className="text-red-400">*</span></Label>
                                        <Input 
                                            placeholder="Ej: Clima Recepción" 
                                            value={appName}
                                            onChange={(e) => setAppName(e.target.value)}
                                            className="bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="h-px bg-slate-800 w-full" />
                                </>
                            )}

                            {/* App Specific Form */}
                            {renderForm()}
                        </div>
                    </div>

                    {/* Right Panel: Live Preview */}
                    <div className="flex-1 bg-black relative flex flex-col">
                        <div className="absolute inset-0 p-8 flex items-center justify-center overflow-auto">
                            {/* 16:9 Aspect Ratio Container simulating a TV */}
                            <div className="relative w-full max-w-5xl aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-2xl ring-1 ring-slate-800">
                                {renderPreview()}
                            </div>
                        </div>
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
};
