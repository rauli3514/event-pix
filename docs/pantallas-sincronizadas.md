# Pantallas sincronizadas: Espejo y Olas

Al mandar contenido a **dos o más pantallas** desde "Enviar a pantallas" (Medios, Playlists
o Programación) se elige cómo se ven:

- **Espejo:** todas muestran lo mismo al mismo tiempo.
- **Olas:** la misma lista, cada pantalla unos segundos después de la anterior. Se elige
  cuántos segundos y el orden (flechas). Con el mismo tiempo que dura cada foto, cada
  pantalla muestra una foto distinta y la "ola" recorre la fila.

En Inicio, cada pantalla muestra "· en espejo" o "· en olas (+10 s)" junto a su contenido.

## Cómo funciona

- Cada TV calcula qué mostrar según la hora, no con su propio cronómetro. Así van juntas
  aunque se prendan en momentos distintos, se corte la luz o se reinicien.
- Las TV corrigen su reloj contra el del servidor al empezar y cada 30 minutos (por si
  alguna tiene la hora corrida). La diferencia entre pantallas queda en décimas de segundo.
- En estos modos no se mezcla el orden ("Orden aleatorio" no aplica) y cada video dura
  exactamente su tiempo en la lista: si es más corto se repite, si es más largo se corta.
- Mandar contenido a una sola pantalla, o cambiarlo desde "Cambiar contenido", la vuelve
  al modo normal (cada una a su ritmo).
- No hace falta actualizar la app de las TV: el reproductor es parte de la página.

## Probar sin TV: pantallas virtuales

Cualquier navegador sirve de pantalla: abrir `app.event-pix.com.ar/tv-boot` muestra el
código para vincularla como una TV más (F11 para pantalla completa).

- Normalmente el código queda guardado en el navegador: una pantalla por navegador.
- Con **`app.event-pix.com.ar/tv-boot?prueba`** el código vale solo para esa pestaña, así
  se pueden abrir varias en el mismo navegador (por ejemplo 4 para un mosaico de 2×2).
- Al terminar, borrarlas desde el panel; si no, quedan "sin señal" y mandan avisos.

## Versión nueva publicada: las TV se actualizan solas

Las TV leen `/version.json` (lo genera la compilación) a los 2 minutos de abrir y cada
10 minutos. Si se publicó otra versión, actualizan la copia guardada (service worker) y se
recargan. Si después de 3 intentos siguen con la vieja, esperan a la próxima publicación.

Las pantallas que ya estaban abiertas antes de esta función la reciben recién la próxima
vez que se recargan: desenchufar la TV, o en el navegador recargar dos veces (F5, F5).

## Paso único en Supabase

Correr una vez en el SQL Editor el archivo
`supabase/migrations/20261110000000_display_sync_modes.sql`. Agrega dos columnas a
`display_assignments` (`sync_mode`, `sync_offset_s`) y la función `display_server_time`.

Sin ese paso el contenido se manda igual, pero sin sincronizar, y el panel avisa que falta.

## Próximo: Mosaico

Una imagen repartida entre varias pantallas (2×1, 4×1, 2×2). Usa esta misma
sincronización; primero con fotos y después con videos, probando con TV reales.
