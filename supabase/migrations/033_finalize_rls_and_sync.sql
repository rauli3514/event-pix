-- 033: FINAL FIXES FOR PUBLIC ACCESS AND SYNC
-- Permite que los invitados (Wall/Invitados) vean las submisiones aprobadas
DROP POLICY IF EXISTS "Public can view submissions" ON submissions;
CREATE POLICY "Public can view submissions"
    ON submissions FOR SELECT
    TO anon
    USING (status = 'approved' OR status = 'pending'); -- Pendiente tmb para que el autor la vea o el admin

-- Asegurar que photo_vote_sessions sea publico SELECT
DROP POLICY IF EXISTS "Public can view photo sessions" ON photo_vote_sessions;
CREATE POLICY "Public can view photo sessions"
    ON photo_vote_sessions FOR SELECT
    TO anon
    USING (true);

-- Asegurar que trivia_games sea publico SELECT (ya estaba pero reforzamos)
DROP POLICY IF EXISTS "Public can view trivia games" ON trivia_games;
CREATE POLICY "Public can view trivia games"
    ON trivia_games FOR SELECT
    TO anon
    USING (status != 'setup');

-- Habilitar tiempo real para las tablas si no lo estaban
ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE trivia_games;
ALTER PUBLICATION supabase_realtime ADD TABLE trivia_players;
ALTER PUBLICATION supabase_realtime ADD TABLE trivia_answers;
ALTER PUBLICATION supabase_realtime ADD TABLE photo_vote_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE photo_votes;
