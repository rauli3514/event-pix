-- ==============================================================================
-- MIGRACIÓN 038: RPC FOR SECURE CLIENT-SIDE SUBMISSIONS
-- ==============================================================================
-- Estas funciones permiten insertar y aprobar fotos "sin RLS" (Security Definer),
-- pero controladas por la lógica interna, lo que permite que el cliente (Anon)
-- pueda subir fotos y luego aprobarlas SI tiene el ID (que solo recibe al crear).

-- 1. Función para Insertar Foto (Devuelve el ID, bypass RLS)
CREATE OR REPLACE FUNCTION submit_photo(
    p_event_id UUID,
    p_content TEXT,
    p_type TEXT,
    p_author TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER -- Ejecuta como superadmin (bypass RLS)
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO submissions (event_id, content, type, author, status)
    VALUES (p_event_id, p_content, p_type, p_author, 'pending')
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- 2. Función para Aprobar Foto por IA (Requiere conocer el ID)
-- Esto es "seguridad por conocimiento del secreto (UUID)".
-- Solo quien acaba de crear la foto (o un adivino con suerte infinita) sabe el UUID al instante.
CREATE OR REPLACE FUNCTION ai_approve_submission(
    p_submission_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE submissions
    SET status = 'approved',
        moderated_at = NOW()
    WHERE id = p_submission_id
    AND status = 'pending'; -- Solo si estaba pendiente
END;
$$;
