import { useEffect, useState } from 'react';

// La hora actual, que se actualiza cada `everyMs` (para cuentas regresivas).
export function useNow(everyMs = 30000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), everyMs);
        return () => clearInterval(id);
    }, [everyMs]);
    return now;
}
