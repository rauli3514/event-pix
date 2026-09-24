import { Outlet } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUserProfile } from "@/hooks/use-roles";

/**
 * Guard de segundo nivel para rutas admin sensibles (ej. /admin/intelligence).
 * A diferencia de ProtectedRoute (que solo exige una sesión válida), este
 * verifica que el perfil autenticado tenga role === 'super_admin' en la tabla
 * `profiles` antes de montar cualquier componente hijo — evita que un usuario
 * autenticado sin permisos llegue a hidratar datos confidenciales del negocio.
 *
 * Nota: el esquema actual de `profiles.role` solo admite 'super_admin' | 'provider'
 * (ver supabase/migrations/004_roles_and_permissions.sql). No existe un rol 'admin'
 * separado, por eso el chequeo es contra 'super_admin'.
 */
export const RequireSuperAdmin = () => {
    // @ts-expect-error - supabaseUrl no está tipado en todas las versiones del cliente
    const isMock = supabase.supabaseUrl?.includes('placeholder');

    const { data: profile, isLoading } = useUserProfile();

    if (isMock) {
        // Sin backend real conectado (modo demo/local): igual que ProtectedRoute,
        // se permite el acceso para no bloquear el desarrollo.
        return <Outlet />;
    }

    if (isLoading) {
        return null; // Loading state, igual criterio que ProtectedRoute
    }

    if (!profile || profile.role !== 'super_admin') {
        return <AccessDenied />;
    }

    return <Outlet />;
};

function AccessDenied() {
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
                <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
                    <ShieldAlert className="w-7 h-7 text-rose-400" />
                </div>
                <h1 className="text-lg font-bold text-slate-100">Acceso Denegado (403)</h1>
                <p className="text-sm text-slate-400 mt-2">
                    No tenés permisos de administrador para ver este módulo. Si creés que esto es un
                    error, contactá a un super administrador de la cuenta.
                </p>
                <a
                    href="/usuarios"
                    className="inline-block mt-5 text-sm font-semibold text-violet-400 hover:text-violet-300"
                >
                    Volver al inicio
                </a>
            </div>
        </div>
    );
}
