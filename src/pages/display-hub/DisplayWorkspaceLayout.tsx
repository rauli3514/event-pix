import { Link, Outlet, useLocation, useParams } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Monitor, 
  FolderOpen, 
  ListVideo, 
  Puzzle, 
  Calendar, 
  BarChart3, 
  Settings,
  ArrowLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCommerces } from '@/hooks/use-display-hub';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: 'dashboard' },
  { id: 'screens', label: 'Pantallas', icon: Monitor, path: 'screens' },
  { id: 'library', label: 'Biblioteca', icon: FolderOpen, path: 'library' },
  { id: 'playlists', label: 'Playlists', icon: ListVideo, path: 'playlists' },
  { id: 'widgets', label: 'Widgets', icon: Puzzle, path: 'widgets' },
  { id: 'schedule', label: 'Programación', icon: Calendar, path: 'schedule' },
  { id: 'analytics', label: 'Estadísticas', icon: BarChart3, path: 'analytics' },
  { id: 'settings', label: 'Configuración', icon: Settings, path: 'settings' },
];

export default function DisplayWorkspaceLayout() {
  const location = useLocation();
  const { commerceId } = useParams();
  const { data: commerces } = useCommerces();
  
  const currentCommerce = commerces?.find(c => c.id === commerceId);
  
  // Base path for workspace
  const basePath = `/admin/display/commerce/${commerceId}/workspace`;

  return (
    <div className="flex h-screen w-full bg-slate-950 text-slate-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
        <div className="h-16 flex items-center px-4 border-b border-slate-800 shrink-0">
          <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-white hover:bg-slate-800 -ml-2 mr-2 px-2">
            <Link to="/admin/display">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div className="flex flex-col">
            <div className="font-bold text-lg font-[Orbitron] text-white leading-tight">
              Display <span className="text-indigo-400">Hub</span>
            </div>
            <div className="text-xs text-slate-400 truncate max-w-[130px]" title={currentCommerce?.name || ''}>
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
                <item.icon className={cn("w-5 h-5", isActive ? "text-indigo-400" : "text-slate-500")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
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
