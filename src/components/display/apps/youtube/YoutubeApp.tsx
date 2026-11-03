import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Youtube } from 'lucide-react';
import { youtubeEmbedUrl } from '@/lib/youtube';

export interface YoutubeConfig {
    url?: string;
    isMuted?: boolean;
    showControls?: boolean;
}

interface YoutubeFormProps {
    config: YoutubeConfig;
    onChange: (config: YoutubeConfig) => void;
}

export const YoutubeForm = ({ config, onChange }: YoutubeFormProps) => {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Label className="text-slate-300">URL del Video o Playlist de YouTube <span className="text-red-400">*</span></Label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Youtube className="h-5 w-5 text-red-500" />
                    </div>
                    <Input
                        value={config.url || ''}
                        onChange={(e) => onChange({ ...config, url: e.target.value })}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="pl-10 bg-slate-950 border-slate-800 text-slate-200 focus-visible:ring-indigo-500"
                    />
                </div>
                <p className="text-xs text-slate-500">
                    Sirven links de videos, Shorts, vivos y listas de reproducción.
                </p>
            </div>

            <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-4">
                <h4 className="text-sm font-medium text-slate-300 mb-2">Ajustes de Reproducción</h4>
                
                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-slate-300">Silenciar Video (Recomendado)</Label>
                        <p className="text-xs text-slate-500">Obligatorio para que el auto-play funcione en la mayoría de Smart TVs.</p>
                    </div>
                    <Switch
                        checked={config.isMuted !== false} // Default to true
                        onCheckedChange={(c) => onChange({ ...config, isMuted: c })}
                        className="data-[state=checked]:bg-indigo-600"
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                        <Label className="text-slate-300">Mostrar Controles</Label>
                        <p className="text-xs text-slate-500">Muestra la barra de progreso y botones de YouTube.</p>
                    </div>
                    <Switch
                        checked={config.showControls || false}
                        onCheckedChange={(c) => onChange({ ...config, showControls: c })}
                        className="data-[state=checked]:bg-indigo-600"
                    />
                </div>
            </div>
        </div>
    );
};

interface YoutubePreviewProps {
    config: YoutubeConfig;
}

export const YoutubePreview = ({ config }: YoutubePreviewProps) => {
    if (!config.url) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-800">
                <Youtube className="w-16 h-16 text-slate-700 mb-4" />
                <p className="text-slate-500 text-lg">Ingresa una URL de YouTube para comenzar</p>
            </div>
        );
    }

    const embedUrl = youtubeEmbedUrl(config.url, { muted: config.isMuted !== false, controls: !!config.showControls });
    if (!embedUrl) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-800">
                <Youtube className="w-16 h-16 text-rose-900/50 mb-4" />
                <p className="text-rose-500 text-lg">URL de YouTube no válida</p>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-black relative pointer-events-none">
            <iframe
                src={embedUrl}
                title="YouTube Video Player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-full"
            />
        </div>
    );
};
