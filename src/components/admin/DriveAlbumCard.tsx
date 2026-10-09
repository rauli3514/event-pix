import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CloudUpload, ExternalLink, Copy, Loader2 } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Submission } from "@/types";
import { buildAlbum, exportAlbumToDrive, type ExportResult } from "@/lib/driveAlbum";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

interface DriveAlbumCardProps {
    eventId: string;
    submissions: Submission[];
    eventName: string;
}

/**
 * "Enviar álbum a Drive": copia lo aprobado del muro a la carpeta del evento
 * (la misma del kiosco si se llama igual) y deja el link listo para el anfitrión.
 * La conexión con Drive está configurada en Supabase (función drive-admin).
 */
export const DriveAlbumCard = ({ eventId, submissions, eventName }: DriveAlbumCardProps) => {
    const [folder, setFolder] = useState(eventName);
    const [shareFolder, setShareFolder] = useState(true);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [result, setResult] = useState<ExportResult | null>(null);

    const summary = useMemo(() => buildAlbum(submissions, eventName), [submissions, eventName]);
    const running = progress !== null && result === null;
    const empty = summary.files.length === 0 && !summary.text;

    const handleExport = async () => {
        if (!folder.trim()) {
            toast.error("Poné el nombre de la carpeta del evento");
            return;
        }
        setResult(null);
        setProgress({ done: 0, total: summary.files.length });
        try {
            const res = await exportAlbumToDrive({
                eventId,
                submissions,
                eventName,
                folder: folder.trim(),
                shareFolder,
                onProgress: (done, total) => setProgress({ done, total }),
            });
            setResult(res);
            if (res.failed.length) toast.warning(`Faltaron ${res.failed.length} archivos. Tocá de nuevo para reintentar.`);
            else toast.success("¡Álbum en Drive!");
        } catch (err) {
            setProgress(null);
            toast.error((err as Error).message || "No se pudo enviar a Drive");
        }
    };

    const shareText = result ? `¡Acá están todas las fotos y mensajes de ${eventName}! 📸 ${result.folderUrl}` : "";

    return (
        <Card className="md:col-span-2 bg-slate-900 border-slate-800">
            <CardContent className="py-8 px-6 md:px-10 space-y-5">
                <div className="flex items-start gap-5">
                    <div className="w-16 h-16 shrink-0 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400">
                        <CloudUpload className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-white">Enviar álbum a Drive</h3>
                        <p className="text-slate-400 text-sm mt-1">
                            Copia {plural(summary.photos, 'foto', 'fotos')}, {plural(summary.audios, 'audio', 'audios')} y {plural(summary.messages, 'mensaje', 'mensajes')} aprobados
                            (con nombres y dedicatorias) a la carpeta del evento. Si el kiosco usó una carpeta con el mismo
                            nombre, queda todo junto en un solo link para el anfitrión.
                        </p>
                    </div>
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                    <Input
                        value={folder}
                        onChange={(e) => setFolder(e.target.value)}
                        placeholder="Nombre de la carpeta del evento"
                        className="bg-slate-950 border-slate-700 text-white h-11"
                    />
                    <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                        <Switch checked={shareFolder} onCheckedChange={setShareFolder} />
                        Compartir con link
                    </label>
                </div>

                <Button
                    onClick={handleExport}
                    disabled={running || empty}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base"
                >
                    {running ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Copiando {progress!.done} de {progress!.total}...
                        </>
                    ) : result ? "Volver a enviar (solo lo que falta)" : "Enviar álbum a Drive"}
                </Button>

                {running && progress!.total > 0 && (
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all"
                            style={{ width: `${Math.round((progress!.done / progress!.total) * 100)}%` }}
                        />
                    </div>
                )}

                {result && (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                        <p className="text-sm text-emerald-300">
                            ✅ {result.saved} archivos nuevos{result.skipped ? `, ${result.skipped} ya estaban` : ""}.
                            {result.failed.length > 0 && <span className="text-amber-300"> Faltaron {result.failed.length}: tocá "Volver a enviar".</span>}
                            {shareFolder && !result.shared && <span className="text-amber-300"> No se pudo compartir con link: compartila a mano desde Drive.</span>}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            <Button asChild variant="outline" className="border-slate-700 text-white">
                                <a href={result.folderUrl} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="w-4 h-4 mr-2" /> Abrir carpeta
                                </a>
                            </Button>
                            <Button
                                variant="outline"
                                className="border-slate-700 text-white"
                                onClick={() => navigator.clipboard.writeText(result.folderUrl).then(() => toast.success("Link copiado"))}
                            >
                                <Copy className="w-4 h-4 mr-2" /> Copiar link
                            </Button>
                            <Button asChild className="bg-green-600 hover:bg-green-500 text-white">
                                <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer">
                                    <FaWhatsapp className="w-4 h-4 mr-2" /> Mandar al anfitrión
                                </a>
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
