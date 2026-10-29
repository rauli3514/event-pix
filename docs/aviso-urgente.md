# Aviso urgente en las pantallas

Mensaje que aparece en segundos encima de lo que se está mostrando ("Hoy
cerramos a las 18 h") y se va solo a la hora elegida.

## Puesta en marcha (una sola vez)

Supabase → SQL Editor: correr
`supabase/migrations/20261031000000_display_urgent_alerts.sql`
(se puede correr más de una vez). No hace falta actualizar la app de las TVs.

## Uso

- **Inicio → Aviso urgente** (también desde el celular): mensaje, cómo se ve
  (franja abajo o pantalla completa), color, cuánto dura (15 min a 2 h, o hasta
  una hora) y en qué pantallas.
- Los avisos activos aparecen arriba de Inicio con **Quitar ya**.
- La TV consulta el aviso cada 30 segundos y al instante cuando el panel avisa.
  Sin internet, igual se saca a la hora de fin.
