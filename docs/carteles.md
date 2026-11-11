# Carteles

Avisos armados con plantillas (promo, carta, oferta), como en PosterTV, pero con las
**Listas de precios vinculadas**: si cambiás un precio, el cartel se actualiza solo en
todas las pantallas. Menú **Contenido → Carteles**.

## Cómo se usa

1. **Nuevo cartel** → elegir el formato de la pantalla (horizontal 16:9, vertical 9:16,
   pantalla larga 21:9, 4:3, cuadrada) y una plantilla (se puede buscar por rubro).
2. Editar en tres pestañas, con la vista previa arriba:
   - **Diseño:** cómo se arma (Mitad y mitad, Fotos con tarjeta, Foto con franja, Carta),
     colores, letra del título, tarjeta inclinada.
   - **Contenido:** etiqueta, título, subtítulo, hasta 2 fotos de Medios, **lista de
     precios** (vinculada: columnas, aclaraciones, tamaño, color y sombra), **precio
     grande** (escrito a mano o de un producto de una lista), QR y hora.
   - **Ajustes:** nombre, cuánto dura y **cuándo aparece** (días y horario).
3. **Guardar** → el cartel queda en Carteles y en Medios. Se manda con **Enviar** (o se suma
   a una playlist) como cualquier contenido, también en Espejo, Olas y Mosaico.

## Detalles

- Se dibuja en vivo en la TV (no es una imagen): los precios de las listas se leen cada
  minuto; los productos "sin stock" no aparecen.
- **Cuándo aparece:** fuera de ese horario el cartel no sale y pasa lo demás de la
  playlist. Con "Mostrar el horario" la etiqueta dice sola "DE 15 A 19 H".
- El cartel se acomoda a la forma de cada pantalla (horizontal o vertical) aunque se haya
  armado en otro formato.
- Al editar un cartel, las playlists que lo usan se actualizan solas.
- Técnicamente es una app de Medios (`metadata.appId = 'poster'`, ver `src/lib/posters.ts`
  y `src/components/display/posters/`). No necesita tablas nuevas: usa la de Listas de
  precios (`display_device_price_lists`).

## Próximo

Más plantillas (apuntar a 50+), fotos de ejemplo, animaciones y carta repartida en varias
pantallas.
