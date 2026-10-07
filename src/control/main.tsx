import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import ControlScreen from './ControlScreen';

// App "EventPix Control" (la tablet que maneja la pantalla del kiosco). Es una app
// aparte y liviana: solo esta pantalla, sin nada del kiosco (vite.control.config.ts).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ControlScreen />
  </StrictMode>,
);
