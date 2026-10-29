import { useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { analyzeVideo, VideoIssue, videoIssues, videoMetadata } from '@/lib/videoCheck';

export interface PreparedUpload {
    file: File;
    // Para display_media.metadata (videos: medidas, códec y problemas).
    metadata?: Record<string, unknown>;
}

interface Flagged {
    name: string;
    issues: VideoIssue[];
}

// Revisa los videos antes de subirlos. Si alguno es pesado para los TV box
// (4K, H.265, mucho bitrate), muestra un aviso y deja elegir: subir igual o
// cancelar. `dialog` se renderiza en el componente que sube.
export function useVideoUploadCheck() {
    const [flagged, setFlagged] = useState<Flagged[] | null>(null);
    const resolveRef = useRef<((proceed: boolean) => void) | null>(null);

    const answer = (proceed: boolean) => {
        resolveRef.current?.(proceed);
        resolveRef.current = null;
        setFlagged(null);
    };

    // null si la persona cancela.
    const prepare = async (files: File[]): Promise<PreparedUpload[] | null> => {
        const videos = files.filter(f => f.type.startsWith('video/'));
        if (videos.length === 0) return files.map(file => ({ file }));

        const toastId = toast.loading(videos.length === 1 ? 'Revisando el video…' : `Revisando ${videos.length} videos…`);
        const prepared: PreparedUpload[] = [];
        const problems: Flagged[] = [];
        for (const file of files) {
            if (!file.type.startsWith('video/')) {
                prepared.push({ file });
                continue;
            }
            try {
                const info = await analyzeVideo(file);
                const issues = videoIssues(info);
                if (issues.length > 0) problems.push({ name: file.name, issues });
                prepared.push({ file, metadata: { video: videoMetadata(info, issues) } });
            } catch {
                // Si no se puede analizar, se sube igual (no frena el trabajo).
                prepared.push({ file });
            }
        }
        toast.dismiss(toastId);

        if (problems.length === 0) return prepared;
        const proceed = await new Promise<boolean>(resolve => {
            resolveRef.current = resolve;
            setFlagged(problems);
        });
        return proceed ? prepared : null;
    };

    const dialog = (
        <Dialog open={flagged !== null} onOpenChange={open => { if (!open) answer(false); }}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        {flagged && flagged.length === 1 ? 'Este video puede trabarse en las pantallas' : 'Estos videos pueden trabarse en las pantallas'}
                    </DialogTitle>
                    <DialogDescription>
                        Los TV box chicos (1 GB de RAM) reproducen bien un MP4 H.264 en 1080p. Estos videos pesan más de lo recomendado.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                    {flagged?.map(item => (
                        <div key={item.name} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                            <p className="text-sm font-medium truncate" title={item.name}>{item.name}</p>
                            <ul className="mt-1 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                                {item.issues.map(issue => <li key={issue.code}>{issue.message}</li>)}
                            </ul>
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        Para achicarlo gratis: <span className="font-medium text-foreground">HandBrake</span> → preset
                        {' '}<span className="font-medium text-foreground">"Fast 1080p30"</span> → guardar como MP4.
                        Desde el celular, al compartir el video elegí "Más compatible" o calidad 1080p.
                    </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => answer(false)}>Cancelar</Button>
                    <Button onClick={() => answer(true)} className="bg-amber-600 hover:bg-amber-700 text-white">Subir igual</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { prepare, dialog };
}
