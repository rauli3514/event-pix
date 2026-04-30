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

          <Route element={<EventProvider><Outlet /></EventProvider>}>
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<EventsList />} />
              <Route path="/admin/providers" element={<ProvidersList />} />
              <Route path="/admin/kiosco-manager" element={<KioskManager />} />
              <Route path="/admin/:slug" element={
                <ErrorBoundary>
                  <Admin />
                </ErrorBoundary>
              } />
            </Route>

            <Route path="/:slug" element={<Index />} />
            <Route path="/:slug/display" element={<Display />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
