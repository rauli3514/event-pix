-- Tabla para reacciones en tiempo real
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  submission_id uuid references submissions(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '😂', '👏', '✨')),
  created_at timestamp default now(),
  -- Índices para optimizar queries
  constraint reactions_event_submission_unique unique (event_id, submission_id, created_at)
);

-- Índice para búsquedas rápidas por evento
create index if not exists reactions_event_id_idx on reactions(event_id);

-- Índice para búsquedas por submission
create index if not exists reactions_submission_id_idx on reactions(submission_id);

-- Habilitar RLS
alter table reactions enable row level security;

-- Política: cualquiera autenticado puede crear reacciones
create policy "Cualquiera puede crear reacciones"
  on reactions for insert
  to authenticated
  with check (true);

-- Política: cualquiera puede leer reacciones
create policy "Lectura pública de reacciones"
  on reactions for select
  to authenticated
  using (true);

-- Comentarios
comment on table reactions is 'Reacciones en tiempo real para fotos y mensajes del muro';
comment on column reactions.emoji is 'Emoji de la reacción: ❤️, 🔥, 😂, 👏, ✨';
