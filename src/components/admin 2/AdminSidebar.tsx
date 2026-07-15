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
    Heart,
    X
} from "lucide-react";

interface AdminSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout: () => void;
    eventName?: string;
    className?: string;
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
}

export const AdminSidebar = ({ activeTab, onTabChange, onLogout, eventName, className, isMobileOpen, onMobileClose }: AdminSidebarProps) => {
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
        <>
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                    onClick={onMobileClose}
                />
            )}
            <div className={cn(
                "w-64 flex flex-col bg-slate-950 border-r border-slate-800 h-screen fixed left-0 top-0 z-50 transition-transform duration-300 md:translate-x-0",
                isMobileOpen ? "translate-x-0" : "-translate-x-full",
                className
            )}>
                <div className="p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                            {eventName || "EventPix"}
                        </h2>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">Panel de Control</p>
                    </div>
                    {isMobileOpen && (
                        <Button variant="ghost" size="icon" onClick={onMobileClose} className="md:hidden text-slate-400">
                            <X className="w-5 h-5" />
                        </Button>
                    )}
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
        </>
    );
};
