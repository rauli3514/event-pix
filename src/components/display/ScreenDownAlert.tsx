import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDownScreens } from '@/hooks/use-down-screens';
import { downScreensKey, formatDownFor } from '@/lib/screenAlerts';

const HIDDEN_KEY = 'display_down_alert_hidden';
const MAX_LISTED = 4;

interface Props {
    commerceId: string | null | undefined;
    // Mostrar el nombre del negocio (vista de todos los negocios).
    showCommerce?: boolean;
    className?: string;
}

// Cartel arriba del panel con las pantallas caídas, aviso emergente cuando se
// cae una mientras el panel está abierto y contador en el título de la pestaña.
export function ScreenDownAlert({ commerceId, showCommerce, className = 'mx-4 mt-4 md:mx-8' }: Props) {
    const down = useDownScreens(commerceId);
    const key = downScreensKey(down);
    const [hiddenKey, setHiddenKey] = useState(() => {
        try { return sessionStorage.getItem(HIDDEN_KEY) || ''; } catch { return ''; }
    });

    // Aviso emergente solo para las que se caen con el panel abierto (no al entrar).
    const knownRef = useRef<Set<string> | null>(null);
    useEffect(() => {
        const ids = new Set(down.map(s => s.id));
        if (knownRef.current) {
            for (const screen of down) {
                if (!knownRef.current.has(screen.id)) {
                    toast.error(`${screen.name} se desconectó`, {
                        description: `Sin señal ${formatDownFor(screen.downForMs)}.`,
                        duration: 10000,
                    });
                }
            }
        }
        knownRef.current = ids;
    }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

    // "(2) Título": se ve aunque la pestaña esté en segundo plano.
    useEffect(() => {
        const base = document.title.replace(/^\(\d+\) /, '');
        document.title = down.length > 0 ? `(${down.length}) ${base}` : base;
        return () => { document.title = document.title.replace(/^\(\d+\) /, ''); };
    }, [down.length]);

    if (down.length === 0 || key === hiddenKey) return null;

    const hide = () => {
        setHiddenKey(key);
        try { sessionStorage.setItem(HIDDEN_KEY, key); } catch { /* sin almacenamiento */ }
    };

    const listed = down.slice(0, MAX_LISTED);
    const more = down.length - listed.length;

    return (
        <div className={`${className} rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm relative z-10`}>
            <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-rose-500">
                        {down.length === 1 ? '1 pantalla sin conexión' : `${down.length} pantallas sin conexión`}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                        {listed.map(screen => (
                            <li key={screen.id} className="text-foreground/80 truncate">
                                <Link to={`/admin/display/${screen.id}`} className="font-medium hover:underline">
                                    {screen.name}
                                </Link>
                                {showCommerce && screen.commerceName ? <span className="text-muted-foreground"> · {screen.commerceName}</span> : null}
                                <span className="text-muted-foreground"> · sin señal {formatDownFor(screen.downForMs)}</span>
                            </li>
                        ))}
                        {more > 0 && <li className="text-muted-foreground">y {more} más</li>}
                    </ul>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                        Revisá que el equipo esté prendido y con internet. Si sigue así, reinicialo.
                    </p>
                </div>
                <button onClick={hide} className="text-muted-foreground hover:text-foreground p-1 -m-1" title="Ocultar hasta que se caiga otra">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
