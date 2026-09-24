import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const ProtectedRoute = () => {
    const [session, setSession] = useState<boolean | null>(null);
    const location = useLocation();

    useEffect(() => {
        // Check if we are in mock mode (placeholder URL)
        // @ts-ignore - supabaseUrl is a property of the client but might not be typed in all versions
        const isMock = supabase.supabaseUrl?.includes('placeholder');

        if (isMock) {
            // In mock mode, we allow access to admin for demonstration
            setSession(true);
            return;
        }

        const timer = setTimeout(() => {
            setSession((prev) => (prev === null ? false : prev));
        }, 2500);

        supabase.auth.getSession().then(({ data: { session } }) => {
            clearTimeout(timer);
            setSession(!!session);
        }).catch((error) => {
            console.error("Auth check failed:", error);
            clearTimeout(timer);
            setSession(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(!!session);
        });

        return () => {
            clearTimeout(timer);
            subscription.unsubscribe();
        };
    }, []);

    if (session === null) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-slate-400">Verificando acceso...</p>
            </div>
        );
    }

    const isIntelligenceRoute = location.pathname.startsWith('/intelligence') || location.pathname.startsWith('/admin/intelligence');
    if (isIntelligenceRoute) {
        return session ? <Outlet /> : <Navigate to="/intelligence/login" state={{ from: location.pathname }} replace />;
    }

    const isDisplayUser = localStorage.getItem('display_user_mode') === 'true';
    return session ? <Outlet /> : <Navigate to={isDisplayUser ? "/usuarios" : "/login"} replace />;
};
