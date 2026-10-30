# Programación

Una programación es una **semana tipo**: qué pasa la pantalla en cada horario.
Fuera de las franjas pasa **lo de siempre**. La TV cambia sola a la hora indicada
(lo revisa cada minuto) y sigue funcionando sin internet con lo último que bajó.

## Crear

Programación → **Nueva programación**: nombre, lo de siempre y un atajo para empezar:

- **Empezar de cero.**
- **Mañana, tarde y noche** (7–12, 12–19, 19–24 h, todos los días).
- **Semana y fin de semana** (lo de siempre de lunes a viernes, otra cosa sábado y domingo).

## El calendario

- Horas de 0 a 24 h; abre una hora antes de la primera franja.
- Cada playlist tiene su color (ver la leyenda). El día de hoy y la hora actual están marcados.
- Los huecos rayados son "lo de siempre".
- **Con el mouse:** arrastrá en un espacio vacío para crear una franja; arrastrá una
  franja para moverla; estirala desde el borde de arriba o de abajo. Un clic la abre.
  Mover o estirar cambia el horario en todos sus días.
- **En el celular:** se ve un día por vez (L M M J V S D). Tocá un espacio para crear
  o una franja para editarla.
- Si dos franjas se pisan, van una al lado de la otra y arriba aparece el aviso:
  se ve la que empieza más tarde. La parte tapada se ve rayada.

## Guardado

Cada cambio guarda solo esa franja (antes se borraba todo y se volvía a crear).
No hace falta correr nada en Supabase ni actualizar la app de la TV.

## Mandar a pantallas

Botón **Mandar a pantallas** en la lista o en la programación. La lista muestra en
qué pantallas está cada una y qué pasa ahora.

## Fechas especiales

Para feriados, fiestas o eventos puntuales, sin tocar la semana tipo.

- En la programación → **Fechas especiales** → **Agregar fecha**.
- Elegís un nombre (Feriado, Navidad…), la fecha (o "varios días seguidos"),
  el horario (todo el día o uno puntual, puede cruzar la medianoche) y qué se muestra.
- En su horario **le gana a la semana tipo**; fuera de ese horario todo sigue igual.
  Ej.: 24/12 de 18 a 24 h la playlist de Navidad; el feriado, todo el día, una
  placa de "Cerrado por feriado".
- Los días de esta semana con fecha especial se marcan con ★ en el calendario,
  y "Ahora pasa" avisa si hoy es una.
- Las fechas que ya pasaron se pueden borrar de una vez.

### Paso único en Supabase

En el SQL Editor corré `supabase/migrations/20261102000000_display_schedule_special_dates.sql`
(se puede correr más de una vez). Sin ese paso, la semana tipo sigue funcionando igual y
el panel avisa al querer guardar una fecha especial.
