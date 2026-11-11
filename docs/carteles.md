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

## Fotos de ejemplo

Los diseños traen fotos de ejemplo (en `public/poster-samples/`, 1280 px en WebP). En el
editor dicen "Ejemplo · Cambiar": se pueden dejar o cambiar por fotos propias de Medios.
Son de [Unsplash](https://unsplash.com/license): uso libre, también comercial, sin
obligación de nombrar al autor. Se eligieron sin marcas ni logos a la vista.

| Archivo | Foto original |
|---|---|
| `bag1.webp` | https://unsplash.com/photos/1584917865442-de89df76afd3 |
| `bar.webp` | https://unsplash.com/photos/1572116469696-31de0f17cc34 |
| `beer1.webp` | https://unsplash.com/photos/1535958636474-b021ee887b13 |
| `beer2.webp` | https://unsplash.com/photos/1608270586620-248524c67de9 |
| `breakfast.webp` | https://unsplash.com/photos/1533089860892-a7c6f0a88666 |
| `burger1.webp` | https://unsplash.com/photos/1568901346375-23c9450c58cd |
| `burger3.webp` | https://unsplash.com/photos/1571091718767-18b5b1457add |
| `cake1.webp` | https://unsplash.com/photos/1578985545062-69928b1d9587 |
| `charcut.webp` | https://unsplash.com/photos/1541529086526-db283c563270 |
| `cocktail1.webp` | https://unsplash.com/photos/1514362545857-3bc16c4c7d1b |
| `coffee1.webp` | https://unsplash.com/photos/1495474472287-4d71bcdd2085 |
| `coffee2.webp` | https://unsplash.com/photos/1509042239860-f550ce710b93 |
| `concert2.webp` | https://unsplash.com/photos/1514525253161-7a46d19cd819 |
| `croissant1.webp` | https://unsplash.com/photos/1555507036-ab1f4038808a |
| `croissant2.webp` | https://unsplash.com/photos/1530610476181-d83430b64dcd |
| `electro1.webp` | https://unsplash.com/photos/1498049794561-7780e7231661 |
| `fashion1.webp` | https://unsplash.com/photos/1441986300917-64674bd600d8 |
| `fashion2.webp` | https://unsplash.com/photos/1445205170230-053b83016050 |
| `fashion3.webp` | https://unsplash.com/photos/1490481651871-ab68de25d43d |
| `fashion4.webp` | https://unsplash.com/photos/1483985988355-763728e1935b |
| `fries.webp` | https://unsplash.com/photos/1573080496219-bb080dd4f877 |
| `gaming1.webp` | https://unsplash.com/photos/1542751371-adc38448a05e |
| `gaming4.webp` | https://unsplash.com/photos/1550745165-9bc0b252726f |
| `glasses2.webp` | https://unsplash.com/photos/1511499767150-a48a237f0083 |
| `grill1.webp` | https://unsplash.com/photos/1544025162-d76694265947 |
| `grocery1.webp` | https://unsplash.com/photos/1542838132-92c53300491e |
| `grocery2.webp` | https://unsplash.com/photos/1604719312566-8912e9227c6a |
| `grocery3.webp` | https://unsplash.com/photos/1534723452862-4c874018d66d |
| `gym1.webp` | https://unsplash.com/photos/1534438327276-14e5300c3a48 |
| `gym2.webp` | https://unsplash.com/photos/1517836357463-d25dfeac3438 |
| `gym3.webp` | https://unsplash.com/photos/1571019613454-1cb2f99b2d8b |
| `gym4.webp` | https://unsplash.com/photos/1540497077202-7c8a3999166f |
| `house2.webp` | https://unsplash.com/photos/1560448204-e02f11c3d0e2 |
| `icecream1.webp` | https://unsplash.com/photos/1497034825429-c343d7c6a68f |
| `icecream2.webp` | https://unsplash.com/photos/1563805042-7684c019e1cb |
| `icecream3.webp` | https://unsplash.com/photos/1501443762994-82bd5dace89a |
| `jeans1.webp` | https://unsplash.com/photos/1541099649105-f69ad21f3246 |
| `pasta1.webp` | https://unsplash.com/photos/1621996346565-e3dbc646d9a9 |
| `pay1.webp` | https://unsplash.com/photos/1556742049-0cfed4f6a45d |
| `phone.webp` | https://unsplash.com/photos/1585060544812-6b45742d762f |
| `pizza1.webp` | https://unsplash.com/photos/1513104890138-7c749659a591 |
| `pizza2.webp` | https://unsplash.com/photos/1565299624946-b28f40a0ae38 |
| `plate.webp` | https://unsplash.com/photos/1504674900247-0877df9cc836 |
| `repair.webp` | https://unsplash.com/photos/1581092160562-40aa08e78837 |
| `sandwich.webp` | https://unsplash.com/photos/1528735602780-2552fd46c7af |
| `stadium.webp` | https://unsplash.com/photos/1574629810360-7efbbe195018 |
| `sushi2.webp` | https://unsplash.com/photos/1553621042-f6e147245754 |
| `wine1.webp` | https://unsplash.com/photos/1510812431401-41d2bd2722f3 |
| `wine2.webp` | https://unsplash.com/photos/1506377247377-2a5b3b417ebb |
| `wine3.webp` | https://unsplash.com/photos/1553361371-9b22f78e8b1d |
| `wine4.webp` | https://unsplash.com/photos/1474722883778-792e7990302f |

