import { MonitorPlay } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { cn } from '@/lib/utils';
import { useNow } from '@/hooks/use-now';
import { accountStatus, daysLeft } from '@/lib/accounts';
import { contractWhatsappUrl, openTestScreen } from '@/lib/trial';
import type { AccountPlan } from '@/lib/accounts';

interface Props {
    plan: { plan: AccountPlan; trial_ends_at: string | null } | null | undefined;
    commerceName?: string | null;
}

// Barra de arriba del panel mientras el negocio está en prueba: cuántos días le
// quedan, la pantalla de prueba y el WhatsApp para contratar.
export function TrialBar({ plan, commerceName }: Props) {
    const now = useNow(60000);
    const status = accountStatus(plan, now);
    if (status !== 'prueba' && status !== 'vencida') return null;
    const ended = status === 'vencida';
    const left = daysLeft(plan?.trial_ends_at, now);

    return (
        <div className={cn('border-b px-4 md:px-8 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm',
            ended ? 'bg-rose-500/10 border-rose-500/30' : 'bg-orange-500/10 border-orange-500/30')}>
            <p className="flex-1 min-w-[200px]">
                <span className={cn('font-semibold', ended ? 'text-rose-600 dark:text-rose-400' : 'text-orange-600 dark:text-orange-400')}>
                    {ended ? 'Tu prueba terminó.' : `Estás probando Display Digital · ${left === 1 ? 'queda 1 día' : `quedan ${left} días`}.`}
                </span>{' '}
                <span className="text-muted-foreground">
                    {ended ? 'Escribinos para contratarlo y seguir con todo lo que armaste.' : 'Cuando lo contrates, funciona con el equipo Display Digital en tu TV.'}
                </span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
                {!ended && (
                    <button type="button" onClick={openTestScreen}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                        <MonitorPlay className="w-3.5 h-3.5" /> Pantalla de prueba
                    </button>
                )}
                <a href={contractWhatsappUrl(commerceName)} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1fb457]">
                    <FaWhatsapp className="w-3.5 h-3.5" /> Quiero contratarlo
                </a>
            </div>
        </div>
    );
}
