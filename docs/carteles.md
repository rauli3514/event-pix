# Carteles

Avisos armados con plantillas (promo, carta, oferta), como en PosterTV, pero con las
**Listas de precios vinculadas**: si cambiás un precio, el cartel se actualiza solo en
todas las pantallas. Menú **Contenido → Carteles**.

## Cómo se usa

1. El banner **"Armá tu cartel en un minuto"** muestra algunos diseños: se toca uno y se
   abre el editor con ese diseño. También **Empezar de cero** (cartel en blanco) y
   **Ver todos los diseños** (galería con buscador, filtro por rubro y formato de pantalla).
   Hay 54 diseños en rubros: Comidas y restaurantes, Bares y cervecerías, Heladerías y
   cafeterías, Moda y accesorios, Almacén y minoristas, Videojuegos y electrónica,
   Vinotecas, Gimnasios y Otros. Cada rubro tiene su paleta (Fuego, Cerveza, Neón, Helado,
   Moda, Nude, Liquidación, Almacén, Gamer, Electro, Vino, Fuerza…) y letras (Gruesa, Retro,
   Lujo, Divertida, Gamer, además de las de antes).
   Los formatos son las mismas medidas que los mosaicos: 1 TV horizontal (1920×1080) o
   vertical (1080×1920), y mosaicos de 2×1, 1×2 y 2×2 con las TV acostadas o paradas
   (por ejemplo 3840×1080 o 2160×3840). En un mosaico la vista previa marca con líneas
   punteadas dónde se juntan las TV.
2. Editar en tres pestañas, con la vista previa arriba:
   - **Diseño:** cómo se arma (Mitad y mitad, Fotos con tarjeta, Foto con franja, Carta) y
     **Acomodar**: foto de un lado o del otro (o franja arriba) y tamaño de la foto; en
     "Fotos con tarjeta", la tarjeta **se arrastra** en la vista previa y se agranda o
     achica. Paletas, **colores propios** (fondo y precios, con cualquier color), letra del
     título y **animación** (aparece suave, entra desde abajo, salta; la foto que se acerca
     despacio y el precio que late).
   - **Mover cada parte:** en la vista previa se toca el título, el subtítulo, la etiqueta,
     la lista, el precio, el QR o la hora; se arrastra para moverla y abajo aparecen
     **− / +** para el tamaño y "Como estaba". "Volver todo a su lugar" deshace todo.
   - **Contenido:** etiqueta, título, subtítulo, hasta 2 fotos de Medios, **lista de
     precios** (columnas, aclaraciones, tamaño, color y sombra), **precio grande** (escrito
     a mano o de un producto de una lista), **QR** y hora.
   - Los **productos se editan ahí mismo** (nombre, precio, sin stock). Si el cartel usa
     los productos de la plantilla ("lista nueva"), al guardar se crea esa lista en Listas
     de precios y el cartel queda vinculado. Si usa una lista existente, los cambios se
     guardan en esa lista (y cambian los otros carteles que la usen).
   - **QR:** se elige qué abre (WhatsApp, Instagram o una página) y el link se arma solo.
     En WhatsApp alcanza con el número con característica ("362 454-7382") y un mensaje
     opcional. Debajo del código va un texto corto ("Pedí por WhatsApp").
   - **Ajustes:** nombre, cuánto dura y **cuándo aparece** (días y horario).
3. **Guardar** → el cartel queda en Carteles y en Medios. Se manda con **Enviar** (o se suma
   a una playlist) como cualquier contenido, también en Espejo, Olas y Mosaico.

## Detalles

- Se dibuja en vivo en la TV (no es una imagen): los precios de las listas se leen cada
  minuto; los productos "sin stock" no aparecen.
- La lista se acomoda sola: los nombres largos pasan a dos renglones antes de cortarse y
  "Columnas solas" elige 1 o 2 columnas según lo que deja la letra más grande.
- Las animaciones usan solo movimiento y transparencia (andan en los TV box). En modo
  liviano se apagan las que se repiten (foto que se acerca, precio que late).
- **Cuándo aparece:** fuera de ese horario el cartel no sale y pasa lo demás de la
  playlist. Con "Mostrar el horario" la etiqueta dice sola "DE 15 A 19 H".
- El cartel se acomoda a la forma de cada pantalla (horizontal o vertical) aunque se haya
  armado en otro formato. En **Mosaico** cada TV dibuja el cartel al tamaño de todo el
  mosaico y muestra su parte, así que conviene armarlo en el formato de ese mosaico.
- Las partes movidas se guardan como un corrimiento relativo al tamaño de la pantalla
  (`offsets`), y el tamaño en `styles[parte].scale`.
- Al editar un cartel, las playlists que lo usan se actualizan solas.
- Técnicamente es una app de Medios (`metadata.appId = 'poster'`, ver `src/lib/posters.ts`
  y `src/components/display/posters/`). No necesita tablas nuevas: usa la de Listas de
  precios (`display_device_price_lists`).

## Próximo

Fotos de ejemplo en las plantillas.
