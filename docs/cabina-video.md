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

## Próximos pasos (propuestos)

- Arranque automático del 360 por movimiento (detectar cuando la plataforma gira).
- Intro y cierre (pre-roll / post-roll) y marcos animados (video con transparencia).
- Cola de reintento para subir a Drive los videos que no se pudieron subir en el momento.
- Galería de videos en el equipo y descarga de todos los videos del evento.
- Libro de firmas: compilado final de todos los mensajes para entregar a los anfitriones.
- Recorte de fondo (chroma key) en vivo, compartido con el kiosco de fotos.
- App propia (variante `VITE_APP_FLAVOR=video`) si se quiere vender la cabina por separado.
- Configurar la cabina desde el panel web (como los kioscos).
