-- ==============================================================================
-- Fotos a pantalla: seguridad de la moderación + dedicatoria + tiempo real
-- ==============================================================================
-- 1. Los invitados (anon) ya no pueden insertar fotos ya aprobadas: todo entra
--    como 'pending'. Los usuarios logueados (admins/proveedores) pueden seguir
--    insertando en cualquier estado (lo usa el simulador del panel).
-- 2. Se elimina ai_approve_submission: cualquiera que tuviera el ID de su foto
--    podía aprobarla salteando la moderación. Ahora aprueba solo la función
--    moderate-content desde el servidor.
-- 3. Columna caption (dedicatoria corta que se ve sobre la foto en pantalla).
-- 4. submit_photo acepta la dedicatoria y recorta textos largos.
-- 5. La tabla submissions entra a Realtime para que la pantalla muestre las
--    fotos nuevas al instante.

-- 1. INSERT solo como 'pending' para anon
--    (se borran TODAS las políticas de INSERT existentes: como se combinan con
--    OR, cualquiera que quede con "WITH CHECK (true)" anularía la restricción)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'submissions' AND cmd = 'INSERT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON submissions', pol.policyname);
    END LOOP;
END;
$$;

CREATE POLICY "anon_insert_pending_submissions" ON submissions
    FOR INSERT
    TO anon
    WITH CHECK (status = 'pending');

CREATE POLICY "auth_insert_submissions" ON submissions
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 2. Fuera la auto-aprobación desde el cliente
DROP FUNCTION IF EXISTS ai_approve_submission(UUID);

-- 3. Dedicatoria
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS caption TEXT;

-- 4. submit_photo con dedicatoria (se borra la versión vieja para que no
--    queden dos funciones con el mismo nombre y PostgREST no sepa cuál usar)
DROP FUNCTION IF EXISTS submit_photo(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION submit_photo(
    p_event_id UUID,
    p_content TEXT,
    p_type TEXT,
    p_author TEXT DEFAULT NULL,
    p_caption TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_id UUID;
BEGIN
    IF p_type NOT IN ('photo', 'message', 'audio') THEN
        RAISE EXCEPTION 'Tipo inválido: %', p_type;
    END IF;

    INSERT INTO submissions (event_id, content, type, author, caption, status)
    VALUES (
        p_event_id,
        p_content,
        p_type,
        NULLIF(LEFT(BTRIM(p_author), 40), ''),
        NULLIF(LEFT(BTRIM(p_caption), 120), ''),
        'pending'
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_photo(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- 5. Realtime
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'submissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
    END IF;
END;
$$;
