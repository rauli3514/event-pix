-- Display Digital: QR fijo en la pantalla (por ejemplo, el menú de un bar).
--
-- Cada pantalla puede tener un código QR fijo en una esquina, encima de todo
-- lo que pasa. La TV lo lee de su propia fila (la lectura de display_devices
-- ya es pública por código); lo cambian quienes administran el comercio.
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).

ALTER TABLE public.display_devices ADD COLUMN IF NOT EXISTS qr_overlay jsonb;

COMMENT ON COLUMN public.display_devices.qr_overlay IS
    'QR fijo en pantalla: {spec, value, caption, corner (br|bl|tr|tl), size (s|m|l)} o null';
