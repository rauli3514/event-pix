import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Monitor,
  FolderOpen,
  ListVideo,
  Puzzle,
  Calendar,
  ArrowLeft,
  Menu,
  LogOut,
  Database,
  Bluetooth,
  ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useCommerces } from '@/hooks/use-display-hub';
import { supabase } from '@/lib/supabase';
import { Bot, Sparkles } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { BluetoothProvisioningModal } from '@/components/display/BluetoothProvisioningModal';
import { AIAssistantPanel } from '@/components/display/ai/AIAssistantPanel';
import { IntelligenceStorageService } from '@/services/intelligence/IntelligenceStorageService';
import { ScreenDownAlert } from '@/components/display/ScreenDownAlert';
import { useDownScreens } from '@/hooks/use-down-screens';

// Menú en grupos: lo de todos los días arriba y lo que se usa poco dentro de
// "Más" (cerrado salvo que se esté en una de sus páginas).
interface MenuItem {
  id: string;
  label: string;
  icon: typeof Monitor;
  path: string;
  // Otras páginas que marcan este item como activo.
  alsoActive?: string[];
}

const MENU_GROUPS: { title: string; items: MenuItem[] }[] = [
  {
    title: 'Día a día',
    items: [
      { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard, path: 'dashboard' },
      { id: 'screens', label: 'Pantallas', icon: Monitor, path: 'screens' },
      { id: 'schedule', label: 'Programación', icon: Calendar, path: 'schedule' },
    ],
  },
  {
    title: 'Contenido',
    items: [
      { id: 'library', label: 'Medios', icon: FolderOpen, path: 'library' },
      { id: 'playlists', label: 'Playlists', icon: ListVideo, path: 'playlists' },
      { id: 'apps', label: 'Apps y plantillas', icon: Puzzle, path: 'apps', alsoActive: ['templates'] },
    ],
  },
];

const MORE_ITEMS: MenuItem[] = [
  { id: 'labels', label: 'Etiquetas', icon: Database, path: 'labels' },
  { id: 'ai-knowledge', label: 'Conocimiento IA', icon: Bot, path: 'ai-knowledge' },
];

// Apps y Plantillas comparten un lugar en el menú: pestañas para pasar de una a otra.
const APPS_TABS = [
  { path: 'apps', label: 'Apps' },
  { path: 'templates', label: 'Plantillas' },
];

