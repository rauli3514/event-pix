-- El equipo se puede renombrar desde sus Ajustes (Equipo → Nombre). El cambio se ve en
-- el panel. Se identifica con su código + la clave secreta registrada en el checkin,
-- así nadie puede renombrar un equipo ajeno sabiendo solo el código. Re-ejecutable.

CREATE OR REPLACE FUNCTION public.kiosk_device_rename(p_code TEXT, p_secret TEXT, p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_name TEXT := NULLIF(btrim(regexp_replace(COALESCE(p_name, ''), '\s+', ' ', 'g')), '');
    v_rows INTEGER;
BEGIN
    IF v_name IS NOT NULL AND length(v_name) > 60 THEN
        RAISE EXCEPTION 'El nombre puede tener hasta 60 caracteres';
    END IF;
    IF p_secret IS NULL OR length(p_secret) < 32 THEN
        RAISE EXCEPTION 'Equipo no autorizado';
    END IF;

    UPDATE public.kiosk_devices d
        SET name = v_name
        WHERE d.device_code = p_code
          AND d.device_secret_hash = encode(extensions.digest(p_secret, 'sha256'), 'hex');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        RAISE EXCEPTION 'Equipo no autorizado';
    END IF;
    RETURN v_name;
END;
$fn$;

REVOKE ALL ON FUNCTION public.kiosk_device_rename(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_device_rename(TEXT, TEXT, TEXT) TO anon, authenticated;
