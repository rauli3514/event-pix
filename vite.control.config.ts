import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Web de la app "EventPix Control" (tablet): solo control.html, sin la carpeta public
// (125 MB de imágenes del kiosco). Las imágenes las manda la pantalla por Bluetooth.
// Copia solo las tipografías y deja la página como index.html (lo pide Capacitor).
const FONTS = ['fonts/poppins-800.woff2', 'CarlMarx-Bold.ttf', 'CarlMarx-Regular.ttf']

const controlFiles = () => ({
  name: 'control-files',
  writeBundle(options: { dir?: string }) {
    const out = options.dir!
    for (const f of FONTS) {
      fs.mkdirSync(path.dirname(path.join(out, f)), { recursive: true })
      fs.copyFileSync(path.resolve(__dirname, 'public', f), path.join(out, f))
    }
    fs.renameSync(path.join(out, 'control.html'), path.join(out, 'index.html'))
  },
})

export default defineConfig({
  plugins: [react(), controlFiles()],
  publicDir: false,
  base: './',
  build: {
    outDir: 'dist-control',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'control.html') },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
