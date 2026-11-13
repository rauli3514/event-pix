import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarPlus, ChevronRight, Loader2, Monitor, MoreVertical, NotebookPen, Presentation, UserCheck, UserX } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/fudo';
import { STATUS_LABEL, TRIAL_DAYS, accountStatus, accountsErrorText, daysLeft, trialWhatsappUrl, type AccountPlan, type AdminAccount } from '@/lib/accounts';
import { useSaveTrialNotes, useSetAccountPlan } from '@/hooks/use-accounts';

interface Props {
    commerce: { id: string; name: string | null; email: string | null };
    account: AdminAccount | null;   // null: la migración todavía no se corrió
    screens: { total: number; online: number; offline: number };
    now: number;
}

const BADGE: Record<string, string> = {
    cliente: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    prueba: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
    vencida: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    baja: 'bg-slate-700/40 text-slate-400 border-slate-600',
};

// Un negocio en el Directorio de Clientes: estado, datos del registro de prueba,
// cuánto usó la cuenta y las acciones (pasar a cliente, extender, dar de baja).
export function AccountCard({ commerce, account, screens, now }: Props) {
    const status = accountStatus(account, now);
    const signup = account?.signup || null;
    const setPlan = useSetAccountPlan();
    const [notesOpen, setNotesOpen] = useState(false);
    const name = commerce.name || 'Sin nombre';

    const change = async (plan: AccountPlan, extendDays?: number, ok?: string) => {
        try {
            await setPlan.mutateAsync({ commerceId: commerce.id, plan, extendDays });
            if (ok) toast.success(ok);
        } catch (e) {
            toast.error(accountsErrorText((e as Error).message));
        }
    };

    const wa = signup ? trialWhatsappUrl(signup) : null;
    const left = daysLeft(account?.trial_ends_at, now);

    return (
        <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-slate-700 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <Link to={`/admin/display/commerce/${commerce.id}/workspace`} className="group min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors truncate">{name}</h3>
                        {account && (
                            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-semibold', BADGE[status])}>
                                {STATUS_LABEL[status]}{status === 'prueba' ? ` · ${left === 1 ? 'queda 1 día' : `quedan ${left} días`}` : ''}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 truncate">{commerce.email}</p>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                    {account && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button type="button" aria-label={`Acciones de ${name}`} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800">
                                    {setPlan.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-4 h-4" />}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                {status !== 'cliente' && (
                                    <DropdownMenuItem onClick={() => change('cliente', undefined, `${name} pasó a cliente`)}>
                                        <UserCheck className="w-4 h-4 mr-2" /> Pasar a cliente
                                    </DropdownMenuItem>
                                )}
                                {(status === 'prueba' || status === 'vencida') && (
                                    <DropdownMenuItem onClick={() => change('prueba', TRIAL_DAYS, `Prueba extendida ${TRIAL_DAYS} días`)}>
                                        <CalendarPlus className="w-4 h-4 mr-2" /> Extender {TRIAL_DAYS} días
                                    </DropdownMenuItem>
                                )}
                                {signup && (
                                    <DropdownMenuItem onClick={() => setNotesOpen(true)}>
                                        <NotebookPen className="w-4 h-4 mr-2" /> Notas
                                    </DropdownMenuItem>
                                )}
                                {status !== 'baja' && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-rose-500 focus:text-rose-500"
                                            onClick={() => { if (window.confirm(`¿Dar de baja a ${name}?`)) change('baja', undefined, `${name} quedó dado de baja`); }}
                                        >
                                            <UserX className="w-4 h-4 mr-2" /> Dar de baja
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Link to={`/admin/display/commerce/${commerce.id}/workspace`} aria-label={`Abrir el panel de ${name}`}
                        className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {signup && (
                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-200 font-medium truncate">{signup.contact_name}</span>
                        {wa && (
                            <a href={wa} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366]/15 text-[#4ade80] px-2.5 py-1 text-xs font-semibold hover:bg-[#25D366]/25 shrink-0">
                                <FaWhatsapp className="w-3.5 h-3.5" /> {signup.whatsapp}
                            </a>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400">
                        {[signup.rubro, signup.city, signup.tv_count && `${signup.tv_count} TV`, signup.uses_fudo && `Fudo: ${signup.uses_fudo}`, signup.source && `Nos conoció por ${signup.source}`]
                            .filter(Boolean)
                            .map(t => <span key={t as string} className="rounded-full bg-slate-800 px-2 py-0.5">{t}</span>)}
                    </div>
                    {signup.notes && <p className="text-xs text-amber-200/80 whitespace-pre-line">📝 {signup.notes}</p>}
                </div>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-slate-800/80 pt-3 text-sm text-slate-400">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5"><Monitor className="w-4 h-4" /> {screens.total} {screens.total === 1 ? 'pantalla' : 'pantallas'}</span>
                    {account && <span className="flex items-center gap-1.5"><Presentation className="w-4 h-4" /> {account.posters} {account.posters === 1 ? 'cartel' : 'carteles'}</span>}
                </div>
                <div className="flex gap-2">
                    {screens.online > 0 && (
                        <span className="flex items-center text-xs font-bold text-emerald-400 gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {screens.online}
                        </span>
                    )}
                    {screens.offline > 0 && (
                        <span className="flex items-center text-xs font-bold text-rose-400 gap-1 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {screens.offline}
                        </span>
                    )}
                </div>
            </div>
            {account && signup && (
                <p className="-mt-2 text-[11px] text-slate-500">
                    Se registró {timeAgo(signup.created_at, now)}
                    {account.last_sign_in_at ? ` · último ingreso ${timeAgo(account.last_sign_in_at, now)}` : ''}
                </p>
            )}

            {notesOpen && signup && <NotesDialog signupId={signup.id} initial={signup.notes || ''} name={name} onClose={() => setNotesOpen(false)} />}
        </div>
    );
}

function NotesDialog({ signupId, initial, name, onClose }: { signupId: string; initial: string; name: string; onClose: () => void }) {
    const [notes, setNotes] = useState(initial);
    const save = useSaveTrialNotes();
    const submit = async () => {
        try {
            await save.mutateAsync({ signupId, notes });
            onClose();
        } catch (e) {
            toast.error(accountsErrorText((e as Error).message));
        }
    };
    return (
        <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Notas · {name}</DialogTitle>
                    <DialogDescription>Solo las ve el equipo. Por ejemplo: "lo llamé el martes, quiere 2 TV".</DialogDescription>
                </DialogHeader>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} maxLength={2000} autoFocus />
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button onClick={submit} disabled={save.isPending}>{save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
