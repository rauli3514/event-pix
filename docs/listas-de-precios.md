# Listas de precios

Reemplazan a la página **Etiquetas** (menú **Contenido → Listas de precios**). El
comerciante carga sus precios una sola vez y se actualizan en todas las pantallas
que los usan.

## Qué se puede hacer

- **Listas con nombre:** "Pizzas", "Cafetería", "Oferta de la tarde".
- **Un producto por línea:** nombre, aclaración opcional ("8 porciones") y precio, que se
  editan tocándolos (en el celular, el nombre arriba y abajo aclaración y precio). El
  precio se escribe como sea ("5000", "5.000", "$ 5.000", "1.234,50") y se guarda bien.
- **Buscar** un producto, y **+ Producto**.
- **Sin stock:** con el ojito; el producto queda en la lista pero no se muestra.
- Subir, bajar, duplicar y quitar: en el menú ⋮ de cada producto.
- **Aumentar precios:** un % a toda la lista (o negativo para bajar), redondeando hacia
  arriba a $10, $50, $100 o $500, con vista previa antes de aplicar.
- **Descuento por un tiempo:** en **%** (Aumentar o bajar precios) → "Solo por un
  tiempo": un % (por ejemplo -10) por 1, 2 o 4 horas, hasta el final del día, 24 horas,
  7 días o hasta una fecha y hora. Los precios de la lista no se tocan: el cambio se guarda
  aparte (`promo`) y vale hasta que termina. Mientras dura:
  - la lista muestra un aviso con la cuenta regresiva y **Terminar ahora**, y al lado de
    cada precio el precio con descuento;
  - los carteles muestran el precio de antes tachado, el nuevo y un cartelito "−10 %"
    (que se puede mover o apagar en el cartel);
  - lo que usa etiquetas por nombre (Menú dinámico) toma el precio con descuento.
  Al terminar vuelve solo a los precios de siempre (las TV se dan cuenta en menos de un
  minuto). "Para siempre" cambia los precios como antes.
- **Pegar una lista:** desde WhatsApp o Excel, un producto por renglón con el precio
  al final ("Muzzarella 5000", "Napolitana $ 6.000").
- Atajos chicos arriba de la lista: **%** (aumentar) y **Pegar**. **Guardar** siempre a
  mano (en el celular queda abajo).

## Cómo llegan a las pantallas

- Lo que ya usaba etiquetas **por nombre** (por ejemplo el Menú dinámico) toma el
  precio de las listas: un producto "Muzzarella" actualiza la etiqueta "Muzzarella"
  (si un nombre está en las dos, manda la lista). Las TV lo leen cada minuto.
- En **Apps y plantillas → Etiquetas Dinámicas**, el recuadro **"Precios de tus Listas de
  precios"** agrega un producto (o todos) como etiqueta ya vinculada: el precio se cambia
  en la lista y se actualiza solo.
- En **Carteles** la lista se vincula entera, y los productos que se escriben en el cartel
  se guardan en Listas de precios.

La página Etiquetas sigue existiendo para lo ya armado: si el comercio tiene
etiquetas, aparece el enlace "Ver etiquetas anteriores".

## Pasos en Supabase

Para el descuento por un tiempo hay que correr una vez
`supabase/migrations/20261114000000_display_price_list_promo.sql` en el SQL Editor (agrega
la columna `promo` y actualiza las funciones que leen las TV).

## Paso único en Supabase

Correr una vez en el SQL Editor
`supabase/migrations/20261113000000_display_price_lists.sql`: crea la tabla
`display_price_lists`, la función `display_device_price_lists` para la TV y suma las
listas a `display_device_label_texts`. Sin ese paso, la página avisa que falta.
