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
import { useCommerces, useDisplaySchedules, useUpdateSchedule, useAssignContentToDevice } from '@/hooks/use-display-hub';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { id: 'screens', label: 'Pantallas', icon: Monitor, path: 'screens' },
  { id: 'library', label: 'Medios', icon: FolderOpen, path: 'library' },
  { id: 'playlists', label: 'Playlists', icon: ListVideo, path: 'playlists' },
  { id: 'apps', label: 'Aplicaciones', icon: Puzzle, path: 'apps' },
  { id: 'labels', label: 'Etiquetas', icon: Database, path: 'labels' },
  { id: 'templates', label: 'Plantillas', icon: PenTool, path: 'templates' },
  { id: 'schedule', label: 'Programación', icon: Calendar, path: 'schedule' },
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
        const currentDay = now.getDay(); // 0 (Sun) - 6 (Sat)
        const currentTime = now.toTimeString().substring(0, 5); // "HH:mm"

        const pending = (schedules as any[]).filter(s => {
            if (s.status !== 'pending') return false;
            
            if (s.is_recurring) {
                if (s.days_of_week && s.days_of_week.includes(currentDay)) {
                     // Trigger if current time is within the start-end window
                     if (currentTime >= s.start_time && currentTime < s.end_time) {
                         return true;
                     }
                }
                return false;
            }
            
            return s.scheduled_at && new Date(s.scheduled_at) <= now;
        });

        for (const schedule of pending) {
            try {
                // Fetch current assignment for device to save as 'previous'
                const { data: currentAssignment } = await supabase
                    .from('display_assignments')
                    .select('campaign_id, media_id')
                    .eq('device_id', schedule.device_id)
                    .maybeSingle();

                await assignContent.mutateAsync({
                    deviceId: schedule.device_id,
                    mediaId: schedule.media_id || undefined,
                    campaignId: schedule.campaign_id || undefined,
                });
                await updateSchedule.mutateAsync({ 
                    id: schedule.id, 
                    updates: { 
                        status: 'published',
                        previous_campaign_id: currentAssignment?.campaign_id || null,
                        previous_media_id: currentAssignment?.media_id || null
                    } 
                });
                toast.success(`✅ Contenido "${schedule.content_name}" publicado automáticamente en ${schedule.device_name}`);
            } catch (err) {
                console.error('Auto-publish error:', err);
            }
        }

        const published = (schedules as any[]).filter(s => {
            if (s.status !== 'published') return false;
            
            if (s.is_recurring) {
                // If it's a recurring schedule, check if the window has passed
                if (s.days_of_week && s.days_of_week.includes(currentDay)) {
                    if (currentTime >= s.end_time) {
                        return true; // Window ended today
                    }
                } else {
                    return true; // Not even the right day
                }
                return false;
            }
            
            return s.expires_at && new Date(s.expires_at) <= now;
        });

        for (const schedule of published) {
            try {
                // For recurring schedules, reset to 'pending' so they can run again next time.
                // For one-off schedules, mark as 'expired'.
                const nextStatus = schedule.is_recurring ? 'pending' : 'expired';
                await updateSchedule.mutateAsync({ id: schedule.id, updates: { status: nextStatus } });
                
                // Revert to previous content if required
                if (schedule.after_expiry === 'last_played') {
                    if (schedule.previous_campaign_id || schedule.previous_media_id) {
                        await assignContent.mutateAsync({
                            deviceId: schedule.device_id,
                            campaignId: schedule.previous_campaign_id || undefined,
                            mediaId: schedule.previous_media_id || undefined
                        });
                        toast.success(`🔄 Contenido original restaurado en ${schedule.device_name}`);
                    } else {
                        // Revert to empty (no content before)
                        await supabase.from('display_assignments').delete().eq('device_id', schedule.device_id);
                        toast.success(`⬛ Contenido removido (volviendo a estado inicial) en ${schedule.device_name}`);
                    }
                } else if (schedule.after_expiry === 'black_screen') {
                    await supabase.from('display_assignments').delete().eq('device_id', schedule.device_id);
                    toast.success(`⬛ Pantalla en negro en ${schedule.device_name}`);
                }

                if (nextStatus === 'pending') {
                    console.log(`Resetting recurring schedule ${schedule.id} to pending for next cycle`);
                }
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
                  ? "bg-indigo-600/10 text-indigo-500" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive ? "text-indigo-500" : "text-muted-foreground")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
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
    </div>
  );
}
