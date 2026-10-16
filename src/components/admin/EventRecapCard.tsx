import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, RefreshCw, Share2, Sparkles } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Submission } from "@/types";
import { drawRecap, pickRecapPhotos, recapStats, RECAP_SIZES, type RecapFormat } from "@/lib/eventRecap";

interface EventRecapCardProps {
    eventName: string;
    eventDate?: string | null;
    submissions: Submission[];
    accent?: string | null;
    fontClass?: string;
    /** Link de la carpeta de Drive, si ya se mandó el álbum */
    albumLink?: string | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Resumen para compartir": imagen con fotos y números de la noche para que el
 * anfitrión la comparta al día siguiente. Lleva la firma de EventPix.
 */
export const EventRecapCard = ({ eventName, eventDate, submissions, accent, fontClass, albumLink }: EventRecapCardProps) => {
    const [format, setFormat] = useState<RecapFormat>('post');
    const [seed, setSeed] = useState(0);
    const [albumUrl, setAlbumUrl] = useState(albumLink || '');
    // Cuando se manda el álbum a Drive, el link se completa solo
    const [prevLink, setPrevLink] = useState(albumLink);
    if (albumLink !== prevLink) {
        setPrevLink(albumLink);
        if (albumLink) setAlbumUrl(albumLink);
    }
    const [image, setImage] = useState<{ key: string; blob: Blob; url: string } | null>(null);
    const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

    const stats = useMemo(() => recapStats(submissions), [submissions]);
    const photos = useMemo(() => pickRecapPhotos(submissions, 6, seed), [submissions, seed]);
    // Solo se vuelve a dibujar si cambia algo que se ve en la imagen
    const key = [format, eventName, eventDate, accent, fontClass, stats.photos, stats.guests, stats.messages, ...photos.map((p) => p.id)].join('|');
    const error = failed?.key === key ? failed.message : null;
    const loading = image?.key !== key && !error;

    // La imagen anterior se sigue viendo (más clara) hasta que está la nueva
    const urlRef = useRef<string | null>(null);
    useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);
    useEffect(() => {
        if (photos.length === 0) return;
        let cancelled = false;
        drawRecap({ format, title: eventName, date: eventDate, accent, fontClass, stats, photos })
            .then((blob) => {
                if (cancelled) return;
                if (urlRef.current) URL.revokeObjectURL(urlRef.current);
                urlRef.current = URL.createObjectURL(blob);
                setImage({ key, blob, url: urlRef.current });
            })
            .catch((err) => !cancelled && setFailed({ key, message: (err as Error).message || 'No se pudo armar la imagen' }));
        return () => { cancelled = true; };
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    const fileName = `Resumen ${eventName}.jpg`.replace(/[\\/:*?"<>|]+/g, ' ');
    const shareText = [
        `¡Gracias por ser parte de ${eventName}! 📸`,
        `Entre todos subimos ${plural(stats.photos, 'foto', 'fotos')}${stats.messages ? ` y ${plural(stats.messages, 'mensaje', 'mensajes')}` : ''} a la pantalla.`,
        albumUrl.trim() ? `Acá están todas: ${albumUrl.trim()}` : '',
    ].filter(Boolean).join('\n');

    const file = image ? new File([image.blob], fileName, { type: 'image/jpeg' }) : null;
    const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

    const share = async () => {
        if (!file) return;
        try {
            await navigator.share({ files: [file], text: shareText });
        } catch (err) {
            if ((err as Error).name !== 'AbortError') toast.error('No se pudo compartir. Descargá la imagen y mandala a mano.');
        }
    };

    const empty = photos.length === 0;
    const { w, h } = RECAP_SIZES[format];

    return (
        <Card className="md:col-span-2 bg-slate-900 border-slate-800">
            <CardContent className="py-8 px-6 md:px-10">
                <div className="flex items-start gap-5 mb-6">
                    <div className="w-16 h-16 shrink-0 bg-fuchsia-500/10 rounded-full flex items-center justify-center text-fuchsia-400">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Resumen para compartir</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Una imagen con fotos y números de la noche para mandarle al anfitrión al día siguiente.
                            Cuando la comparte en sus redes, todos ven "Hecho con EventPix".
                        </p>
                    </div>
                </div>

                {empty ? (
                    <p className="text-slate-500 text-sm">Cuando haya fotos aprobadas, acá aparece el resumen.</p>
                ) : (
                    <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
                        {/* Vista previa */}
                        <div
                            className="relative mx-auto w-full max-w-[280px] overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-white/10"
                            style={{ aspectRatio: `${w} / ${h}` }}
                        >
                            {image && <img src={image.url} alt="Resumen del evento" className={cn('h-full w-full object-contain transition-opacity', loading && 'opacity-40')} />}
                            {loading && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-white/70" />
                                </div>
                            )}
                            {error && <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-red-300">{error}</p>}
                        </div>

                        <div className="space-y-5">
                            <div className="flex flex-wrap gap-2">
                                {([['post', 'Publicación / chat'], ['story', 'Historia / estado']] as const).map(([id, label]) => (
                                    <Button
                                        key={id}
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setFormat(id)}
                                        className={cn('border-slate-700', format === id ? 'bg-violet-600 text-white border-violet-500 hover:bg-violet-600' : 'bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white')}
                                    >
                                        {label}
                                    </Button>
                                ))}
                                <Button type="button" size="sm" variant="outline" onClick={() => setSeed((s) => s + 1)} className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white">
                                    <RefreshCw className="mr-2 h-4 w-4" /> Otras fotos
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm text-slate-300">Link del álbum (opcional)</label>
                                <Input
                                    value={albumUrl}
                                    onChange={(e) => setAlbumUrl(e.target.value)}
                                    placeholder="Pegá el link de la carpeta de Drive"
                                    className="bg-slate-950 border-slate-700 text-white"
                                />
                                <p className="text-xs text-slate-500">Se agrega al mensaje para que vean todas las fotos.</p>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {canShareFile && (
                                    <Button onClick={share} disabled={loading} className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white">
                                        <Share2 className="mr-2 h-4 w-4" /> Compartir
                                    </Button>
                                )}
                                <Button asChild variant="outline" disabled={!image} className="border-slate-700 text-white">
                                    <a href={image?.url} download={fileName} aria-disabled={!image}>
                                        <Download className="mr-2 h-4 w-4" /> Descargar imagen
                                    </a>
                                </Button>
                                <Button asChild className="bg-green-600 hover:bg-green-500 text-white">
                                    <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                                        <FaWhatsapp className="mr-2 h-4 w-4" /> Mensaje por WhatsApp
                                    </a>
                                </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                                {canShareFile
                                    ? 'Desde el celular, "Compartir" manda la imagen y el mensaje juntos.'
                                    : 'Descargá la imagen y adjuntala en el chat de WhatsApp junto con el mensaje.'}
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
