# EventPix Video (cabina de video)

App **aparte del kiosco**: su propio APK, su propio panel y sus propios datos. El kiosco
de fotos no cambia.

| | Kiosco de fotos | EventPix Video |
|---|---|---|
| App | `com.eventpix.kiosk` ("EventPix Kiosco") | `com.eventpix.video` ("EventPix Video") |
| Web de la app | `index.html` (sitio) | `video.html` → `vite.video.config.ts` |
| Workflow del APK | "APK del kiosco" | "APK de EventPix Video" (`.github/workflows/video-apk.yml`) |
| Panel | `/admin/kioscos` | `/admin/cabina-video` (mismos administradores) |
| Equipos | `kiosk_devices` | `video_devices` |
| Archivos del panel | bucket `kiosk-assets` | bucket `video-assets` |
| Drive | script/carpeta del kiosco | script/carpeta propios de la cabina |

Sirve en **TV box con webcam** (cabina, glam, libro de firmas) y en **celular o tablet
Android** (brazo de la plataforma 360, uso itinerante).

## Qué hace

- **Experiencias:** video, boomerang, cámara lenta, plataforma 360 (rampas de velocidad
  y reversa), libro de firmas (pregunta al azar y micrófono) y glam (B&N de revista).
- **360 automático:** graba sola cuando la plataforma gira, corta sola cuando para,
  modo continuo y calibración en Ajustes.
- **Cada experiencia con lo suyo:** en Ajustes (y en el panel) hay una pestaña por
  experiencia: duración (más larga y a gusto: video hasta 60 s, firmas hasta 3 min, 360
  hasta 30 s), filtro, canción, marco, animación, accesorio, cuenta regresiva y sus efectos.
  Lo que no se toca usa lo de **General**.
- **Editor de rampa del 360:** tramos con su velocidad (¼× a 3×), final en reversa (o
  reversa y vuelta), con una barra que muestra cómo queda. Boomerang: idas y vueltas y velocidad.
- **Se queda en la experiencia:** después de cada video vuelve al inicio de esa misma
  experiencia ("Cambiar experiencia" para otra). Con el **candado** queda bloqueada; para
  salir pide la clave (como las secciones del espejo).
- **Marcos y capas:** varios marcos PNG (el invitado elige), animaciones (confeti,
  brillos, corazones, burbujas, nieve, neón, globos, fuegos artificiales, pétalos, luces,
  polvo dorado, emojis, notas o un video propio) y accesorios en la cara (17). Animación y
  accesorio pueden ir **al azar** (cambian en cada video) o que el invitado los elija en
  la pantalla de la toma (botón **Efectos**).
- **Marcos de fábrica:** tres de EventPix (neón, clásico y dorado, con el logo; se adaptan a
  vertical, horizontal y cuadrado) y cuatro del espejo (cumpleaños, flores, Navidad, monstruos).
  Se puede usar uno fijo, uno al azar o que el invitado elija entre los marcados.
- **Nombre y fecha:** marco "Nombre y fecha" o encima de cualquier marco. La fecha puede ser
  la de hoy, la que se escriba (ej. "14 de diciembre de 2026") o ninguna; arriba o abajo,
  tamaño y color a elección.
- **Marca:** logo (hasta 90 % del ancho, también al medio), marca de agua de chica a gigante,
  con transparencia y opción "repetida en toda la pantalla", color y placa final (degradé o
  **imagen propia** de fondo, con o sin logo y textos encima).
- **Vista previa** en Ajustes (Biblioteca y cada experiencia): cómo sale el video terminado
  y la placa final, sin grabar.
- **Música propia:** varias canciones con punto de inicio; fija, al azar o la elige el invitado.
- **Entrega:** QR al video y/o a la galería del evento; **WhatsApp** al número del invitado.
- **Sin internet:** todo queda en el equipo y se sube solo cuando vuelve la conexión.
- **Galería online** `/galeria-video/<código>` para el celular de los invitados, sin entrar
  al panel, y **moderación** desde el panel (ocultar, aprobar, aprobación previa).
- **Pantalla de la galería** para una tele, tablet o compu del evento (`?pantalla=1`), sin
  tocarla: portadas de los videos con un QR chico abajo para bajar cada uno (las páginas
  pasan solas y los nuevos aparecen al instante) y los videos pasando como demostración,
  con el QR del que se ve. Vistas: `&vista=portadas` (solo portadas) y `&vista=videos`
  (solo videos). Los enlaces y sus QR están en Ajustes → General → Galería del evento y en
  el panel (Equipos y Galerías), para compartirlos sin dar acceso al panel.

## Puesta en marcha

1. **Base de datos:** correr en Supabase (SQL Editor) `supabase/migrations/20261022000000_video_booth.sql`.
   Crea `video_devices`, `video_clips`, `video_sends`, sus funciones y el bucket `video-assets`.
