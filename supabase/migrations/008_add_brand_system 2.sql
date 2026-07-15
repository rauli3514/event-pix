-- Añadir columnas para el sistema de marca/logo
alter table if exists event_settings
  add column if not exists frame_image_url text,
  add column if not exists frame_enabled boolean default true,
  add column if not exists splash_logo_url text,
  add column if not exists show_splash_logo boolean default true;

-- Comentario explicativo
comment on column event_settings.frame_image_url is 'URL del marco PNG transparente que se superpone en cada foto del muro';
comment on column event_settings.frame_enabled is 'Flag para activar/desactivar el marco en el muro';
comment on column event_settings.splash_logo_url is 'URL del logo que se muestra en la pantalla de carga';
comment on column event_settings.show_splash_logo is 'Flag para mostrar/ocultar el logo en la pantalla de carga';
