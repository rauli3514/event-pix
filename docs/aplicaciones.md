# Aplicaciones (pestaña Aplicaciones)

Apps que se agregan a la biblioteca y se pasan en las pantallas como cualquier contenido:
El Clima, Pantalla Dividida, Etiquetas Dinámicas, Texto Deslizante, Cotización Dólar,
Reloj y Fecha, Código QR, Reseñas y YouTube.

## Reglas para que nunca quede la pantalla en negro

- **Si una app falla**, el reproductor muestra negro y la vuelve a intentar sola a los 30 s
  (`RetryBoundary`). Antes quedaba negra hasta reiniciar la TV.
- **Pantalla Dividida**: cada zona tiene su propia red de seguridad; si una falla, las demás
  siguen.
- **Servicios externos** (clima: open-meteo; dólar: dolarapi; noticias: función `fetch-rss`):
  - una respuesta de error no rompe la app;
  - se guarda lo último que llegó (clima 12 h, dólar 24 h) para arrancar sin internet;
  - se reintenta solo: clima cada 30 min (2 min si falló), dólar cada 5 min (1 min si
    falló), noticias cada 30 min (3 min si falló);
  - si nunca llegó nada, se muestra "Sin conexión con el servicio…" en vez de quedar
    cargando.

## YouTube

- Los links de YouTube (video, Shorts, vivos, listas, `youtu.be`, celular) se muestran con el
  reproductor embebido de YouTube. Lo resuelve `src/lib/youtube.ts`.
- Un link de YouTube cargado como **página web** (en una playlist o en una zona de Pantalla
  Dividida) también va con el reproductor: abrir la página de YouTube en un recuadro queda
  en negro porque YouTube no lo permite.
- Arranca sin sonido (si no, las TVs no lo dejan arrancar solo) y se repite.

## Detalles por app

- **Clima**: los días del pronóstico se toman como fecha local (antes en Argentina salían
  corridos un día). Chaparrones = lluvia, niebla = niebla (antes "Nieve" y "Despejado"). La
  hora que muestra avanza sola.
- **Dólar**: en pantallas verticales y zonas angostas va en columna. En zonas bajas muestra
  solo las cotizaciones que entran (primero oficial y blue).
- **Código QR**: siempre oscuro sobre blanco (claro sobre oscuro muchos celulares no lo leen)
  y lo más grande que entre.
- **Reseñas**: las reseñas de ejemplo se ven solo en el editor; en la TV, sin reseñas
  cargadas, se muestra solo el título.
- **Reloj / Clima**: fecha como "Martes, 3 de noviembre".
- **En vertical** (por ejemplo, el exhibidor de mostrador):
  - el Clima tiene diseño propio: ciudad, fecha y hora arriba; ícono y temperatura grandes;
    sensación, humedad y viento; pronóstico de 5 días en lista con chance de lluvia. Todo
    se mide en proporción a la pantalla;
  - el Reloj digital apila horas y minutos en dos renglones grandes, con los segundos y la
    fecha ("Martes" / "3 de noviembre") abajo.
- **Pantalla Dividida**: un solo video por zona (el fondo borroso era un segundo video y los
  TV box tienen pocos decodificadores).
