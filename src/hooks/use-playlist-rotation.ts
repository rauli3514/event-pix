import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_S = 10;
// Si un video no avisa que terminó (red trabada, archivo roto), se pasa al
// siguiente igual: su duración + este margen, o un tope fijo si no se conoce.
const VIDEO_END_GRACE_MS = 15 * 1000;
const VIDEO_UNKNOWN_LENGTH_CAP_MS = 3 * 60 * 1000;
// Un video roto se salta tras esta pausa (no al instante, para que una playlist
// con todos los videos rotos no gire en un bucle sin respiro).
const BROKEN_VIDEO_SKIP_MS = 1000;

interface RotationItem {
    type?: string;
    url?: string;
    duration?: number;
    loop?: boolean;
}

const isVideo = (item: RotationItem | undefined) => item?.type === 'video' || item?.type === 'video_ad';

// Orden de una vuelta: 0..n-1, o mezclado. first fija el item con el que
// empieza; avoidFirst evita repetir al empezar la vuelta el mismo item con el
// que terminó la anterior.
function buildOrder(count: number, shuffle: boolean, opts: { first?: number; avoidFirst?: number } = {}): number[] {
    const order = Array.from({ length: count }, (_, i) => i);
    if (!shuffle || count < 2) return order;
    for (let i = count - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    if (opts.first !== undefined && order.includes(opts.first)) {
        order.splice(order.indexOf(opts.first), 1);
        order.unshift(opts.first);
    } else if (opts.avoidFirst !== undefined && order[0] === opts.avoidFirst) {
        [order[0], order[1]] = [order[1], order[0]];
    }
    return order;
}

// Rotación de una playlist. La duración de cada item es un mínimo para los
// videos: nunca se cortan a la mitad. Un video más largo que su tiempo se ve
// completo; uno más corto se repite hasta cumplirlo, terminando la vuelta en curso.
// contentKey: cuando cambia (otra playlist, otra franja horaria) se arranca de nuevo.
// shuffle: "Orden aleatorio" de la playlist; se mezcla de nuevo en cada vuelta.
export function usePlaylistRotation(items: RotationItem[], enabled: boolean, contentKey?: string | null, shuffle = false) {
    // current = item en pantalla; prev = el que sale (transición); next = el que se precarga.
    const [position, setPosition] = useState({ current: 0, prev: -1, next: -1 });
    const currentIndex = position.current;

    // Contenido nuevo (otra playlist o franja, otra cantidad de items, cambio de
    // aleatorio): se vuelve al primer item durante el render, así nunca se pinta
    // un item de la playlist anterior.
    const resetKey = `${contentKey ?? ''}|${items.length}|${shuffle}`;
    const [lastResetKey, setLastResetKey] = useState(resetKey);
    if (resetKey !== lastResetKey) {
        setLastResetKey(resetKey);
        setPosition({ current: 0, prev: -1, next: -1 });
    }

    const itemsRef = useRef(items);
    const shuffleRef = useRef(shuffle);
    useLayoutEffect(() => {
        itemsRef.current = items;
        shuffleRef.current = shuffle;
    }, [items, shuffle]);

    // Orden de la vuelta actual y de la siguiente (para saber qué precargar).
    const orderRef = useRef<{ order: number[]; nextOrder: number[] }>({ order: [], nextOrder: [] });

    const peekNext = (current: number) => {
        const { order, nextOrder } = orderRef.current;
        const pos = order.indexOf(current);
        if (order.length < 2) return -1;
        return pos !== -1 && pos < order.length - 1 ? order[pos + 1] : nextOrder[0];
    };

    // Arma el orden de la vuelta empezando por el item actual. Corre antes de
    // pintar (layout effect), así el siguiente a precargar ya es el correcto.
    const buildCycles = useCallback((first: number) => {
        const count = itemsRef.current.length;
        const order = buildOrder(count, shuffleRef.current, { first });
        orderRef.current = { order, nextOrder: buildOrder(count, shuffleRef.current, { avoidFirst: order[count - 1] }) };
    }, []);

    useLayoutEffect(() => {
        buildCycles(0);
        setPosition(p => ({ ...p, next: peekNext(p.current) }));
    }, [lastResetKey, buildCycles]);

    const setCurrentIndex = useCallback((index: number) => {
        setPosition(p => ({ current: index, prev: p.current !== index ? p.current : -1, next: peekNext(index) }));
    }, []);

    // Estado del item en pantalla. Se reinicia en un layout effect (no en un
    // useEffect) porque los efectos del video (hijo) corren antes que los de este
    // hook y pueden avisar un error apenas el item pasa a ser el activo; los
    // layout effects corren antes que todos ellos.
    const itemStateRef = useRef({ index: -1, timeUp: false, videoStopped: false });
    useLayoutEffect(() => {
        itemStateRef.current = { index: currentIndex, timeUp: false, videoStopped: false };
    }, [currentIndex]);
    // Duración real de cada video por URL (el aviso puede llegar mientras precarga).
    const videoLengthsRef = useRef<Map<string, number>>(new Map());
    const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const errorSkipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const advance = useCallback(() => {
        const count = itemsRef.current.length;
        if (count === 0) return;
        const current = itemStateRef.current.index;

        if (orderRef.current.order.length !== count) buildCycles(current);
        const { order, nextOrder } = orderRef.current;
        const pos = order.indexOf(current);

        let next: number;
        if (pos !== -1 && pos < order.length - 1) {
            next = order[pos + 1];
        } else {
            // Fin de la vuelta: empieza la siguiente (mezclada de nuevo si corresponde).
            orderRef.current = { order: nextOrder, nextOrder: buildOrder(count, shuffleRef.current, { avoidFirst: nextOrder[count - 1] }) };
            next = nextOrder[0];
        }
        setPosition({ current: next, prev: count > 1 ? current : -1, next: peekNext(next) });
    }, [buildCycles]);

    useEffect(() => {
        if (!enabled || items.length === 0) return;

        const item = items[currentIndex];
        if (!item) {
            setPosition({ current: 0, prev: -1, next: -1 });
            return;
        }

        const state = itemStateRef.current;
        state.timeUp = false;

        const durationMs = (item.duration && item.duration > 0 ? item.duration : DEFAULT_DURATION_S) * 1000;
        const timer = setTimeout(() => {
            state.timeUp = true;
            if (!isVideo(item) || state.videoStopped) {
                advance();
                return;
            }
            // Video en curso: se espera a que termine la vuelta actual (onVideoEnded).
            const lengthS = item.url ? videoLengthsRef.current.get(item.url) : undefined;
            const capMs = lengthS ? lengthS * 1000 + VIDEO_END_GRACE_MS : VIDEO_UNKNOWN_LENGTH_CAP_MS;
            safetyTimeoutRef.current = setTimeout(advance, capMs);
        }, durationMs);

        return () => {
            clearTimeout(timer);
            if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
            safetyTimeoutRef.current = null;
            if (errorSkipRef.current) clearTimeout(errorSkipRef.current);
            errorSkipRef.current = null;
        };
    }, [currentIndex, items, enabled, advance]);

    // Devuelve true si el reproductor se encargó (pasó al siguiente o el video
    // queda quieto en el último cuadro); false para volver a reproducirlo.
    const onVideoEnded = useCallback((index: number) => {
        const state = itemStateRef.current;
        if (index !== state.index) return true;
        const item = itemsRef.current[index];
        if (state.timeUp && itemsRef.current.length > 1) {
            advance();
            return true;
        }
        if (item?.loop === false) {
            state.videoStopped = true;
            return true;
        }
        return false;
    }, [advance]);

    // Video roto o que no carga: no tiene sentido mostrar negro, se pasa al siguiente.
    const onVideoError = useCallback((index: number) => {
        const state = itemStateRef.current;
        if (index !== state.index) return;
        if (state.videoStopped) return;
        state.videoStopped = true;
        if (itemsRef.current.length > 1) {
            if (errorSkipRef.current) clearTimeout(errorSkipRef.current);
            errorSkipRef.current = setTimeout(advance, BROKEN_VIDEO_SKIP_MS);
        }
    }, [advance]);

    const onVideoDuration = useCallback((index: number, seconds: number) => {
        const url = itemsRef.current[index]?.url;
        if (url && Number.isFinite(seconds) && seconds > 0) {
            videoLengthsRef.current.set(url, seconds);
        }
    }, []);

    return {
        currentIndex,
        prevIndex: position.prev,
        nextIndex: position.next,
        setCurrentIndex,
        onVideoEnded,
        onVideoError,
        onVideoDuration,
    };
}
