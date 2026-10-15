import { useEffect, useMemo, useState } from "react";
import type { Event } from "@/types";

// Ayudas para los diseños del muro (ver components/display/WallChrome)

/** Dirección de la página del invitado (la que abre el QR) */
export const useGuestUrl = (event: Pick<Event, 'slug'> | null | undefined) =>
    useMemo(() => (event?.slug ? `${window.location.origin}/${event.slug}` : window.location.origin), [event?.slug]);

/** Pantalla vertical (TV girada o tótem) */
export const useIsPortrait = () => {
    const [portrait, setPortrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
    useEffect(() => {
        const mq = window.matchMedia('(orientation: portrait)');
        const onChange = () => setPortrait(mq.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return portrait;
};
