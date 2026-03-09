-- Migration 021: Admin Trivia Reset Function
-- Eliminamos inscriptos y respuestas de manera segura y atómica

CREATE OR REPLACE FUNCTION admin_reset_trivia(p_game_id UUID)
RETURNS VOID AS $$
BEGIN
    -- 1. Borrar respuestas
    DELETE FROM trivia_answers WHERE game_id = p_game_id;

    -- 2. Borrar jugadores
    DELETE FROM trivia_players WHERE game_id = p_game_id;

    -- 3. Resetear el juego
    UPDATE trivia_games
    SET 
        status = 'lobby',
        current_question_id = (
            SELECT id FROM trivia_questions 
            WHERE game_id = p_game_id 
            ORDER BY order_index ASC 
            LIMIT 1
        ),
        question_started_at = NULL,
        updated_at = NOW()
    WHERE id = p_game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
