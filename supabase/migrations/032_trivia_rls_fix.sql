-- Migración 032: Trivia RLS & Realtime Consistency Fix
-- Asegura que tanto Admins como Invitados tengan los permisos correctos
-- Y habilita Realtime para que los cambios se vean sin F5.

-- 1. Habilitar RLS en todas las tablas de trivia
ALTER TABLE IF EXISTS trivia_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trivia_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trivia_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trivia_answers ENABLE ROW LEVEL SECURITY;

-- 2. Limpieza de políticas previas para evitar duplicidad o conflictos
DO $$ 
DECLARE 
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'trivia_%' LOOP
        EXECUTE format('DROP POLICY IF EXISTS "policy_admin_all" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "policy_guest_read" ON %I', t);
        EXECUTE format('DROP POLICY IF EXISTS "policy_guest_insert" ON %I', t);
    END LOOP;
END $$;

-- 3. POLÍTICAS PARA ADMINS (Cualquier usuario autenticado para simplificar, o usar has_event_access si se desea rigor)
-- Nota: Usamos authenticated + is_super_admin o has_event_access si el sistema lo requiere.
-- Por ahora, authenticated (Cualquier Admin/Provider logueado) tiene control total.

CREATE POLICY "policy_admin_all" ON trivia_games FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_admin_all" ON trivia_questions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_admin_all" ON trivia_players FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_admin_all" ON trivia_answers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. POLÍTICAS PARA INVITADOS (ANON)
-- Los invitados deben poder ver juegos activos y preguntas, unirse (insert players) y responder (insert answers)

-- trivia_games: Ver si están en estado lobby/active/results/finished
CREATE POLICY "policy_guest_read" ON trivia_games FOR SELECT TO anon USING (status != 'setup');

-- trivia_questions: Ver preguntas de juegos que no estén en setup
CREATE POLICY "policy_guest_read" ON trivia_questions FOR SELECT TO anon USING (
    EXISTS (SELECT 1 FROM trivia_games WHERE id = trivia_questions.game_id AND status != 'setup')
);

-- trivia_players: Unirse y ver ranking (select/insert)
CREATE POLICY "policy_guest_read" ON trivia_players FOR SELECT TO anon USING (true);
CREATE POLICY "policy_guest_insert" ON trivia_players FOR INSERT TO anon WITH CHECK (true);

-- trivia_answers: Responder (insert) y ver conteos (select)
CREATE POLICY "policy_guest_read" ON trivia_answers FOR SELECT TO anon USING (true);
CREATE POLICY "policy_guest_insert" ON trivia_answers FOR INSERT TO anon WITH CHECK (true);

-- 5. Habilitar Realtime mediante la publicación supabase_realtime
-- Esto permite que useTriviaRealtime reciba eventos de postgres_changes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'trivia_games') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE trivia_games;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'trivia_players') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE trivia_players;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'trivia_answers') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE trivia_answers;
    END IF;
END $$;

-- 6. Habilitar RLS en tablas de Votación
ALTER TABLE IF EXISTS photo_vote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS photo_votes ENABLE ROW LEVEL SECURITY;

-- 7. Limpieza de políticas previas de Votación
DROP POLICY IF EXISTS "policy_admin_all" ON photo_vote_sessions;
DROP POLICY IF EXISTS "policy_guest_read" ON photo_vote_sessions;
DROP POLICY IF EXISTS "policy_admin_all" ON photo_votes;
DROP POLICY IF EXISTS "policy_guest_read" ON photo_votes;
DROP POLICY IF EXISTS "policy_guest_insert" ON photo_votes;

-- 8. POLÍTICAS DE VOTACIÓN PARA ADMINS
CREATE POLICY "policy_admin_all" ON photo_vote_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "policy_admin_all" ON photo_votes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. POLÍTICAS DE VOTACIÓN PARA INVITADOS (ANON)
-- Ver sesiones activas/finalizadas
CREATE POLICY "policy_guest_read" ON photo_vote_sessions FOR SELECT TO anon USING (status != 'inactive');
-- Ver votos (conteo) y emitir nuevos
CREATE POLICY "policy_guest_read" ON photo_votes FOR SELECT TO anon USING (true);
CREATE POLICY "policy_guest_insert" ON photo_votes FOR INSERT TO anon WITH CHECK (true);

-- 10. Habilitar Realtime para Votación
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'photo_vote_sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE photo_vote_sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'photo_votes') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE photo_votes;
    END IF;
END $$;
