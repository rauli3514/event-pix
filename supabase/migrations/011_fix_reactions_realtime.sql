-- 1. Asegurar que la tabla existe
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  emoji text not null,
  created_at timestamp default now()
);

-- 2. Asegurar que el flag de configuración existe
alter table if exists event_settings
  add column if not exists reactions_enabled boolean default true;

-- 3. Permisos (RLS) más permisivos para asegurar que funcione
alter table reactions enable row level security;

-- Borrar políticas viejas para evitar duplicados/errores
drop policy if exists "Cualquiera puede crear reacciones" on reactions;
drop policy if exists "Lectura pública de reacciones" on reactions;
drop policy if exists "Insertar reacciones publico" on reactions;
drop policy if exists "Leer reacciones publico" on reactions;

-- Crear políticas nuevas (permitir a todos, incluso anónimos si fuera necesario)
create policy "Insertar reacciones publico"
  on reactions for insert
  to public
  with check (true);

create policy "Leer reacciones publico"
  on reactions for select
  to public
  using (true);

-- 4. CRÍTICO: Añadir la tabla a la publicación de Realtime
-- Esto es lo que hace que el Muro se entere de los nuevos emojis
begin;
  -- Intentar añadir la tabla, ignorando error si ya está añadida
  alter publication supabase_realtime add table reactions;
exception
  when duplicate_object then null;
end;
