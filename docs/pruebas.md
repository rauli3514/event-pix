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

## Admin: pestaña Display Digital (Cartelería) en `/admin` (y `/admin/display`)

- Pestañas **Clientes · En prueba · Pruebas vencidas · Bajas**, con cuántos hay en cada una.
  Las pruebas se ordenan por la que vence primero.
- En cada prueba: quién es, su WhatsApp (abre el chat con un mensaje ya escrito), rubro, ciudad,
  cuántas TV tiene, si usa Fudo y cómo nos conoció. También cuántas pantallas vinculó, cuántos
  carteles armó, cuándo se registró y su último ingreso.
- Menú ⋮: **Pasar a cliente**, **Extender 7 días** (suma desde hoy, o desde el vencimiento si
  todavía no venció), **Notas** (solo las ve el equipo) y **Dar de baja**.
  También **Eliminar comercio** (borra el comercio y sus pantallas; antes era el tacho de basura).

## Registro: `app.event-pix.com.ar/probar`

1. **Tu cuenta:** nombre, negocio, rubro, WhatsApp, email y contraseña. Se crea la cuenta (sin
   confirmar el email: en Supabase, *Confirm email* tiene que estar apagado), el negocio en prueba y
   un **cartel de ejemplo** de su rubro con el nombre del negocio.
2. **Unas preguntas (opcional):** ciudad, cuántas TV tiene, si usa Fudo y cómo nos conoció.

Después entra al **mismo panel que los clientes**:

- Barra naranja arriba: días que le quedan, **Pantalla de prueba** y **Quiero contratarlo**
  (WhatsApp de ventas). Aclara que el servicio contratado funciona con el **equipo Display
  Digital**. Al vencer, la barra se pone roja.
- **Pantalla de prueba** abre `/tv-boot?prueba` en otra pestaña: muestra un código que se vincula a
  mano en Pantallas → Vincular pantalla, igual que con el equipo (así practica).

## Guía para empezar

Botón **Guía para empezar** arriba del menú (con cuántos pasos lleva), que abre la guía desde
cualquier página. En Inicio aparece mientras falte algún paso (se puede cerrar). Los pasos se marcan
solos:

1. Abrí la pantalla de prueba (en prueba) / Conectá el equipo a la TV (clientes)
2. Vinculala con el código
3. Armá tu cartel
4. Cargá tus precios (o traelos de Fudo)
5. Mandalo a la pantalla

Abajo, **Escribinos** por WhatsApp. En el menú **Más** está **Ayuda por WhatsApp**.

En **Gestión de Usuarios**, los que se registraron para probar llevan la etiqueta naranja
**Prueba · N días** (o **Prueba vencida**).

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

## Cuando termina la prueba (o se da de baja)

Migración `supabase/migrations/20261117000000_display_trial_end.sql`.

- **Panel:** en vez del panel aparece "Terminó tu prueba" (o "Tu cuenta está en pausa" si es una baja),
  con los carteles que armó, hasta cuándo se guarda todo y los botones **Quiero contratarlo** (WhatsApp)
  y el teléfono. El super admin sigue entrando normalmente (ve la barra roja arriba).
- **TV:** cada 10 minutos pregunta si su negocio sigue activo (`display_device_account`). Si terminó la
  prueba muestra "Terminó la prueba de Display Digital" con el WhatsApp; si es baja, "Pantalla en pausa".
  Sin internet queda lo último que supo.
- **Pantallas:** en la prueba se pueden vincular hasta **2**; con la prueba vencida o de baja, ninguna
  (lo controla la base al vincular, con el mensaje en castellano). Los clientes no tienen límite.
- **Al pasarlo a cliente** vuelve todo como estaba. **Extender 7 días** también, y se rearman los emails.

## Emails

Salen por Resend con los mismos datos del Vault que los avisos de pantallas (`resend_api_key`,
`alerts_from`, `alerts_admin_email`). La revisión corre cada hora con pg_cron (`display-trials`).

| Cuándo | A quién |
| --- | --- |
| Alguien se registra para probar | Al equipo (`alerts_admin_email`), con sus datos y WhatsApp |
| Le quedan 2 días | Al que prueba |
| Terminó la prueba | Al que prueba y al equipo ("buen momento para escribirle") |

## A los 30 días

Lo que armó se guarda 30 días después de vencer. Pasado ese tiempo, la tarjeta en **Pruebas vencidas**
lo avisa y en el menú ⋮ aparece **Borrar sus archivos**: borra sus fotos, videos, carteles y medios
(quedan el negocio y sus datos de contacto). Es un botón y no algo automático porque Supabase no deja
borrar archivos del Storage desde la base.

## El cartel de ejemplo

Al registrarse se crea el cartel de su rubro **con su lista de precios** ("Pizzas (ejemplo)"), igual
que cuando se arma un cartel desde un diseño en el editor: así en la TV se ve con precios y, si cambia
uno en Listas de precios, cambia el cartel.