export default function DisplayWorkspaceLayout() {
  const location = useLocation();
  const { commerceId } = useParams();
  const navigate = useNavigate();
  const { data: commerces } = useCommerces();
  
  const isDisplayUser = localStorage.getItem('display_user_mode') === 'true';

  const handleLogout = async () => {
      await supabase.auth.signOut();
      navigate('/usuarios');
  };
  
  const currentCommerce = commerces?.find(c => c.id === commerceId);
  // Pantallas sin conexión hace más de 10 min (número rojo en "Pantallas").
  const downCount = useDownScreens(commerceId).length;
  const basePath = `/admin/display/commerce/${commerceId}/workspace`;

  const isAt = (path: string) => location.pathname.startsWith(`${basePath}/${path}`);
  const moreItems = MORE_ITEMS.filter(item => !(item.id === 'ai-knowledge' && isDisplayUser));
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  // Siempre abierto si se está en una de sus páginas.
  const inMore = moreItems.some(item => isAt(item.path));
  const moreOpen = isMoreOpen || inMore;
  const appsTab = APPS_TABS.find(tab => isAt(tab.path));

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isBluetoothOpen, setIsBluetoothOpen] = useState(false);
  const isNativeAndroid = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // checkAndPublish removed as Schedules V2 are evaluated locally by the TvPlayer.

  const renderNavLink = (item: MenuItem) => {
    const isActive = isAt(item.path) || (item.alsoActive || []).some(isAt);
    return (
      <Link
        key={item.id}
        to={`${basePath}/${item.path}`}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground")} />
        <span className="truncate">{item.label}</span>
        {item.id === 'screens' && downCount > 0 && (
          <span className="ml-auto min-w-5 h-5 px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center" title="Pantallas sin conexión">
            {downCount}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-4 border-b border-border shrink-0 transition-colors duration-300">
        <Button variant="ghost" size="sm" onClick={isDisplayUser ? handleLogout : undefined} asChild={!isDisplayUser} className="text-muted-foreground hover:text-foreground hover:bg-muted -ml-2 mr-2 px-2">
          {isDisplayUser ? (
             <LogOut className="w-4 h-4" />
          ) : (
            <Link to="/admin/display">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
        </Button>
        <div className="flex flex-col overflow-hidden">
          <div className="font-bold text-lg font-[Orbitron] text-foreground leading-tight transition-colors duration-300">
            Display <span className="text-indigo-500">Hub</span>
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[130px] md:max-w-full" title={currentCommerce?.name || ''}>
            {currentCommerce?.name || 'Cargando...'}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {MENU_GROUPS.map(group => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.title}</p>
            {group.items.map(renderNavLink)}
          </div>
        ))}

        <div className="space-y-1">
          <button
            onClick={() => setIsMoreOpen(!moreOpen)}
            className="w-full flex items-center justify-between px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
            aria-expanded={moreOpen}
          >
            Más
            <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", moreOpen && "rotate-180")} />
          </button>
          {moreOpen && (
            <>
              {moreItems.map(renderNavLink)}
              <button
                onClick={() => {
                  if (commerceId) {
                    IntelligenceStorageService.setActiveBusinessId(commerceId);
                  }
                  navigate('/admin/intelligence');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Sparkles className="w-5 h-5 shrink-0 text-muted-foreground" />
                <span className="truncate">EventPix Intelligence</span>
              </button>
              <button
                onClick={() => {
                  if (commerceId) localStorage.removeItem(`onboarding_dismissed_${commerceId}`);
                  navigate(`${basePath}/dashboard?guia=1`);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Sparkles className="w-5 h-5 shrink-0 text-muted-foreground" />
                <span className="truncate">Guía para empezar</span>
              </button>
              {/* Bluetooth — solo en app Android nativa (celular) */}
              {isNativeAndroid && (
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setTimeout(() => setIsBluetoothOpen(true), 150);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Bluetooth className="w-5 h-5 shrink-0 text-muted-foreground" />
                  <span className="truncate">Configurar TV (Bluetooth)</span>
                </button>
              )}
            </>
          )}
        </div>
      </nav>
      
      <div className="p-4 border-t border-border mt-auto flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Tema</span>
        <ThemeToggle />
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-background text-foreground overflow-hidden font-sans flex-col md:flex-row transition-colors duration-300">
      
      {/* Mobile Top Navbar */}
      <div className="md:hidden h-14 shrink-0 bg-card border-b border-border flex items-center justify-between px-4 z-20 transition-colors duration-300">
        <div className="flex items-center gap-2 overflow-hidden">
            <Button variant="ghost" size="icon" onClick={isDisplayUser ? handleLogout : undefined} asChild={!isDisplayUser} className="text-muted-foreground hover:text-foreground">
                {isDisplayUser ? (
                   <LogOut className="w-5 h-5" />
                ) : (
                  <Link to="/admin/display">
                      <ArrowLeft className="w-5 h-5" />
                  </Link>
                )}
            </Button>
            <div className="flex flex-col min-w-0">
                <div className="font-bold text-base font-[Orbitron] text-foreground leading-tight truncate">
                    Display <span className="text-indigo-500">Hub</span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                    {currentCommerce?.name}
                </div>
            </div>
        </div>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 bg-card border-r-border flex flex-col transition-colors duration-300">
            <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-card border-r border-border flex-col h-full z-20 transition-colors duration-300">
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background transition-colors duration-300">
        {/* Decorative background blurs for aesthetics */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto">
          <ScreenDownAlert commerceId={commerceId} hideBanner={location.pathname.endsWith('/dashboard')} />
          {appsTab && (
            <div className="px-4 md:px-8 pt-4 md:pt-6">
              <div className="inline-flex rounded-lg border border-border bg-card p-1">
                {APPS_TABS.map(tab => (
                  <Link
                    key={tab.path}
                    to={`${basePath}/${tab.path}`}
                    className={cn(
                      "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                      tab === appsTab ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      {/* Floating AI Button */}
      {!isAIPanelOpen && (
        <button
          onClick={() => setIsAIPanelOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl hover:bg-indigo-700 hover:scale-105 transition-all flex items-center justify-center z-40 group border-4 border-white/10"
        >
          <Bot className="w-6 h-6 group-hover:animate-pulse" />
        </button>
      )}

      {/* AI Assistant Panel */}
      <AIAssistantPanel isOpen={isAIPanelOpen} onClose={() => setIsAIPanelOpen(false)} />

      {/* Bluetooth Setup Modal */}
      <BluetoothProvisioningModal 
        isOpen={isBluetoothOpen} 
        onClose={() => setIsBluetoothOpen(false)} 
        commerceId={commerceId}
      />

    </div>
  );
}
