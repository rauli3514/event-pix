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

// Rotación de una playlist. La duración de cada item es un mínimo para los
// videos: nunca se cortan a la mitad. Un video más largo que su tiempo se ve
// completo; uno más corto se repite hasta cumplirlo, terminando la vuelta en curso.
// contentKey: cuando cambia (otra playlist, otra franja horaria) se arranca desde el primer item.
export function usePlaylistRotation(items: RotationItem[], enabled: boolean, contentKey?: string | null) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [lastContentKey, setLastContentKey] = useState(contentKey);
    if (contentKey !== lastContentKey) {
        setLastContentKey(contentKey);
        setCurrentIndex(0);
    }

    const itemsRef = useRef(items);
    useLayoutEffect(() => {
        itemsRef.current = items;
    }, [items]);

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
        setCurrentIndex(i => (count > 0 ? (i + 1) % count : 0));
    }, []);

    useEffect(() => {
        if (!enabled || items.length === 0) return;

        const item = items[currentIndex];
        if (!item) {
            setCurrentIndex(0);
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

    return { currentIndex, setCurrentIndex, onVideoEnded, onVideoError, onVideoDuration };
}
