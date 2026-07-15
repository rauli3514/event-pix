import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'resize-observer-polyfill/dist/ResizeObserver.global'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
