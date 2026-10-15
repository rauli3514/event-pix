import { Check, LayoutTemplate } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { EventSettings } from "@/hooks/use-event-settings";

type Template = EventSettings['display_template'];

// Dibujitos de cada diseño para elegir sin tener que probarlos en la pantalla
const Preview = ({ template }: { template: Template }) => {
    if (template === 'slideshow') {
        return (
            <div className="relative h-full w-full p-2">
                <div className="mx-auto h-full w-[45%] rounded bg-gradient-to-br from-slate-400 to-slate-600" />
                <div className="absolute right-2 top-2 h-3 w-3 rounded-sm bg-white" />
            </div>
        );
    }
    if (template === 'grid') {
        return (
            <div className="grid h-full w-full grid-cols-4 grid-rows-3 gap-1 p-2">
                {Array.from({ length: 12 }, (_, i) => (
                    <div key={i} className={cn('rounded-sm', i === 5 ? 'bg-violet-500/80' : 'bg-gradient-to-br from-slate-400 to-slate-600')} />
                ))}
            </div>
        );
    }
    return (
        <div className="flex h-full w-full gap-1 overflow-hidden p-2">
            {[[10, 6, 8], [6, 10, 7], [8, 7, 10], [7, 9, 6]].map((col, c) => (
                <div key={c} className="flex flex-1 flex-col gap-1" style={{ marginTop: c % 2 ? -6 : 0 }}>
                    {col.map((h, i) => (
                        <div key={i} className="rounded-sm bg-gradient-to-br from-slate-400 to-slate-600" style={{ height: h * 3 }} />
                    ))}
                </div>
            ))}
        </div>
    );
};

const OPTIONS: { id: Template; name: string; description: string }[] = [
    { id: 'slideshow', name: 'Presentación', description: 'Una foto grande por vez, con collage y ranking cada tanto.' },
    { id: 'grid', name: 'Cuadrícula', description: '12 fotos a la vez; cada pocos segundos cambia una.' },
    { id: 'masonry', name: 'Mosaico', description: 'Columnas que suben solas, estilo redes sociales.' },
];

interface WallDesignCardProps {
    current?: Template;
    onChange: (template: Template) => void;
}

export const WallDesignCard = ({ current = 'slideshow', onChange }: WallDesignCardProps) => (
    <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-100">
                <LayoutTemplate className="w-5 h-5 text-violet-400" /> Diseño del muro
            </CardTitle>
            <p className="text-sm text-slate-400">Cómo se ven las fotos en la pantalla. Se cambia al instante, aunque la pantalla esté encendida.</p>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {OPTIONS.map((opt) => {
                    const active = current === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => onChange(opt.id)}
                            className={cn(
                                'relative rounded-xl border-2 bg-slate-950/60 p-3 text-left transition-all hover:border-white/30',
                                active ? 'border-violet-500 ring-2 ring-violet-500/30' : 'border-slate-800'
                            )}
                        >
                            <div className="aspect-video overflow-hidden rounded-lg bg-slate-800">
                                <Preview template={opt.id} />
                            </div>
                            <p className="mt-3 font-semibold text-white">{opt.name}</p>
                            <p className="mt-1 text-xs text-slate-400 leading-snug">{opt.description}</p>
                            {active && (
                                <span className="absolute right-2 top-2 rounded-full bg-violet-500 p-1 text-white shadow">
                                    <Check className="h-3 w-3" />
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </CardContent>
    </Card>
);
