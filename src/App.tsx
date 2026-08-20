import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import AdminDashboard from "./pages/AdminDashboard";
import ProvidersList from "./pages/ProvidersList";
import KioskManager from "./pages/KioskManager";
import KioskAI from "./pages/KioskAI";
import Display from "./pages/Display";
import Login from "./pages/Login";
import DisplayUserLogin from "./pages/DisplayUserLogin";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import DisplayHubMain from "./pages/display-hub/DisplayHubMain";
import DisplayHubList from "./pages/display-hub/DisplayHubList";
import DisplayDeviceDetail from "./pages/display-hub/DisplayDeviceDetail";
import DisplayPlaylists from "./pages/display-hub/DisplayPlaylists";
import PlaylistBuilder from "./pages/display-hub/PlaylistBuilder";
import TvPlayer from "./pages/display-hub/TvPlayer";
import TvBootScreen from "./pages/display-hub/TvBootScreen";
import DisplayWorkspaceLayout from "./pages/display-hub/DisplayWorkspaceLayout";
import WorkspaceLabels from "./pages/display-hub/WorkspaceLabels";
import WorkspaceDashboard from "./pages/display-hub/WorkspaceDashboard";
import { 
  WorkspaceAnalytics, 
  WorkspaceSettings 
} from "./pages/display-hub/WorkspacePlaceholders";
import { WorkspaceMedia } from "./pages/display-hub/WorkspaceMedia";
import WorkspaceSchedule from "./pages/display-hub/WorkspaceSchedule";
import AIKnowledgeManager from "@/pages/display-hub/AIKnowledgeManager";
import WorkspaceTemplates from "./pages/display-hub/WorkspaceTemplates";
import { StickerEditor } from "./components/stickers/StickerEditor";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { EventProvider } from "./context/EventContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

import { ThemeProvider } from "./components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/usuarios" element={<DisplayUserLogin />} />
            <Route path="/register" element={<Register />} />

            <Route path="/kiosco" element={<KioskAI />} />
            <Route path="/sticker-test" element={<div className="min-h-screen bg-zinc-950 pt-10"><StickerEditor userPhotoUrl="/placeholder-user.jpg" onSave={(url) => console.log(url)} onCancel={() => console.log("cancel")} /></div>} />

            <Route element={<EventProvider><Outlet /></EventProvider>}>
              <Route element={<ProtectedRoute />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/providers" element={<ProvidersList />} />
                <Route path="/admin/kiosco-manager" element={<KioskManager />} />
                <Route path="/admin/display" element={<DisplayHubMain />} />
                
                {/* Rutas del Display Workspace */}
                <Route path="/admin/display/commerce/:commerceId/workspace" element={<DisplayWorkspaceLayout />}>
                  <Route index element={<Navigate to="screens" replace />} />
                  <Route path="dashboard" element={<WorkspaceDashboard />} />
                  <Route path="screens" element={<DisplayHubList />} />
                  <Route path="library" element={<WorkspaceMedia />} />
                  <Route path="playlists" element={<DisplayPlaylists />} />
                  <Route path="apps" element={<WorkspaceMedia initialCategory="apps" />} />
                  <Route path="labels" element={<WorkspaceLabels />} />
                  <Route path="templates" element={<WorkspaceTemplates />} />
                  <Route path="schedule" element={<WorkspaceSchedule />} />
                  <Route path="ai-knowledge" element={<AIKnowledgeManager />} />
                  <Route path="analytics" element={<WorkspaceAnalytics />} />
                  <Route path="settings" element={<WorkspaceSettings />} />
                </Route>
                
                <Route path="/admin/display/commerce/:commerceId/playlists/:playlistId" element={<PlaylistBuilder />} />
                <Route path="/admin/display/:id" element={<DisplayDeviceDetail />} />
                
                <Route path="/admin/:slug" element={
                  <ErrorBoundary>
                    <Admin />
                  </ErrorBoundary>
                } />
              </Route>

              {/* TV Player Route (No Layout, Fullscreen) */}
              <Route path="/tv-boot" element={<TvBootScreen />} />
              <Route path="/tv/:deviceCode" element={<TvPlayer />} />

              <Route path="/:slug" element={<Index />} />
              <Route path="/:slug/display" element={<Display />} />
            </Route>

            {/* 
              VITE_APP_FLAVOR=mobile → celular (va a /usuarios)
              VITE_APP_FLAVOR=tv (default) → Tanix (va al /tv-boot)
            */}
            <Route path="/" element={<Navigate to={
              Capacitor.isNativePlatform() && import.meta.env.VITE_APP_FLAVOR === 'mobile'
                ? "/usuarios"
                : Capacitor.isNativePlatform()
                  ? "/tv-boot"
                  : "/usuarios"
            } replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
// Trigger deploy
