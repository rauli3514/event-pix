import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ChevronDown, ExternalLink, Link2, ListOrdered, Megaphone, MonitorPlay, Send, Sparkles, Tv2, X } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SETUP_STEPS, useSetupProgress, type SetupStepId } from '@/hooks/use-setup-progress';
import { openTestScreen, supportWhatsappUrl } from '@/lib/trial';

interface Props {
    commerceId: string;
    commerceName?: string | null;
    // En prueba: la pantalla es una pestaña del navegador (después, el equipo).
    trial?: boolean;
    // Para cerrarla (en Inicio) o el panel lateral.
    onClose?: () => void;
    onNavigate?: () => void;
    className?: string;
}

interface Step {
    title: string;
    body: ReactNode;
    action: string;
    icon: typeof Tv2;
    run: () => void;
}

// Guía para empezar: 5 pasos que se marcan solos a medida que se hacen. Está en
// Inicio mientras falte algo y siempre a mano desde el botón "Guía" del menú.
export function SetupGuide({ commerceId, commerceName, trial, onClose, onNavigate, className }: Props) {
    const navigate = useNavigate();
    const { done, count, total } = useSetupProgress(commerceId);
    const base = `/admin/display/commerce/${commerceId}/workspace`;
    const go = (path: string) => { navigate(`${base}/${path}`); onNavigate?.(); };
    const firstPending = SETUP_STEPS.find(s => !done[s]) || null;
    const [open, setOpen] = useState<SetupStepId | null>(firstPending);

    const steps: Record<SetupStepId, Step> = {
        screen: trial ? {
            title: 'Abrí la pantalla de prueba',
            body: (
                <>
                    <p>Es una pestaña del navegador que hace de TV: abrila en la compu, en otro celular o en una tablet. Ahí aparece un código.</p>
                    <p className="rounded-lg bg-indigo-500/10 px-3 py-2 text-foreground">
                        Cuando contrates, vas a usar el <strong>equipo Display Digital</strong>, que se conecta a tu TV por HDMI. Se vincula igual, con el código.
                    </p>
                </>
            ),
            action: 'Abrir pantalla de prueba',
            icon: MonitorPlay,
            run: openTestScreen,
        } : {
            title: 'Conectá el equipo a la TV',
            body: (
                <ul className="list-disc space-y-1 pl-4">
                    <li>Conectá el <strong className="text-foreground">equipo Display Digital</strong> a la entrada HDMI de la TV y enchufalo.</li>
                    <li>Poné la TV en esa entrada HDMI y conectá el equipo al Wi-Fi.</li>
                    <li>En la TV aparece un <strong className="text-foreground">código</strong>.</li>
                </ul>
            ),
            action: 'Ver mis pantallas',
            icon: Tv2,
            run: () => go('screens'),
        },
        link: {
            title: 'Vinculala con el código',
            body: <p>Tocá <strong className="text-foreground">Vincular pantalla</strong>, escribí el código que aparece en la pantalla y ponele un nombre (por ejemplo "Mostrador").</p>,
            action: 'Vincular pantalla',
            icon: Link2,
            run: () => go('screens?openModal=link'),
        },
        poster: {
            title: 'Armá tu cartel',
            body: <p>Elegí un diseño de tu rubro y cambiá los textos, la foto y los colores.{trial ? ' Te dejamos uno de ejemplo para que lo pruebes.' : ''}</p>,
            action: 'Ir a Carteles',
            icon: Megaphone,
            run: () => go('posters'),
        },
        prices: {
            title: 'Cargá tus precios',
            body: <p>Escribilos o pegalos desde una planilla. Si usás <strong className="text-foreground">Fudo</strong>, traelos en un clic con "Traer desde Fudo". Cuando cambiás un precio, se actualiza en todas las pantallas.</p>,
            action: 'Ir a Listas de precios',
            icon: ListOrdered,
            run: () => go('price-lists'),
        },
        send: {
            title: 'Mandalo a la pantalla',
            body: <p>En Carteles, tocá <strong className="text-foreground">Enviar a pantallas</strong> en tu cartel y elegí la pantalla. En menos de un minuto lo ves.</p>,
            action: 'Ir a Carteles',
            icon: Send,
            run: () => go('posters'),
        },
    };

    return (
        <section className={cn('rounded-2xl border border-border bg-card text-foreground shadow-sm overflow-hidden', className)} aria-label="Guía para empezar">
            <div className="flex items-start justify-between gap-3 p-4 md:p-5">
                <div className="flex items-center gap-3 min-w-0">
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
                    <div className="min-w-0">
                        <h2 className="font-bold leading-tight">Guía para empezar</h2>
                        <p className="text-sm text-muted-foreground">{count === total ? '¡Listo! Ya hiciste todo.' : `${count} de ${total} pasos · se marcan solos`}</p>
                    </div>
                </div>
                {onClose && (
                    <button type="button" onClick={onClose} aria-label="Cerrar la guía" className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="px-4 md:px-5">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${(count / total) * 100}%` }} />
                </div>
            </div>

            <ol className="p-4 md:p-5 space-y-2">
                {SETUP_STEPS.map((id, i) => {
                    const step = steps[id];
                    const isOpen = open === id;
                    const isDone = done[id];
                    return (
                        <li key={id} className={cn('rounded-xl border transition-colors', isOpen ? 'border-indigo-500/40 bg-muted/40' : 'border-border')}>
                            <button type="button" onClick={() => setOpen(isOpen ? null : id)} aria-expanded={isOpen}
                                className="w-full flex items-center gap-3 p-3 text-left">
                                <span className={cn('w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold',
                                    isDone ? 'bg-emerald-500 text-white' : 'border border-border bg-background text-muted-foreground')}>
                                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                                </span>
                                <span className={cn('flex-1 min-w-0 text-sm font-semibold', isDone && 'text-muted-foreground line-through')}>{step.title}</span>
                                <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                            </button>
                            {isOpen && (
                                <div className="px-3 pb-3 pl-[3.25rem] space-y-3 text-sm text-muted-foreground">
                                    {step.body}
                                    <Button size="sm" onClick={step.run} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                        <step.icon className="w-4 h-4 mr-1.5" /> {step.action}
                                        {id === 'screen' && trial && <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-70" />}
                                    </Button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ol>

            <div className="border-t border-border px-4 md:px-5 py-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">¿Te trabaste en algún paso?</span>
                <a href={supportWhatsappUrl(commerceName)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                    <FaWhatsapp className="w-4 h-4" /> Escribinos
                </a>
            </div>
        </section>
    );
}
