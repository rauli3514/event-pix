-- ==========================================
-- SCRIPT MAESTRO DE REPARACIÓN DE REACCIONES
-- ==========================================

-- 1. Crear la tabla 'reactions' (Soluciona el error "relation does not exist")
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  emoji text not null,
  created_at timestamp default now()
);

-- 2. Asegurar que existe el interruptor en 'event_settings'
alter table if exists event_settings
  add column if not exists reactions_enabled boolean default true;

-- 3. Configurar Permisos (RLS)
alter table reactions enable row level security;

-- Borrar políticas viejas para evitar errores de duplicados
drop policy if exists "Cualquiera puede crear reacciones" on reactions;
drop policy if exists "Lectura pública de reacciones" on reactions;
drop policy if exists "Insertar reacciones publico" on reactions;
drop policy if exists "Leer reacciones publico" on reactions;

-- Crear políticas nuevas (permitir a todos)
create policy "Insertar reacciones publico"
  on reactions for insert
  to public
  with check (true);

create policy "Leer reacciones publico"
  on reactions for select
  to public
  using (true);

-- 4. ACTIVAR REALTIME (Para que se vea el confeti)
-- Nota: Si esto da error de "duplicate", ignóralo, significa que ya estaba activo.
alter publication supabase_realtime add table reactions;

-- 5. Índices para velocidad
create index if not exists reactions_event_id_idx on reactions(event_id);
