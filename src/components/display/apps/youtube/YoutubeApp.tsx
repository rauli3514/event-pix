import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Youtube } from 'lucide-react';

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
                    Soporta enlaces de videos individuales y listas de reproducción (playlists).
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

    // Parse YouTube URL to extract Video ID or Playlist ID
    let videoId = '';
    let playlistId = '';

    try {
        const urlObj = new URL(config.url);
        
        // Handle youtu.be/ID
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            // Handle youtube.com/watch?v=ID
            if (urlObj.pathname === '/watch') {
                videoId = urlObj.searchParams.get('v') || '';
                playlistId = urlObj.searchParams.get('list') || '';
            } 
            // Handle youtube.com/playlist?list=ID
            else if (urlObj.pathname === '/playlist') {
                playlistId = urlObj.searchParams.get('list') || '';
            }
            // Handle youtube.com/embed/ID
            else if (urlObj.pathname.startsWith('/embed/')) {
                videoId = urlObj.pathname.split('/')[2];
            }
            // Handle shorts
            else if (urlObj.pathname.startsWith('/shorts/')) {
                videoId = urlObj.pathname.split('/')[2];
            }
        }
    } catch (e) {
        // Invalid URL, let it fail gracefully or try regex fallback
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = config.url.match(regex);
        if (match && match[1]) {
            videoId = match[1];
        }
    }

    if (!videoId && !playlistId) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 border border-slate-800">
                <Youtube className="w-16 h-16 text-rose-900/50 mb-4" />
                <p className="text-rose-500 text-lg">URL de YouTube no válida</p>
            </div>
        );
    }

    // Construct the embed URL
    // Autoplay is enabled by default. Loop is enabled by default.
    const isMuted = config.isMuted !== false;
    const showControls = config.showControls ? 1 : 0;
    
    // For looping a single video, YouTube requires the playlist param to be set to the video id
    const loopParam = `&loop=1&playlist=${playlistId || videoId}`;
    
    let embedUrl = '';
    
    if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}&controls=${showControls}${loopParam}`;
    } else if (playlistId) {
        embedUrl = `https://www.youtube.com/embed/videoseries?list=${playlistId}&autoplay=1&mute=${isMuted ? 1 : 0}&controls=${showControls}&loop=1`;
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
