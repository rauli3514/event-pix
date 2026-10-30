import { useEffect, useState } from 'react';

// La hora actual, redondeada al minuto; cambia cuando empieza cada minuto.
export function useNowMinute(): Date {
    const [now, setNow] = useState(() => floorMinute(new Date()));
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        const tick = () => {
            const next = floorMinute(new Date());
            setNow(prev => (prev.getTime() === next.getTime() ? prev : next));
            timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
        };
        timer = setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
        return () => clearTimeout(timer);
    }, []);
    return now;
}

function floorMinute(d: Date) {
    const r = new Date(d);
    r.setSeconds(0, 0);
    return r;
}
