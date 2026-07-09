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
  PenTool,
  Database
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useCommerces } from '@/hooks/use-display-hub';
import { supabase } from '@/lib/supabase';
import { Bot } from 'lucide-react';
import { AIAssistantPanel } from '@/components/display/ai/AIAssistantPanel';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { id: 'screens', label: 'Pantallas', icon: Monitor, path: 'screens' },
  { id: 'library', label: 'Medios', icon: FolderOpen, path: 'library' },
  { id: 'playlists', label: 'Playlists', icon: ListVideo, path: 'playlists' },
  { id: 'apps', label: 'Aplicaciones', icon: Puzzle, path: 'apps' },
  { id: 'labels', label: 'Etiquetas', icon: Database, path: 'labels' },
  { id: 'templates', label: 'Plantillas', icon: PenTool, path: 'templates' },
  { id: 'schedule', label: 'Programación', icon: Calendar, path: 'schedule' },
  { id: 'ai-knowledge', label: 'Conocimiento IA', icon: Bot, path: 'ai-knowledge' },
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
  const basePath = `/admin/display/commerce/${commerceId}/workspace`;

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // checkAndPublish removed as Schedules V2 are evaluated locally by the TvPlayer.

  const SidebarContent = () => (
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

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {MENU_ITEMS.filter(item => !(item.id === 'ai-knowledge' && isDisplayUser)).map((item) => {
          const itemPath = `${basePath}/${item.path}`;
          const isActive = location.pathname.includes(itemPath);

          return (
            <Link
              key={item.id}
              to={itemPath}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-indigo-600/10 text-indigo-500" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-indigo-500" : "text-muted-foreground")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
        <div className="pt-4 mt-4 border-t border-border">
          <button
            onClick={() => { setIsAIPanelOpen(true); setIsMobileMenuOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gradient-to-r from-indigo-600/10 to-purple-600/10 text-indigo-500 hover:from-indigo-600/20 hover:to-purple-600/20 border border-indigo-500/20"
          >
            <Bot className="w-5 h-5 shrink-0 text-indigo-500" />
            <span className="truncate">Asistente IA</span>
          </button>
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
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-card border-r border-border flex-col h-full z-20 transition-colors duration-300">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-background transition-colors duration-300">
        {/* Decorative background blurs for aesthetics */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto">
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

    </div>
  );
}
