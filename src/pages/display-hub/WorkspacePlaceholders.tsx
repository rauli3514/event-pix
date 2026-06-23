import { LayoutDashboard, FolderOpen, Puzzle, Calendar, BarChart3, Settings } from 'lucide-react';

function PlaceholderView({ title, icon: Icon, description }: { title: string, icon: any, description: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-6 border border-slate-800 shadow-xl">
        <Icon className="w-10 h-10 text-slate-500" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 max-w-md">
        {description}
      </p>
      <div className="mt-8 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-sm font-medium border border-indigo-500/20">
        Próximamente
      </div>
    </div>
  );
}

export function WorkspaceDashboard() {
  return <PlaceholderView title="Dashboard" icon={LayoutDashboard} description="Vista panorámica de tu red con gráficos avanzados y métricas en tiempo real." />;
}

export function WorkspaceLibrary() {
  return <PlaceholderView title="Biblioteca" icon={FolderOpen} description="Gestiona tus imágenes, videos y documentos en un solo lugar. Crea carpetas y organiza tus assets." />;
}

export function WorkspaceWidgets() {
  return <PlaceholderView title="Widgets y Apps" icon={Puzzle} description="Conecta tus pantallas con el clima, reloj, fuentes RSS y otras integraciones dinámicas." />;
}

export function WorkspaceSchedule() {
  return <PlaceholderView title="Programación" icon={Calendar} description="Crea calendarios y programa qué campañas se mostrarán en qué momento del día." />;
}

export function WorkspaceAnalytics() {
  return <PlaceholderView title="Estadísticas" icon={BarChart3} description="Analiza el tiempo de actividad, reproducciones e impacto de tus contenidos." />;
}

export function WorkspaceSettings() {
  return <PlaceholderView title="Configuración" icon={Settings} description="Administra usuarios, roles y ajustes globales de tu espacio de trabajo." />;
}
