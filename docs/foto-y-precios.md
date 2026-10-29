# Foto real de las pantallas y precios desde Google Sheets

## Puesta en marcha (una sola vez)

1. **Supabase → SQL Editor:** correr
   `supabase/migrations/20261030000000_display_screenshots_and_live_labels.sql`
   (se puede correr más de una vez).
2. **App del TV:** al publicarse, el CI sube la versión nueva a la release
   `tv-latest`. En cada pantalla: panel → detalle del equipo → **Actualizar app**
   (o desde el menú del TV).

## Foto real

- La app del TV saca una foto chica de lo que se ve al rato de arrancar y cada
  5 minutos, y la manda junto con el nombre de lo que está pasando.
- En **Inicio** y en el **detalle de la pantalla** se ve la foto con su hora.
  El botón **Ver ahora** pide una foto nueva al instante (tarda unos segundos).
- Necesita la app del TV nueva. Con la app vieja solo se informa qué está pasando.
- En Android 8 o más nuevo la foto incluye los videos. En equipos más viejos
  los videos pueden salir en negro.

## Precios desde Google Sheets

En la app **Etiquetas** (Apps y plantillas → la app → Editar), sección
**"Precios desde una planilla de Google"**:

1. Planilla con el nombre del producto en la **columna A** (igual al
   "Identificador" de la etiqueta) y el precio en la **columna B**.
   La primera fila puede ser un encabezado (Producto · Precio).
2. Google Sheets → **Compartir** → Acceso general: **"Cualquier persona con el
   enlace"** → Lector.
3. Pegar el link de la planilla y tocar **Conectar**. El editor muestra cuántos
   productos leyó y deja agregar como etiqueta los que todavía no tienen una.

Las pantallas leen la planilla cada 5 minutos (a través de la función
`fetch-rss`, la misma que usa el texto deslizante) y guardan la última lectura
para seguir mostrando los precios sin internet. Si un nombre está en la
planilla y en la página **Etiquetas**, manda la planilla.

Con la migración, los precios cargados en la página **Etiquetas** también
llegan a las TVs (antes solo se veían en el panel).
