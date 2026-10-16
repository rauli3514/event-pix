import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, Loader2, MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { DemoPost } from "@/lib/demoWall";

// Formulario del celular en la demo: selfie (o mensaje), nombre y dedicatoria.
// La foto se achica mucho porque viaja por el canal en tiempo real, no por el
// almacenamiento (y en pantalla de demo alcanza y sobra).

const MAX_DATA_URL = 170_000; // ~125 KB de imagen (los mensajes en tiempo real tienen límite de tamaño)

const toDataUrl = (file: Blob) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });

async function shrink(file: File): Promise<string> {
    for (const [side, size] of [[900, 0.11], [720, 0.08], [540, 0.05]] as const) {
        const small = await imageCompression(file, { maxWidthOrHeight: side, maxSizeMB: size, initialQuality: 0.75, fileType: 'image/jpeg', useWebWorker: true })
            .catch(() => imageCompression(file, { maxWidthOrHeight: side, maxSizeMB: size, initialQuality: 0.75, fileType: 'image/jpeg', useWebWorker: false }));
        const url = await toDataUrl(small);
        if (url.length <= MAX_DATA_URL) return url;
    }
    throw new Error('La foto es muy pesada, probá con otra');
}

interface DemoComposerProps {
    onSend: (post: DemoPost) => Promise<void>;
}

export const DemoComposer = ({ onSend }: DemoComposerProps) => {
    const [mode, setMode] = useState<'photo' | 'message'>('photo');
    const [name, setName] = useState('');
    const [caption, setCaption] = useState('');
    const [text, setText] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [busy, setBusy] = useState<'photo' | 'send' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const pick = async (file?: File) => {
        if (!file) return;
        setError(null);
        setBusy('photo');
        try {
            setPhoto(await shrink(file));
        } catch (err) {
            setError((err as Error).message || 'No se pudo leer la foto');
        } finally {
            setBusy(null);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const canSend = mode === 'photo' ? !!photo : text.trim().length > 0;

    const send = async () => {
        if (!canSend) return;
        setError(null);
        setBusy('send');
        try {
            await onSend({
                id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                type: mode,
                content: mode === 'photo' ? photo! : text.trim().slice(0, 200),
                author: name.trim() || undefined,
                caption: mode === 'photo' ? caption.trim() || undefined : undefined,
            });
            setPhoto(null);
            setCaption('');
            setText('');
        } catch (err) {
            setError((err as Error).message || 'No se pudo enviar. Probá de nuevo.');
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1">
                {([['photo', 'Foto', Camera], ['message', 'Mensaje', MessageSquare]] as const).map(([id, label, Icon]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setMode(id)}
                        className={cn('flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors',
                            mode === id ? 'bg-violet-600 text-white' : 'text-white/70 hover:text-white')}
                    >
                        <Icon className="h-4 w-4" /> {label}
                    </button>
                ))}
            </div>

            {mode === 'photo' ? (
                <>
                    <input ref={fileRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-white/5 text-white/80"
                    >
                        {photo ? (
                            <img src={photo} alt="Tu foto" className="h-full w-full object-cover" />
                        ) : busy === 'photo' ? (
                            <Loader2 className="h-8 w-8 animate-spin" />
                        ) : (
                            <span className="flex flex-col items-center gap-2 text-base font-semibold">
                                <Camera className="h-10 w-10" /> Sacate una selfie
                            </span>
                        )}
                    </button>
                    <Input
                        value={caption}
                        onChange={(e) => setCaption(e.target.value.slice(0, 120))}
                        placeholder="Dedicatoria (opcional)"
                        className="h-12 bg-white/10 border-white/15 text-white placeholder:text-white/50"
                    />
                </>
            ) : (
                <Textarea
                    value={text}
                    onChange={(e) => setText(e.target.value.slice(0, 200))}
                    placeholder="Escribí un saludo para la pantalla..."
                    className="min-h-[140px] bg-white/10 border-white/15 text-white text-lg placeholder:text-white/50"
                />
            )}

            <Input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 40))}
                placeholder="Tu nombre"
                className="h-12 bg-white/10 border-white/15 text-white placeholder:text-white/50"
            />

            {error && <p className="text-sm text-red-300">{error}</p>}

            <Button
                onClick={send}
                disabled={!canSend || busy !== null}
                className="h-14 w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-lg font-extrabold text-white"
            >
                {busy === 'send' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                Mandar a la pantalla
            </Button>
        </div>
    );
};
