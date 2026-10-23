import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// Web de la app "EventPix Video" (cabina de video): solo video.html, separada del
// sitio y del kiosco. Sin la carpeta public (imágenes del kiosco): copia solo lo que
// usa (tipografías y el detector de caras de MediaPipe) y deja la página como
// index.html (lo pide Capacitor).
const PUBLIC_FILES = ['fonts/poppins-800.woff2', 'CarlMarx-Bold.ttf', 'CarlMarx-Regular.ttf', 'mediapipe/blaze_face_short_range.tflite', 'mediapipe/selfie_segmenter.tflite']
const MEDIAPIPE_DIR = path.resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm')
const MEDIAPIPE_FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm', 'vision_wasm_nosimd_internal.js', 'vision_wasm_nosimd_internal.wasm']

const copy = (from: string, to: string) => {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

const videoFiles = (): Plugin => ({
  name: 'video-files',
  // En desarrollo: /mediapipe/wasm desde node_modules y la app en la raíz
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const m = req.url?.match(/^\/mediapipe\/wasm\/([\w.]+)$/)
      if (m && MEDIAPIPE_FILES.includes(m[1])) {
        res.setHeader('Content-Type', m[1].endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        fs.createReadStream(path.join(MEDIAPIPE_DIR, m[1])).pipe(res)
        return
      }
      next()
    })
  },
  writeBundle(options) {
    const out = options.dir!
    for (const f of PUBLIC_FILES) copy(path.resolve(__dirname, 'public', f), path.join(out, f))
    for (const f of MEDIAPIPE_FILES) copy(path.join(MEDIAPIPE_DIR, f), path.join(out, 'mediapipe/wasm', f))
    fs.renameSync(path.join(out, 'video.html'), path.join(out, 'index.html'))
  },
})

export default defineConfig({
  plugins: [react(), videoFiles()],
  // En desarrollo se usan los archivos de public (tipografías, modelo de caras)
  publicDir: process.env.NODE_ENV === 'production' ? false : 'public',
  base: '/',
  build: {
    outDir: 'dist-video',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'video.html') },
  },
  server: { open: '/video.html' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
