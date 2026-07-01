import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { 
  Monitor, 
  FolderOpen, 
  ListVideo, 
  Puzzle, 
  Calendar, 
  ArrowLeft,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { useCommerces, useDisplaySchedules, useUpdateSchedule, useAssignContentToDevice } from '@/hooks/use-display-hub';
import { toast } from 'sonner';

const MENU_ITEMS = [
  { id: 'screens', label: 'Pantallas', icon: Monitor, path: 'screens' },
  { id: 'library', label: 'Medios', icon: FolderOpen, path: 'library' },
  { id: 'playlists', label: 'Playlists', icon: ListVideo, path: 'playlists' },
  { id: 'apps', label: 'Aplicaciones', icon: Puzzle, path: 'apps' },
  { id: 'schedule', label: 'Programación', icon: Calendar, path: 'schedule' },
];

export default function DisplayWorkspaceLayout() {
  const location = useLocation();
  const { commerceId } = useParams();
  const { data: commerces } = useCommerces();
  
  const currentCommerce = commerces?.find(c => c.id === commerceId);
  const basePath = `/admin/display/commerce/${commerceId}/workspace`;

  // Mobile menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Global Auto-publish Logic
  const { data: schedules = [] } = useDisplaySchedules(commerceId);
  const updateSchedule = useUpdateSchedule();
  const assignContent = useAssignContentToDevice();

  useEffect(() => {
    if (!commerceId) return;
    
    const checkAndPublish = async () => {
        const now = new Date();
        const pending = (schedules as any[]).filter(s => s.status === 'pending' && new Date(s.scheduled_at) <= now);
        for (const schedule of pending) {
            try {
                await assignContent.mutateAsync({
                    deviceId: schedule.device_id,
                    mediaId: schedule.media_id || undefined,
                    campaignId: schedule.campaign_id || undefined,
                });
                await updateSchedule.mutateAsync({ id: schedule.id, updates: { status: 'published' } });
                toast.success(`✅ Contenido "${schedule.content_name}" publicado automáticamente en ${schedule.device_name}`);
            } catch (err) {
                console.error('Auto-publish error:', err);
            }
        }

        const published = (schedules as any[]).filter(s => s.status === 'published' && s.expires_at && new Date(s.expires_at) <= now);
        for (const schedule of published) {
            try {
                await updateSchedule.mutateAsync({ id: schedule.id, updates: { status: 'expired' } });
            } catch (err) {
                console.error('Expiry error:', err);
            }
        }
    };

    checkAndPublish();
    const interval = setInterval(checkAndPublish, 60 * 1000);
    return () => clearInterval(interval);
  }, [commerceId, schedules]);

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-4 border-b border-slate-800 shrink-0">
        <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white hover:bg-slate-800 -ml-2 mr-2 px-2">
          <Link to="/admin/display">
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex flex-col overflow-hidden">
          <div className="font-bold text-lg font-[Orbitron] text-white leading-tight">
            Display <span className="text-indigo-400">Hub</span>
          </div>
          <div className="text-xs text-slate-400 truncate max-w-[130px] md:max-w-full" title={currentCommerce?.name || ''}>
            {currentCommerce?.name || 'Cargando...'}
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {MENU_ITEMS.map((item) => {
          const itemPath = `${basePath}/${item.path}`;
          const isActive = location.pathname.includes(itemPath);

          return (
            <Link
              key={item.id}
              to={itemPath}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive 
                  ? "bg-indigo-600/10 text-indigo-400" 
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-indigo-400" : "text-slate-500")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-slate-950 text-slate-200 overflow-hidden font-sans flex-col md:flex-row">
      
      {/* Mobile Top Navbar */}
      <div className="md:hidden h-14 shrink-0 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-20">
        <div className="flex items-center gap-2 overflow-hidden">
            <Button variant="ghost" size="icon" asChild className="text-slate-400 hover:text-white">
                <Link to="/admin/display">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
            </Button>
            <div className="flex flex-col min-w-0">
                <div className="font-bold text-base font-[Orbitron] text-white leading-tight truncate">
                    Display <span className="text-indigo-400">Hub</span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                    {currentCommerce?.name}
                </div>
            </div>
        </div>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 bg-slate-900 border-r-slate-800 flex flex-col">
            <SheetTitle className="sr-only">Menú de Navegación</SheetTitle>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex-col h-full z-20">
        <SidebarContent />
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative bg-slate-950">
        {/* Decorative background blurs for aesthetics */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
