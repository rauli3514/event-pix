-- =============================================================================
-- Display Digital: comandos remotos firmados y cifrados
-- =============================================================================
-- Problema: el panel manda comandos a la TV (recargar, volumen, Wi-Fi...) por
-- el canal Realtime `device:<código>`, que no exige autenticación. Como los
-- códigos de pantalla son de lectura pública, cualquiera podía mandarle
-- comandos a cualquier TV y leer las contraseñas de Wi-Fi que viajaban en
-- texto plano.
--
-- Solución: cada TV genera una clave secreta y la registra acá (una sola vez).
-- El panel no conoce la clave: le pide a display_sign_command() que cifre
-- (AES-256-CBC) y firme (HMAC-SHA256) el comando, y eso solo funciona si el
-- usuario administra el negocio de la pantalla. La TV descarta todo lo que no
-- pueda verificar con su clave.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Claves de las pantallas. RLS activado y SIN políticas: nadie la lee ni la
-- escribe directo; solo las funciones de abajo (SECURITY DEFINER).
CREATE TABLE IF NOT EXISTS public.display_device_secrets (
    device_id  uuid PRIMARY KEY REFERENCES public.display_devices(id) ON DELETE CASCADE,
    secret     text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.display_device_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.display_device_secrets FROM anon, authenticated;

-- La TV registra su clave. Si ya hay una, no la pisa: devuelve si coincide.
-- (Así nadie puede reemplazar la clave de una pantalla que ya la registró.)
CREATE OR REPLACE FUNCTION public.display_register_command_secret(p_device_code text, p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_device_id uuid;
    v_stored text;
BEGIN
    IF p_secret IS NULL OR p_secret !~ '^[0-9a-f]{64}$' THEN
        RETURN false;
    END IF;

    SELECT id INTO v_device_id FROM public.display_devices WHERE device_id = p_device_code;
    IF v_device_id IS NULL THEN
        RETURN false;
    END IF;

    INSERT INTO public.display_device_secrets (device_id, secret)
    VALUES (v_device_id, p_secret)
    ON CONFLICT (device_id) DO NOTHING;

    SELECT secret INTO v_stored FROM public.display_device_secrets WHERE device_id = v_device_id;
    RETURN v_stored = p_secret;
END;
$$;

REVOKE ALL ON FUNCTION public.display_register_command_secret(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_register_command_secret(text, text) TO anon, authenticated;

-- Borra la clave de una pantalla (si la TV perdió la suya). La TV registra una
-- nueva sola en los minutos siguientes.
CREATE OR REPLACE FUNCTION public.display_reset_command_secret(p_device_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.display_devices
        WHERE id = p_device_id AND public.display_can_manage(commerce_id)
    ) THEN
        RAISE EXCEPTION 'No tenés permisos sobre esta pantalla' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.display_device_secrets WHERE device_id = p_device_id;
END;
$$;

REVOKE ALL ON FUNCTION public.display_reset_command_secret(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_reset_command_secret(uuid) TO authenticated;

-- Cifra y firma un comando para una pantalla. Devuelve {v, iv, ct, sig} (hex).
--   msg  = {"cmd": <comando>, "device": <código>, "ts": <ms>, "nonce": <hex>}
--   ct   = AES-256-CBC(msg) con clave SHA-256('enc:' || secret)
--   sig  = HMAC-SHA256(iv || ct) con clave secret
-- La TV verifica la firma, descifra y controla código, hora y nonce.
CREATE OR REPLACE FUNCTION public.display_sign_command(p_device_id uuid, p_command jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_code   text;
    v_secret text;
    v_msg    text;
    v_iv     bytea;
    v_ct     bytea;
BEGIN
    SELECT d.device_id INTO v_code
    FROM public.display_devices d
    WHERE d.id = p_device_id AND public.display_can_manage(d.commerce_id);

    IF v_code IS NULL THEN
        RAISE EXCEPTION 'No tenés permisos sobre esta pantalla' USING ERRCODE = '42501';
    END IF;

    SELECT secret INTO v_secret FROM public.display_device_secrets WHERE device_id = p_device_id;
    IF v_secret IS NULL THEN
        RAISE EXCEPTION 'La pantalla todavía no registró su clave de comandos. Esperá a que se conecte con la versión nueva.'
            USING ERRCODE = 'P0002';
    END IF;

    IF p_command IS NULL OR jsonb_typeof(p_command) <> 'object' OR pg_column_size(p_command) > 4096 THEN
        RAISE EXCEPTION 'Comando inválido' USING ERRCODE = '22023';
    END IF;

    v_msg := jsonb_build_object(
        'cmd', p_command,
        'device', v_code,
        'ts', floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint,
        'nonce', encode(gen_random_bytes(12), 'hex')
    )::text;

    v_iv := gen_random_bytes(16);
    v_ct := encrypt_iv(
        convert_to(v_msg, 'UTF8'),
        digest(convert_to('enc:' || v_secret, 'UTF8'), 'sha256'),
        v_iv,
        'aes-cbc/pad:pkcs'
    );

    RETURN jsonb_build_object(
        'v', 2,
        'iv', encode(v_iv, 'hex'),
        'ct', encode(v_ct, 'hex'),
        'sig', encode(hmac(v_iv || v_ct, convert_to(v_secret, 'UTF8'), 'sha256'), 'hex')
    );
END;
$$;

REVOKE ALL ON FUNCTION public.display_sign_command(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_sign_command(uuid, jsonb) TO authenticated;

COMMIT;
