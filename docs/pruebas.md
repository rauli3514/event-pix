# Pruebas de 7 días ("Probalo")

Cualquier persona puede registrarse desde la web para probar Display Digital durante 7 días.
Usa el **mismo panel que los clientes**, así que cuando contrata no cambia nada: se lo pasa a
cliente y sigue con todo lo que armó.

## Estado de cada negocio

| Estado | Qué es |
| --- | --- |
| **Cliente** | Contrató. Todos los negocios que existían antes quedaron así. |
| **En prueba** | Se registró solo. Vence a los 7 días. |
| **Prueba vencida** | Una prueba que pasó la fecha (no contrató todavía). |
| **Baja** | Se dio de baja. |

El estado solo lo cambia el super admin (los clientes pueden leer su negocio, no modificarlo).

## Admin: Directorio de Clientes (`/admin/display`)

- Pestañas **Clientes · En prueba · Pruebas vencidas · Bajas**, con cuántos hay en cada una.
  Las pruebas se ordenan por la que vence primero.
- En cada prueba: quién es, su WhatsApp (abre el chat con un mensaje ya escrito), rubro, ciudad,
  cuántas TV tiene, si usa Fudo y cómo nos conoció. También cuántas pantallas vinculó, cuántos
  carteles armó, cuándo se registró y su último ingreso.
- Menú ⋮: **Pasar a cliente**, **Extender 7 días** (suma desde hoy, o desde el vencimiento si
  todavía no venció), **Notas** (solo las ve el equipo) y **Dar de baja**.

## Reglas

- Una prueba por email y una por WhatsApp (el número se compara sin espacios, 54, 9, 0 ni 15:
  "362 15 454-7382" y "+54 9 362 454-7382" son el mismo).
- Una cuenta tiene un solo negocio.
- Lo que armó alguien que no contrató se guarda 30 días después de vencer.

## Base de datos

Migración `supabase/migrations/20261116000000_display_trials.sql`:

- `display_commerces`: columnas `plan` (`cliente` | `prueba` | `baja`, por defecto `cliente`),
  `trial_ends_at` y `plan_changed_at`.
- `display_trial_signups`: los datos del registro (solo los ve el super admin).
- `display_start_trial(p jsonb)`: la llama la página de registro con la cuenta ya creada; crea el
  negocio en prueba, lo vincula y guarda los datos.
- `display_trial_details(p jsonb)`: guarda el paso 2 del formulario.
- `display_admin_accounts()` y `display_admin_set_plan(...)`: para el admin.

## Lo que falta (próximos PR)

1. Página de registro `/probar`, barra de días en el panel, guías más a mano y pantalla de
   prueba (se vincula con el código, igual que un equipo).
2. Vencimiento: panel solo para mirar, cartel "Prueba terminada" en la TV, emails y aviso al
   equipo cuando alguien se registra.
3. Botón "Probalo" en event-pix.com.ar.
