# Códigos QR

## Qué puede abrir un QR

- **Página web:** cualquier link (por ejemplo, la carta online).
- **WhatsApp:** escribís el número (ej. 341 123 4567) y, si querés, un mensaje que queda escrito.
  Un celular argentino sin código de país se completa solo con +54 9.
- **Instagram:** el usuario (@tunegocio).
- **Wi-Fi:** nombre de la red y contraseña: el celular se conecta solo.
- **Carta en PDF:** subís el PDF y el QR lo abre. Si cambia la carta, subís el nuevo y listo.

Mientras lo configurás se ve el QR en vivo: probalo con el celular antes de guardar.

## QR dentro de una placa

Crear placa → **Código QR** → tildá "Agregar". Va en un lugar que no tapa el precio
ni el título (al lado del precio, en una esquina o debajo del texto, según el diseño).

## QR fijo en la pantalla

Para que esté siempre, pase lo que pase (ideal para el menú de un bar):

- **Inicio** → en la tarjeta de la pantalla, botón **QR** (al lado de "Cambiar contenido").
- O en los detalles de la pantalla → **QR fijo en pantalla**.

Elegís la esquina y el tamaño, y podés ponerlo en varias pantallas a la vez.
Aparece en segundos. Si hay un aviso urgente en franja, el QR se corre para arriba;
uno a pantalla completa lo tapa mientras dure.

### Paso único en Supabase

El QR fijo necesita una columna nueva. En el SQL Editor de Supabase corré
`supabase/migrations/20261101000000_display_screen_qr.sql` (se puede correr más de una vez).
Hasta que se corra, las pantallas andan igual, solo que sin el QR fijo.
No hace falta actualizar la app de la TV.

## Fotos de pantallas verticales

La TV saca la foto "acostada" (como sale por el cable). El panel ahora la endereza.
Además, si se cambia el contenido de una pantalla después de la última foto,
se muestra el contenido nuevo hasta que llegue una foto actualizada.
