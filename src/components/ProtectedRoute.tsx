import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export const ProtectedRoute = () => {
    const [session, setSession] = useState<boolean | null>(null);

    useEffect(() => {
        // Check if we are in mock mode (placeholder URL)
        // @ts-ignore - supabaseUrl is a property of the client but might not be typed in all versions
        const isMock = supabase.supabaseUrl?.includes('placeholder');

        if (isMock) {
            // In mock mode, we allow access to admin for demonstration
            setSession(true);
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(!!session);
        }).catch((error) => {
            console.error("Auth check failed:", error);
            setSession(false);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (session === null) {
        return null; // Loading state
    }

    const isDisplayUser = localStorage.getItem('display_user_mode') === 'true';
    return session ? <Outlet /> : <Navigate to={isDisplayUser ? "/usuarios" : "/login"} replace />;
};
