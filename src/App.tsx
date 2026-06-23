import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import EventsList from "./pages/EventsList";
import ProvidersList from "./pages/ProvidersList";
import KioskManager from "./pages/KioskManager";
import KioskAI from "./pages/KioskAI";
import Display from "./pages/Display";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import DisplayHubMain from "./pages/display-hub/DisplayHubMain";
import DisplayHubList from "./pages/display-hub/DisplayHubList";
import DisplayDeviceDetail from "./pages/display-hub/DisplayDeviceDetail";
import DisplayCampaigns from "./pages/display-hub/DisplayCampaigns";
import DisplayCampaignBuilder from "./pages/display-hub/DisplayCampaignBuilder";
import TvPlayer from "./pages/display-hub/TvPlayer";
import DisplayWorkspaceLayout from "./pages/display-hub/DisplayWorkspaceLayout";
import { 
  WorkspaceDashboard, 
  WorkspaceLibrary, 
  WorkspaceWidgets, 
  WorkspaceSchedule, 
  WorkspaceAnalytics, 
  WorkspaceSettings 
} from "./pages/display-hub/WorkspacePlaceholders";
import { StickerEditor } from "./components/stickers/StickerEditor";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { EventProvider } from "./context/EventContext";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/kiosco" element={<KioskAI />} />
          <Route path="/sticker-test" element={<div className="min-h-screen bg-zinc-950 pt-10"><StickerEditor userPhotoUrl="/placeholder-user.jpg" onSave={(url) => console.log(url)} onCancel={() => console.log("cancel")} /></div>} />

          <Route element={<EventProvider><Outlet /></EventProvider>}>
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<EventsList />} />
              <Route path="/admin/providers" element={<ProvidersList />} />
              <Route path="/admin/kiosco-manager" element={<KioskManager />} />
              <Route path="/admin/display" element={<DisplayHubMain />} />
              
              {/* Rutas del Display Workspace */}
              <Route path="/admin/display/commerce/:commerceId/workspace" element={<DisplayWorkspaceLayout />}>
                <Route index element={<Navigate to="screens" replace />} />
                <Route path="dashboard" element={<WorkspaceDashboard />} />
                <Route path="screens" element={<DisplayHubList />} />
                <Route path="library" element={<WorkspaceLibrary />} />
                <Route path="playlists" element={<DisplayCampaigns />} />
                <Route path="widgets" element={<WorkspaceWidgets />} />
                <Route path="schedule" element={<WorkspaceSchedule />} />
                <Route path="analytics" element={<WorkspaceAnalytics />} />
                <Route path="settings" element={<WorkspaceSettings />} />
              </Route>
              
              <Route path="/admin/display/commerce/:commerceId/campaigns/:campaignId" element={<DisplayCampaignBuilder />} />
              <Route path="/admin/display/:id" element={<DisplayDeviceDetail />} />
              
              <Route path="/admin/:slug" element={
                <ErrorBoundary>
                  <Admin />
                </ErrorBoundary>
              } />
            </Route>

            <Route path="/:slug" element={<Index />} />
            <Route path="/:slug/display" element={<Display />} />
            
            {/* TV Player Route (No Layout, Fullscreen) */}
            <Route path="/tv/:deviceCode" element={<TvPlayer />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
