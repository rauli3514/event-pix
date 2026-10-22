import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'resize-observer-polyfill/dist/ResizeObserver.global';
import '@/index.css';
import VideoApp from './VideoApp';

// App EventPix Video (cabina de video): entrada propia, separada del kiosco.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <VideoApp />
  </StrictMode>,
);
