import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { QR_DEFAULT_LABEL, buildQrUrl, parseQrUrl, type QrKind } from '@/lib/posters';

// Código QR del cartel: la persona elige qué quiere que abra (WhatsApp,
// Instagram o una página) y el link se arma solo.

const KINDS: { id: QrKind | 'none'; label: string }[] = [
    { id: 'none', label: 'Sin QR' },
    { id: 'whatsapp', label: 'WhatsApp' },
    { id: 'instagram', label: 'Instagram' },
    { id: 'web', label: 'Página web' },
];

const HELP: Record<QrKind, string> = {
    whatsapp: 'El cliente apunta la cámara del celular al código y se le abre un chat con tu WhatsApp, con el mensaje ya escrito.',
    instagram: 'El cliente apunta la cámara del celular al código y se le abre tu perfil de Instagram para seguirte.',
    web: 'El cliente apunta la cámara del celular al código y se le abre esa página: tu menú, la tienda online o las reseñas de Google.',
};

interface Props {
    url?: string;
    label?: string;
    onChange: (patch: { qrUrl?: string; qrLabel?: string }) => void;
}

export function QrBuilder({ url, label, onChange }: Props) {
    const initial = parseQrUrl(url);
    const [kind, setKind] = useState<QrKind | 'none'>(url ? initial.kind : 'none');
    const [value, setValue] = useState(url ? initial.value : '');
    const [message, setMessage] = useState(initial.message);

    const emit = (k: QrKind | 'none', v: string, m: string) => {
        const qrUrl = k === 'none' ? '' : buildQrUrl(k, v, m);
        onChange({ qrUrl });
    };

    const pickKind = (k: QrKind | 'none') => {
        // Si el texto al lado del QR era el de antes, pasa al del tipo nuevo.
        const wasDefault = label === undefined || (kind !== 'none' && label === QR_DEFAULT_LABEL[kind]);
        setKind(k);
        setValue('');
        setMessage('');
        onChange({ qrUrl: '', ...(wasDefault ? { qrLabel: undefined } : {}) });
    };

    const shownLabel = label ?? (kind !== 'none' ? QR_DEFAULT_LABEL[kind] : '');

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
                {KINDS.map(k => (
                    <button key={k.id} type="button" onClick={() => pickKind(k.id)}
                        className={cn('rounded-full border px-3 py-1 text-xs', kind === k.id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' : 'border-border')}>
                        {k.label}
                    </button>
                ))}
            </div>

            {kind !== 'none' && (
                <>
                    <p className="text-xs text-muted-foreground">{HELP[kind]}</p>
                    {kind === 'whatsapp' && (
                        <>
                            <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">Número de WhatsApp del local (con la característica)</span>
                                <Input value={value} inputMode="tel" placeholder="362 454-7382"
                                    onChange={e => { setValue(e.target.value); emit(kind, e.target.value, message); }} />
                            </label>
                            <label className="block space-y-1">
                                <span className="text-xs text-muted-foreground">Mensaje que ya aparece escrito (opcional)</span>
                                <Input value={message} placeholder="¡Hola! Quiero hacer un pedido"
                                    onChange={e => { setMessage(e.target.value); emit(kind, value, e.target.value); }} />
                            </label>
                        </>
                    )}
                    {kind === 'instagram' && (
                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">Tu usuario de Instagram</span>
                            <Input value={value} placeholder="@tulocal" autoCapitalize="off"
                                onChange={e => { setValue(e.target.value); emit(kind, e.target.value, ''); }} />
                        </label>
                    )}
                    {kind === 'web' && (
                        <label className="block space-y-1">
                            <span className="text-xs text-muted-foreground">Dirección de la página</span>
                            <Input value={value} placeholder="tulocal.com.ar/menu" inputMode="url" autoCapitalize="off"
                                onChange={e => { setValue(e.target.value); emit(kind, e.target.value, ''); }} />
                        </label>
                    )}
                    <label className="block space-y-1">
                        <span className="text-xs text-muted-foreground">Texto debajo del código</span>
                        <Input value={shownLabel} maxLength={40} placeholder="Sin texto"
                            onChange={e => onChange({ qrLabel: e.target.value })} />
                    </label>
                    {url ? (
                        <p className="text-xs text-muted-foreground break-all">
                            Abre: <a href={url} target="_blank" rel="noreferrer" className="underline text-indigo-600 dark:text-indigo-300 inline-flex items-center gap-1">{url} <ExternalLink className="w-3 h-3" /></a>
                        </p>
                    ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400">Completá el dato de arriba para que aparezca el código.</p>
                    )}
                </>
            )}
        </div>
    );
}
