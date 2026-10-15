import { useEffect, useRef, useState } from "react";
import { Check, Paintbrush } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACCENT_PRESETS, DEFAULT_ACCENT, accentGradient, validAccent } from "@/lib/wallAccent";

interface AccentColorCardProps {
    current?: string | null;
    onChange: (color: string | null) => void;
}

/** Color del evento: botones del celular, avisos y detalles del muro */
export const AccentColorCard = ({ current, onChange }: AccentColorCardProps) => {
    // El selector libre manda muchos cambios al arrastrar: se guarda cuando se suelta un ratito.
    // Mientras, se muestra el borrador (vale solo para el color guardado sobre el que se hizo).
    const [draft, setDraft] = useState<{ base?: string | null; color: string } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => clearTimeout(timer.current), []);
    const pickFree = (color: string) => {
        setDraft({ base: current, color });
        clearTimeout(timer.current);
        timer.current = setTimeout(() => onChange(color), 500);
    };

    const shown = (draft && draft.base === current ? validAccent(draft.color) : null) ?? validAccent(current);
    const active = shown || DEFAULT_ACCENT;
    return (
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-slate-100">
                    <Paintbrush className="w-5 h-5 text-violet-400" /> Color del evento
                </CardTitle>
                <p className="text-sm text-slate-400">
                    Se usa en el botón "Subí tu foto" del celular, en el aviso de foto nueva y en los detalles del muro.
                    Al elegir un tema se pone su color; acá lo podés cambiar.
                </p>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-3">
                    {ACCENT_PRESETS.map((p) => {
                        const selected = active === p.color;
                        return (
                            <button
                                key={p.color}
                                type="button"
                                title={p.name}
                                aria-label={p.name}
                                onClick={() => onChange(p.color === DEFAULT_ACCENT ? null : p.color)}
                                className={cn(
                                    'h-11 w-11 rounded-full ring-offset-2 ring-offset-slate-900 transition-transform hover:scale-110 flex items-center justify-center',
                                    selected ? 'ring-2 ring-white' : 'ring-1 ring-white/10'
                                )}
                                style={{ backgroundColor: p.color }}
                            >
                                {selected && <Check className="h-5 w-5" style={{ color: accentGradient(p.color)?.color }} />}
                            </button>
                        );
                    })}
                    <label
                        title="Otro color"
                        className="relative h-11 w-11 cursor-pointer overflow-hidden rounded-full ring-1 ring-white/10 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] transition-transform hover:scale-110"
                    >
                        <input
                            type="color"
                            value={active}
                            onChange={(e) => pickFree(e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                    </label>
                </div>

                {/* Vista previa del botón del invitado */}
                <div className="rounded-2xl bg-slate-950/70 p-4">
                    <p className="mb-2 text-xs text-slate-500">Así se ve en el celular:</p>
                    <div
                        className="flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-lg font-extrabold text-white shadow-xl"
                        style={accentGradient(shown)}
                    >
                        📷 Subí tu foto a la pantalla
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