2. **Drive de la cabina (por defecto, como el espejo):** en GitHub → Settings → Secrets and
   variables → Actions, crear `VITE_VIDEO_DRIVE_SCRIPT_URL` (dirección `/exec` del Apps Script)
   y `VITE_VIDEO_DRIVE_FOLDER` (link de la carpeta). Van en el APK al compilar (no en el
   código: el repositorio es público). También se puede cambiar por equipo en el panel o en
   Ajustes → Equipo → Nube. Los videos quedan en una carpeta con el **nombre del evento** y la
   galería online usa ese nombre en su código (ej. `boda-sofi-juan-k7m2`); al cambiar el
   evento empieza una galería nueva.
3. **APK:** GitHub → Actions → **"APK de EventPix Video"** → Run workflow. Se publica en la
   release `video-v1` y en `video-latest` (de ahí se actualizan los equipos). La versión sube
   sola en cada compilación y el workflow frena si la firma no es la de siempre.

### Actualización automática

La app busca versiones nuevas en `video-latest` al abrirse y cada 6 horas. Si la encuentra
en los primeros 10 minutos (al prender el equipo) la descarga, verifica la huella y abre
el instalador de Android (hay que tocar "Instalar" la primera vez y dar permiso de
"instalar apps desconocidas"). Durante el evento solo avisa con un punto en el engranaje.
Se maneja en Ajustes → Equipo → Actualización (o "Actualizar sola" en el panel).
La versión 1.0 no tenía esto: hay que instalar a mano la primera versión que lo trae.
4. **Vincular:** abrir la app en el equipo (muestra un código) y en el panel
   **Cabina de video → Equipos → Vincular**. También se puede usar sin panel.
5. Configurar desde **Equipos → Configurar** (o en el equipo: engranaje, clave 1234 → cambiarla).

### Lo nativo, solo en este APK

El proyecto Android es el mismo que usan las otras apps, pero lo propio de la cabina se
agrega **solo al compilar EventPix Video** (paso "Agregar lo nativo de la cabina" del workflow):
- `native/video/VideoStoragePlugin.java`: guarda cada video en la galería del equipo
  (Películas/EventPix Video/<evento>).
- Permiso de micrófono (`RECORD_AUDIO`) para el libro de firmas.

Así el APK del kiosco sale igual que antes.

## Envío por WhatsApp (opcional)

Va por la **API oficial de WhatsApp (Meta Cloud API)** desde la función de Supabase
`send-video-whatsapp`. Solo la pueden usar los equipos vinculados de la cabina (código +
clave secreta) y hay un tope diario por equipo. Cada envío queda en `video_sends`.

1. En Meta Business: app de WhatsApp, número de la empresa y **token permanente**
   (usuario del sistema con `whatsapp_business_messaging`).
2. Plantilla **`video_cabina`** (Español (ARG), categoría Utilidad), cuerpo:
   `¡Hola! Acá está tu video de {{1}} 🎬 Miralo y bajalo acá: {{2}}`
   (opcional: encabezado de Video y `WHATSAPP_VIDEO_HEADER=1`).
3. Secrets y función:
   ```
   supabase secrets set WHATSAPP_TOKEN=… WHATSAPP_PHONE_ID=… PUBLIC_SITE_URL=https://app.event-pix.com.ar
   supabase functions deploy send-video-whatsapp
   ```
   Opcionales: `WHATSAPP_TEMPLATE`, `WHATSAPP_TEMPLATE_LANG` (por defecto `es_AR`),
   `WHATSAPP_DAILY_LIMIT` (por defecto 500 por equipo cada 24 h).
4. Activar **Botón "Enviar por WhatsApp"** en la configuración del equipo (prefijo `549` = Argentina celulares).

Meta cobra cada conversación iniciada con plantilla.

## Código

- `src/video-app/`: la app (entrada, rutas, vinculación, clave, Ajustes).
- `src/lib/videoBooth/`: motor (compositor, efectos, capas, movimiento, grabación) y
  módulos propios (equipo, cámara, archivos, Drive, enlaces, configuración remota, nube, WhatsApp).
- `src/pages/admin/VideoBoothAdmin.tsx` y `src/components/video-admin/`: el panel.
- `src/pages/GuestVideo.tsx` (`/clip`) y `src/pages/VideoGallery.tsx` (`/galeria-video/…`): páginas del invitado en el sitio.
- Para probar en la compu: `npx vite --config vite.video.config.ts` y abrir `/video.html`.

## Próximos pasos (propuestos)

- Envío por mail.
- Intro (pre-roll) además de la placa final.
- Libro de firmas: compilado con todos los mensajes para los anfitriones.
- Recorte de fondo (chroma key) en vivo.
- Borrar videos del Drive de la cabina desde el panel.
