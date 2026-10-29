import { type ReactNode, useEffect, useRef, useState } from 'react';

interface Props {
    // Tamaño mínimo para el que está diseñado el contenido, según el ancho real.
    minSize: (width: number) => { width: number; height: number };
    // Recibe el tamaño "virtual" en el que se dibuja (>= minSize).
    children: (size: { width: number; height: number }) => ReactNode;
}

// Dibuja el contenido a su tamaño de diseño y lo achica parejo hasta que entre
// entero en su recuadro (sin cortar ni encimar textos). En un recuadro grande
// no agranda: usa el espacio real.
export function FitBox({ minSize, children }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            const rect = entries[0].contentRect;
            setSize({ width: rect.width, height: rect.height });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const { width, height } = size;
    let inner: ReactNode = null;
    if (width > 0 && height > 0) {
        const min = minSize(width);
        const scale = Math.min(1, width / min.width, height / min.height);
        const virtual = { width: width / scale, height: height / scale };
        inner = (
            <div style={{ position: 'absolute', top: 0, left: 0, width: virtual.width, height: virtual.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                {children(virtual)}
            </div>
        );
    }
    return <div ref={ref} className="absolute inset-0 overflow-hidden z-10">{inner}</div>;
}
