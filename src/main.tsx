import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'resize-observer-polyfill/dist/ResizeObserver.global'
import './index.css'
import App from './App.tsx'

// Limpieza de Service Workers viejos en modo desarrollo para evitar conflictos de caché
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
