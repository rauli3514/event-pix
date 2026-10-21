# Cabina de video EventPix

App de cabina de video para eventos: plataforma 360, boomerang, cámara lenta, glam,
libro de firmas en video y video clásico. Corre en la misma app del kiosco (TV box
con webcam, o celular/tablet) y reutiliza lo del kiosco de fotos: cámara, disparador
Bluetooth, clave de Ajustes, carpeta del evento, Drive y QR.

- `/video` — la cabina (ícono **Video** en el inicio del equipo)
- `/video/ajustes` — ajustes (engranaje + clave del equipo)
- `/clip?d=<id de Drive>` — página que abre el invitado con el QR

## Referencia: LumaBooth (iPad / iPhone / Mac)

Lo que ofrece LumaBooth y cómo lo resolvemos:

| LumaBooth | EventPix (esta versión) |
|---|---|
| Modo video con cuenta regresiva | **Video**: 5–20 s, marco, filtro, micrófono y/o música |
| Boomerang (va y vuelve) | **Boomerang**: 1–3 s, 2–5 vueltas |
| Cámara lenta (hasta 240 fps en iPad/iPhone) | **Cámara lenta**: ½, ⅓ o ¼ de velocidad; pide 60 fps si la cámara los da |
| 360: tramos lentos/rápidos, reversa, música, overlays animados | **Plataforma 360**: rampas Clásica / Épica / Suave, reversa al final, música, marco PNG |
| 360: arranque automático por movimiento del brazo | Pendiente. Hoy el operador inicia con el disparador Bluetooth |
| Video guestbook con preguntas | **Libro de firmas**: pregunta al azar, hasta 60 s con micrófono, se puede terminar antes |
| Filtro "B&W Glam" + suavizado de piel | **Glam**: B&N de revista con brillo difuso, viñeta y cámara lenta. También "Glam color" |
| Overlay PNG / overlay animado | Marco PNG propio o "Nombre del evento". Overlay animado: pendiente |
| Pre-roll / post-roll (intro y cierre) | Pendiente |
| Banda sonora MP3 | Una canción por equipo, con volumen y desvanecido al final |
| Estación para compartir, SMS, mail, AirDrop | QR → página del invitado (descargar, WhatsApp, compartir) |
| Cámaras réflex Canon/Sony/Nikon | Webcam USB o cámara del celular/tablet |
| Configuración desde el navegador | Pendiente (hoy se configura en el equipo) |

## Cómo funciona

1. **Compositor en vivo** (`src/lib/videoBooth/compositor.ts`): dibuja la cámara en un
   canvas del tamaño del video final (vertical 9:16, horizontal o cuadrado), con espejo,
   giro, filtro y marco. Ese canvas es la vista previa y lo que se graba.
2. **Grabación** (`recorder.ts`): MediaRecorder sobre el canvas. Se prefiere **MP4 (H.264)**
   porque lo reproducen iPhone, WhatsApp e Instagram; si el WebView del equipo no graba MP4
   queda WebM (Ajustes muestra cuál sale).
3. **Efectos** (`effects.ts`): el clip se reproduce una vez hacia adelante cambiando la
   velocidad por tramos; la reversa sale de los últimos cuadros guardados en memoria
   durante la toma (máx. 30 por segundo, 720p). Se vuelve a grabar con la música.
4. **Guardado** (`storage.ts`): en el equipo siempre (Películas/EventPix/<evento> con el APK
   nuevo; en la memoria de la app con APK anteriores) y en Drive para el QR (mismo script
   del kiosco, límite ~45 MB por video).

## Probado

En Chromium con cámara simulada: Boomerang, Glam, 360 y Libro de firmas salen en MP4
720×1280 con marco. Falta probar en la TV box y en un celular reales.

## Versión 2 (referencias: Snap360 y TouchPix)

| Pedido | Cómo quedó |
|---|---|
| Arranque automático del 360 por movimiento | La cámara compara cuadros: cuando la plataforma gira, graba sola (sin cuenta regresiva). Opcional: corta sola cuando para y **modo continuo** (vuelve directo a esperar el próximo giro). **Calibración** en Ajustes: "medir quieta" y "medir girando" fijan el umbral |
| Marcos interactivos | Varios marcos PNG y el invitado **elige el suyo** antes de grabar. **Animaciones** encima del video (confeti, brillos, corazones, burbujas, nieve, borde neón) o un **video propio** (WebM con transparencia o MP4 con fondo negro). **Accesorios que siguen la cara** (los del kiosco de fotos) |
| Tu propia música | Biblioteca de canciones en el equipo, con el **segundo donde empieza** cada una. Suena siempre la misma, una al azar, o **la elige el invitado** (escucha un pedacito antes) |
| Efectos y filtros | Filtros nuevos (Cine, Soñado, Neón, Retro), **zoom suave** y **destellos** en los cambios de velocidad del 360 |
| Integración de marca | **Logo** (lugar, tamaño, transparencia), **marca de agua** de texto, **color de la marca** y **placa final** con logo, nombre del evento y tu texto (web/Instagram) |
| Tipos de entrega | QR al **video**, a la **galería del evento** o **los dos**. Página del invitado para bajar o mandar por WhatsApp |
| Trabajar sin internet | El video queda en el equipo y en una **cola**: se sube solo cuando vuelve internet (Ajustes muestra cuántos faltan y "Subir ahora"). Sin internet el invitado igual se lleva el QR de la galería: su video aparece ahí cuando se sube |
| Gestión vía web | Panel → Kioscos → equipo → **Cabina de video**: experiencias, 360, efectos, marcos, logo, música, entrega y galería. Los archivos se suben al panel y el equipo los baja y los guarda (después funcionan sin internet) |
| Galería online | `/galeria-video/<código>`: todos los videos del evento, en vivo. Con `?pantalla=1` (tele o tablet del evento): el último video en grande, la grilla y el QR para que cada uno busque el suyo |

### Para activar la galería online

Correr en Supabase la migración `supabase/migrations/20261021000000_video_clips.sql`
(crea la tabla `video_clips`). Sin eso, todo lo demás funciona y el QR al video también.

### Detalles técnicos

- Capas (`decor.ts`): todo se dibuja en función del tiempo, igual en vivo y al armar el video.
  En los modos sin efectos las capas y la placa final se graban en vivo; en los modos con
  efectos se agregan al armar el video (así la reversa no da vuelta la animación ni el logo).
- Movimiento (`motion.ts`): diferencia entre cuadros en una copia de 64×36 en grises, 12 veces
  por segundo (liviano para la TV box).
- Galería (`cloud.ts`): el video y su miniatura se suben a Drive; la galería se anota en la
  tabla `video_clips` con el código de la galería (largo y al azar).
- Panel (`kioskRemote.ts`, `VideoBoothConfig.tsx`): los ajustes viajan en `kiosk_devices.settings.video`
  y los archivos en `settings.videoAssets` (URLs de `kiosk-assets`).

## Próximos pasos (propuestos)

- Envío por mail o WhatsApp directo desde la cabina (necesita un servicio de envío con su clave).
- Moderación de la galería desde el panel (ocultar o borrar videos).
- Intro (pre-roll) además de la placa final.
- Libro de firmas: compilado final de todos los mensajes para entregar a los anfitriones.
- Recorte de fondo (chroma key) en vivo, compartido con el kiosco de fotos.
- App propia (variante `VITE_APP_FLAVOR=video`) si se quiere vender la cabina por separado.
