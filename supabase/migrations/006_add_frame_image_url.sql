create table if not exists events (
  id uuid primary key,
  name text,
  description text,
  start_date timestamp,
  end_date timestamp,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  -- Existing columns ...
  frame_image_url text -- URL del marco PNG transparente
);

-- Si la tabla ya existe, solo añadimos la columna
alter table if exists events add column if not exists frame_image_url text;
