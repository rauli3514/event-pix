# Listas de precios

Reemplazan a la página **Etiquetas** (menú **Contenido → Listas de precios**). El
comerciante carga sus precios una sola vez y se actualizan en todas las pantallas
que los usan.

## Qué se puede hacer

- **Listas con nombre:** "Pizzas", "Cafetería", "Oferta de la tarde".
- **Renglones:** producto, aclaración opcional ("8 porciones") y precio. El precio se
  escribe como sea ("5000", "5.000", "$ 5.000", "1.234,50") y se guarda bien.
- **Sin stock:** con el interruptor; el producto queda en la lista pero no se muestra.
- **Aumentar precios:** un % a toda la lista (o negativo para bajar), redondeando hacia
  arriba a $10, $50, $100 o $500, con vista previa antes de aplicar.
- **Pegar una lista:** desde WhatsApp o Excel, un producto por renglón con el precio
  al final ("Muzzarella 5000", "Napolitana $ 6.000").
- Ordenar con flechas, y **Guardar** siempre a mano (en el celular queda abajo).

## Cómo llegan a las pantallas

- Lo que ya usaba etiquetas **por nombre** (por ejemplo el Menú dinámico) toma el
  precio de las listas: un producto "Muzzarella" actualiza la etiqueta "Muzzarella"
  (si un nombre está en las dos, manda la lista). Las TV lo leen cada minuto.
- Próximo paso (etapa 2): el editor de **Carteles** con plantillas, donde se suma una
  lista entera como bloque de texto con su estilo.

La página Etiquetas sigue existiendo para lo ya armado: si el comercio tiene
etiquetas, aparece el enlace "Ver etiquetas anteriores".

## Paso único en Supabase

Correr una vez en el SQL Editor
`supabase/migrations/20261113000000_display_price_lists.sql`: crea la tabla
`display_price_lists`, la función `display_device_price_lists` para la TV y suma las
listas a `display_device_label_texts`. Sin ese paso, la página avisa que falta.
