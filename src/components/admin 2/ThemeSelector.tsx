import { useState } from "react";
import { THEME_CATEGORIES } from "@/lib/themes";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ThemeSelectorProps {
    currentBackground: string | null;
    onSelectTheme: (imageUrl: string, fontFamily: string, frameUrl?: string) => void;
}

export const ThemeSelector = ({ currentBackground, onSelectTheme }: ThemeSelectorProps) => {
    const [selectedCategory, setSelectedCategory] = useState<string>(THEME_CATEGORIES[0].id);

    return (
        <div className="space-y-6">
            <h3 className="font-medium text-lg text-foreground">Seleccionar Tema y Fondo</h3>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {THEME_CATEGORIES.map((category) => (
                    <Button
                        key={category.id}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedCategory(category.id)}
                        className={cn(
                            "whitespace-nowrap border-slate-700",
                            selectedCategory === category.id
                                ? "bg-violet-600 text-white hover:bg-violet-700"
                                : "bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
                        )}
                    >
                        {category.name}
                    </Button>
                ))}
            </div>

            {/* Themes Grid */}
            <div className="grid grid-cols-1 gap-6">
                {THEME_CATEGORIES.find(c => c.id === selectedCategory)?.themes.map((theme) => (
                    <div key={theme.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <h4 className={`text-base font-semibold ${theme.font}`}>{theme.name}</h4>
                                <p className="text-xs text-muted-foreground">{theme.description}</p>
                            </div>
                            <div className="px-2 py-1 bg-white/5 rounded text-[10px] text-muted-foreground border border-white/10">
                                {theme.fontName}
                            </div>
                        </div>

                        {/* Variants Scroll */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {theme.variants.map((variant) => {
                                const isActive = currentBackground === variant.imageUrl;
                                return (
                                    <div
                                        key={variant.id}
                                        className={cn(
                                            "group relative aspect-[2/3] rounded-lg overflow-hidden cursor-pointer border-2 transition-all hover:scale-105",
                                            isActive ? "border-primary ring-2 ring-primary/30" : "border-transparent hover:border-white/20"
                                        )}
                                        onClick={() => onSelectTheme(variant.imageUrl, theme.font, theme.frameUrl)}
                                    >
                                        <img
                                            src={variant.imageUrl}
                                            alt="Theme Variant"
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

                                        {isActive && (
                                            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-lg transform scale-100 transition-transform">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground pt-4 border-t border-white/10">
                *Cada categoría tiene su propia tipografía única. Selecciona una imagen para aplicar el estilo completo.
            </p>
        </div>
    );
};
