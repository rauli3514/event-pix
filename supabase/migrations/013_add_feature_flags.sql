-- Añadir flags para las nuevas funcionalidades (todas desactivadas por defecto para proteger rendimiento)
alter table if exists event_settings
  add column if not exists public_gallery_enabled boolean default false,
  add column if not exists dj_mode_enabled boolean default false,
  add column if not exists photo_booth_enabled boolean default false;

comment on column event_settings.public_gallery_enabled is 'Permite a los invitados ver una galería de fotos en su celular';
comment on column event_settings.dj_mode_enabled is 'Habilita el panel de efectos manuales para el operador';
comment on column event_settings.photo_booth_enabled is 'Genera una foto descargable con marco después de subirla';
