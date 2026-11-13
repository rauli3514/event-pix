import { useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdminAccounts } from '@/hooks/use-accounts';
import { useNow } from '@/hooks/use-now';
import { accountStatus, accountsErrorText, type AccountStatus } from '@/lib/accounts';
import { AccountCard } from './AccountCard';

// Lista de comercios de cartelería. Para el super admin, con pestañas por estado
// (los que contrataron, los que están probando, las pruebas vencidas y las bajas)
// y las acciones de cada uno. Se usa en /admin (pestaña Display Digital) y en
// /admin/display.

const TABS: { id: AccountStatus; label: string }[] = [
    { id: 'cliente', label: 'Clientes' },
    { id: 'prueba', label: 'En prueba' },
    { id: 'vencida', label: 'Pruebas vencidas' },
    { id: 'baja', label: 'Bajas' },
];

const EMPTY: Record<AccountStatus, { title: string; text: string }> = {
    cliente: { title: 'Todavía no hay clientes', text: 'Cuando pases una prueba a cliente, o crees un comercio, aparece acá.' },
    prueba: { title: 'Nadie está probando ahora', text: 'Los que se registren en "Probalo" aparecen acá con sus datos.' },
    vencida: { title: 'No hay pruebas vencidas', text: 'Acá quedan los que no contrataron, para llamarlos.' },
    baja: { title: 'No hay bajas', text: 'Los comercios dados de baja quedan acá.' },
};

interface Commerce { id: string; name: string | null; email: string | null }
interface Device { commerce_id?: string | null; derived_status: string }

interface Props {
    commerces: Commerce[] | undefined;
    devices: Device[];            // pantallas vinculadas (sin las que esperan código)
    isSuperAdmin: boolean;
    onDelete?: (commerce: Commerce) => void;
}

export function CommerceDirectory({ commerces, devices, isSuperAdmin, onDelete }: Props) {
    const { data: accountsData } = useAdminAccounts(isSuperAdmin);
    const now = useNow(60000);
    const [tab, setTab] = useState<AccountStatus>('cliente');

    // Estado de cada negocio (si la migración no se corrió, todos quedan como clientes).
    const byId = useMemo(() => new Map((accountsData?.accounts || []).map(a => [a.id, a])), [accountsData]);
    const statusOf = (id: string) => accountStatus(byId.get(id), now);
    const list = commerces || [];

    // Sin super admin no hay pestañas: se ven sus comercios y listo.
    const visible = !isSuperAdmin
        ? list
        : list
            .filter(c => statusOf(c.id) === tab)
            .sort((a, b) => {
                // Pruebas: las que vencen antes, primero. Vencidas: las más recientes. El resto, por nombre.
                if (tab === 'prueba' || tab === 'vencida') {
                    const ea = Date.parse(byId.get(a.id)?.trial_ends_at || '') || 0;
                    const eb = Date.parse(byId.get(b.id)?.trial_ends_at || '') || 0;
                    return tab === 'prueba' ? ea - eb : eb - ea;
                }
                return (a.name || '').localeCompare(b.name || '');
            });

    return (
        <div className="space-y-4">
            {isSuperAdmin && accountsData?.error && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                    {accountsErrorText(accountsData.error)} Mientras tanto se muestran todos como clientes.
                </p>
            )}

            {isSuperAdmin && (
                <div className="flex flex-wrap gap-2" role="tablist">
                    {TABS.map(t => {
                        const count = list.filter(c => statusOf(c.id) === t.id).length;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                role="tab"
                                aria-selected={tab === t.id}
                                onClick={() => setTab(t.id)}
                                className={cn('rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                                    tab === t.id ? 'border-indigo-500 bg-indigo-500/15 text-white' : 'border-slate-800 text-slate-400 hover:text-white hover:border-slate-600')}
                            >
                                {t.label}{' '}
                                <span className={cn('ml-1 rounded-full px-1.5 text-xs', t.id === 'prueba' && count > 0 ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300')}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map(commerce => {
                    const own = devices.filter(d => d.commerce_id === commerce.id);
                    return (
                        <AccountCard
                            key={commerce.id}
                            commerce={commerce}
                            account={isSuperAdmin ? byId.get(commerce.id) || null : null}
                            screens={{
                                total: own.length,
                                online: own.filter(d => d.derived_status === 'online').length,
                                offline: own.filter(d => d.derived_status === 'offline').length,
                            }}
                            now={now}
                            onDelete={isSuperAdmin && onDelete ? () => onDelete(commerce) : undefined}
                        />
                    );
                })}

                {visible.length === 0 && (
                    <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl">
                        <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-white">{isSuperAdmin ? EMPTY[tab].title : 'No hay comercios'}</h3>
                        {isSuperAdmin && <p className="text-slate-400 text-sm mt-2">{EMPTY[tab].text}</p>}
                    </div>
                )}
            </div>
        </div>
    );
}
