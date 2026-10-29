import { useEffect, useState } from 'react';
import { localDayKey } from '@/lib/playlistItems';

// Día de hoy ("AAAA-MM-DD"); cambia solo a la medianoche (se revisa cada minuto).
export function useLocalDay(): string {
    const [day, setDay] = useState(localDayKey);
    useEffect(() => {
        const timer = setInterval(() => setDay(localDayKey()), 60_000);
        return () => clearInterval(timer);
    }, []);
    return day;
}
