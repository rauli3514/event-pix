create table if not exists event_settings (
  id uuid primary key,
  event_id uuid references events(id),
  title text,
  description text,
  background_image_url text,
  display_background_url text,
  display_template text,
  text_messages_enabled boolean,
  carousel_max_loops integer,
  carousel_interval_ms integer,
  wall_show_controls boolean,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  frame_image_url text -- URL del marco PNG transparente
);

-- Si la tabla ya existe, solo añadimos la columna
alter table if exists event_settings add column if not exists frame_image_url text;
