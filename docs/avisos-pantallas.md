# Avisos por email de pantallas sin señal

Cuando una pantalla vinculada no manda señal hace más de 10 minutos, **dentro de
los días y el horario del local**, se manda un email al comercio y otro al
administrador. Cuando la pantalla vuelve, llega un email de "volvió a funcionar".
Cada caída se avisa una sola vez.

- Fuera del horario del local no se avisa, porque muchas pantallas se apagan de
  noche. Al abrir se espera media hora.
- Las pantallas que llevan más de 7 días apagadas no se avisan (quedaron fuera de uso).
- El cliente configura su email, sus días y su horario desde **Inicio**, en la
  línea "Avisos por email". Por defecto: lunes a sábado de 9 a 21 h, al email
  del comercio.

Los emails salen por [Resend](https://resend.com) (gratis hasta 3.000 por mes) y
los manda la base de datos misma (pg_cron + pg_net). No hace falta desplegar
ninguna función.

## Puesta en marcha (una sola vez)

### 1. Resend

1. Crear una cuenta en https://resend.com.
2. **Domains → Add domain** → `event-pix.com.ar`. Resend muestra 3 o 4 registros
   DNS (TXT y MX): cargarlos donde se administra el dominio y esperar a que
   aparezca "Verified".
3. **API Keys → Create API key** (permiso "Sending access"). Copiar la clave
   (empieza con `re_`).

### 2. Supabase

1. **Database → Extensions**: activar `pg_cron` y `pg_net`.
2. **SQL Editor**: guardar los datos del envío en el Vault (cambiar los valores):

   ```sql
   select vault.create_secret('re_xxxxxxxxxxxxxxxx', 'resend_api_key');
   select vault.create_secret('EventPix <avisos@event-pix.com.ar>', 'alerts_from');
   select vault.create_secret('tu-email@ejemplo.com', 'alerts_admin_email');
   ```

   El remitente tiene que ser del dominio verificado en Resend.
   `alerts_admin_email` recibe una copia de todos los avisos.

3. **SQL Editor**: correr `supabase/migrations/20261029000000_display_down_alerts.sql`.
   Si dice que pg_cron no está activado, activarlo y correrlo de nuevo (se puede
   correr las veces que haga falta).

### 3. Probar

1. Desenchufar un equipo de prueba (en un día y horario de los configurados).
2. Entre 10 y 15 minutos después llega el email de "se quedó sin señal".
3. Enchufarlo: a los pocos minutos llega el de "volvió a funcionar".

Para ver qué pasó con los envíos (en el SQL Editor):

```sql
-- últimas respuestas de Resend (status_code 200 = enviado)
select created, status_code, content from net._http_response order by created desc limit 10;
-- corridas del cron
select start_time, status, return_message from cron.job_run_details order by start_time desc limit 10;
```

## Cambiar la clave o el remitente

```sql
select vault.update_secret((select id from vault.secrets where name = 'resend_api_key'), 're_nueva_clave');
```

## Apagar los avisos para todos

```sql
select cron.unschedule('display-down-alerts');
```
