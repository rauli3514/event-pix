import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CloudRain, LayoutTemplate, Type, DollarSign, X } from 'lucide-react';
import { AppEditorModal } from './AppEditorModal';

interface AppCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    commerceId: string;
    currentFolder: string;
}

export type AppId = 'weather' | 'split-screen' | 'ticker' | 'dolar';

export const APPS = [
    {
        id: 'weather' as AppId,
        name: 'El Clima',
        description: 'Muestra la temperatura, pronóstico y condiciones actuales en tiempo real.',
        icon: CloudRain,
        color: 'text-sky-400',
        bg: 'bg-sky-400/10'
    },
    {
        id: 'split-screen' as AppId,
        name: 'Pantalla Dividida',
        description: 'Divide la pantalla en múltiples zonas y muestra contenido diferente en cada una.',
        icon: LayoutTemplate,
        color: 'text-indigo-400',
        bg: 'bg-indigo-400/10'
    },
    {
        id: 'ticker' as AppId,
        name: 'Texto Deslizante',
        description: 'Una barra tipo noticiero con texto corriendo continuamente.',
        icon: Type,
        color: 'text-emerald-400',
        bg: 'bg-emerald-400/10'
    },
    {
        id: 'dolar' as AppId,
        name: 'Cotización Dólar',
        description: 'Muestra el precio del dólar oficial, blue, bolsa, y cripto actualizado minuto a minuto.',
        icon: DollarSign,
        color: 'text-green-400',
        bg: 'bg-green-400/10'
    }
];

export const AppCatalogModal = ({ isOpen, onClose, commerceId, currentFolder }: AppCatalogModalProps) => {
    const [selectedAppId, setSelectedAppId] = useState<AppId | null>(null);

    // If an app is selected, show the Editor instead of the Catalog
    if (selectedAppId) {
        return (
            <AppEditorModal
                isOpen={isOpen}
                onClose={() => {
                    setSelectedAppId(null);
                    onClose();
                }}
                onBack={() => setSelectedAppId(null)}
                appId={selectedAppId}
                commerceId={commerceId}
                currentFolder={currentFolder}
            />
        );
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="bg-[#0A101D] text-slate-200 border-slate-800 shadow-2xl max-w-4xl p-0 overflow-hidden sm:rounded-2xl">
                <div className="flex flex-col h-full max-h-[85vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                        <div>
                            <DialogTitle className="text-xl text-white font-semibold">Catálogo de Apps</DialogTitle>
                            <DialogDescription className="text-slate-400 mt-1">
                                Selecciona una aplicación para agregarla a tu librería.
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    {/* Catalog Grid */}
                    <div className="flex-1 overflow-y-auto p-6 bg-[#0A101D]">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {APPS.map((app) => (
                                <div 
                                    key={app.id}
                                    className="group cursor-pointer bg-slate-900 border border-slate-800 rounded-xl p-6 transition-all duration-200 hover:border-indigo-500/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.1)] hover:-translate-y-1"
                                    onClick={() => setSelectedAppId(app.id)}
                                >
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${app.bg}`}>
                                        <app.icon className={`w-6 h-6 ${app.color}`} />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-2">{app.name}</h3>
                                    <p className="text-sm text-slate-400 line-clamp-3">{app.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
