import { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { PlacaMakerModal } from '@/components/display/PlacaMakerModal';
import { PLACA_TEMPLATES, PLACA_TEMPLATE_IDS, defaultPlaca, drawPlaca, loadPlacaFonts, placaSize, type PlacaTemplateId } from '@/lib/placas';

// Los diseños de "Crear placa", con su ejemplo, para arrancar desde Plantillas.
export function PlacaTemplatesStrip({ commerceId }: { commerceId: string }) {
    const [open, setOpen] = useState<PlacaTemplateId | null>(null);
    const [fontsReady, setFontsReady] = useState(false);
    useEffect(() => {
        let cancelled = false;
        loadPlacaFonts().then(() => { if (!cancelled) setFontsReady(true); });
        return () => { cancelled = true; };
    }, []);

    return (
        <section className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 md:p-5 mb-8">
            <div className="flex flex-wrap items-end justify-between gap-2 mb-4">
                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-indigo-500" /> Hacé tu placa acá mismo</h2>
                    <p className="text-sm text-muted-foreground">Elegí un diseño, escribí el texto y el precio, y queda lista en Medios. Sin salir de la app.</p>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                {PLACA_TEMPLATE_IDS.map(id => (
                    <button key={id} type="button" onClick={() => setOpen(id)} className="group text-left rounded-xl border border-border bg-card p-2 hover:border-indigo-500/60 hover:shadow-md transition-all">
                        <ExampleCanvas id={id} fontsReady={fontsReady} />
                        <span className="block text-sm font-semibold mt-2">{PLACA_TEMPLATES[id].label}</span>
                        <span className="block text-xs text-muted-foreground line-clamp-1">{PLACA_TEMPLATES[id].hint}</span>
                    </button>
                ))}
            </div>
            <PlacaMakerModal isOpen={!!open} onClose={() => setOpen(null)} commerceId={commerceId} initialTemplate={open || undefined} />
        </section>
    );
}

function ExampleCanvas({ id, fontsReady }: { id: PlacaTemplateId; fontsReady: boolean }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const { width, height } = placaSize('landscape');
    const scale = 0.2;
    useEffect(() => {
        const ctx = ref.current?.getContext('2d');
        if (!ctx) return;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        drawPlaca(ctx, defaultPlaca(id), null);
    }, [id, fontsReady]);
    return <canvas ref={ref} width={width * scale} height={height * scale} className="w-full aspect-video rounded-lg bg-black" />;
}
