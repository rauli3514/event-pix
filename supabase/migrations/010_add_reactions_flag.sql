-- Añadir flag para activar/desactivar reacciones
alter table if exists event_settings
  add column if not exists reactions_enabled boolean default true;

comment on column event_settings.reactions_enabled is 'Flag para permitir o bloquear las reacciones en vivo';
