import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { isSupabaseConfigured } from '@/lib/supabase';
import { DEVICE_EVENT, getCachedDeviceState, isStandalone, startAutoUpdate, startDeviceSync } from '@/lib/videoBooth/device';
import { getVideoSettings } from '@/lib/videoBooth/settings';
import { startVideoSync } from '@/lib/videoBooth/cloud';
import { startLibrarySync } from '@/lib/videoBooth/library';
import PairingScreen from './PairingScreen';
import VideoBooth from './pages/VideoBooth';
import VideoBoothSettings from './pages/VideoBoothSettings';

// Rutas de la app EventPix Video. Al abrir: si el equipo no está vinculado al
// panel y nunca se eligió usarlo solo, muestra la bienvenida ("Empezar" o
// "Vincular a un panel"); si no, la cabina.

function Home() {
  const [linked, setLinked] = useState(() => getCachedDeviceState()?.pairingStatus === 'linked');
  const [standalone, setStandaloneState] = useState(isStandalone);
  useEffect(() => {
    const update = () => setLinked(getCachedDeviceState()?.pairingStatus === 'linked');
    window.addEventListener(DEVICE_EVENT, update);
    return () => window.removeEventListener(DEVICE_EVENT, update);
  }, []);
  if (!linked && !standalone && isSupabaseConfigured) return <PairingScreen onSkip={() => setStandaloneState(true)} />;
  return <VideoBooth />;
}

export default function VideoApp() {
  useEffect(() => {
    startDeviceSync();
    // Videos pendientes de subir (sin internet): se suben solos cuando vuelve
    startVideoSync();
    // Música, marcos y fondos de la biblioteca compartida (panel → Biblioteca)
    startLibrarySync();
    // Versiones nuevas de la app (solo en el APK)
    startAutoUpdate(() => getVideoSettings().autoUpdate !== false);
  }, []);
  return (
    <BrowserRouter>
      <Toaster richColors position="top-center" />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ajustes" element={<VideoBoothSettings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
