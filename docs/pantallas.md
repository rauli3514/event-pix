# Pantallas

- **Clic en la foto de una pantalla:** abre "Cambiar contenido" (también en Inicio).
  Los detalles y el diagnóstico están en el menú ⋮ → "Detalles y diagnóstico".
- **Ordenar:** arrastrá una tarjeta y soltala sobre otra: queda en ese lugar.
  Si la soltás sobre una pantalla de otra zona, pasa a esa zona.
- **Cambiar de zona:** soltá la tarjeta sobre una zona (las fichas de arriba o el
  título de una sección).
- **TVs esperando vincularse:** aparecen arriba con su código y el botón "Vincular".

## Paso único en Supabase (orden)

Para que el orden se vea igual desde cualquier computadora, corré en el SQL Editor
`supabase/migrations/20261103000000_display_device_order.sql`:

```sql
ALTER TABLE public.display_devices ADD COLUMN IF NOT EXISTS sort_order integer;
```

Sin ese paso, el orden se guarda solo en el navegador donde lo armaste.
