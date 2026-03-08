
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    LayoutDashboard,
    Images,
    Palette,
    Settings,
    Download,
    LogOut,
    Monitor,
    Gamepad2,
    Heart
} from "lucide-react";

interface AdminSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout: () => void;
    eventName?: string;
    className?: string;
}

export const AdminSidebar = ({ activeTab, onTabChange, onLogout, eventName, className }: AdminSidebarProps) => {
    const mainNav = [
        { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
        { id: "moderation", label: "Moderación", icon: Images },
        { id: "trivia", label: "Trivia", icon: Gamepad2 },
        { id: "voting", label: "Votación", icon: Heart },
        { id: "design", label: "Diseño y Temas", icon: Palette },
        { id: "display", label: "Pantalla", icon: Monitor },
        { id: "settings", label: "Ajustes", icon: Settings },
        { id: "downloads", label: "Descargas", icon: Download },
    ];


    return (
        <div className={cn("hidden md:flex w-64 flex-col bg-slate-950 border-r border-slate-800 h-screen fixed left-0 top-0 z-50", className)}>
            <div className="p-6">
                <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                    {eventName || "EventPix"}
                </h2>
                <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Panel de Control</p>
            </div>

            <div className="flex-1 px-4 space-y-2">
                {mainNav.map((item) => (
                    <Button
                        key={item.id}
                        variant={activeTab === item.id ? "secondary" : "ghost"}
                        className={cn(
                            "w-full justify-start text-sm font-medium",
                            activeTab === item.id
                                ? "bg-slate-800 text-white"
                                : "text-slate-400 hover:text-white hover:bg-slate-900"
                        )}
                        onClick={() => onTabChange(item.id)}
                    >
                        <item.icon className="mr-3 h-4 w-4" />
                        {item.label}
                    </Button>
                ))}
            </div>

            <div className="p-4 border-t border-slate-800">
                <Button variant="ghost" onClick={onLogout} className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-950/20">
                    <LogOut className="mr-3 h-4 w-4" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
};
