-- =============================================================================
-- Display Digital: cierre de permisos (RLS) y RPCs seguras para las pantallas
-- =============================================================================
-- Problemas que corrige:
--   1. display_devices tenía UPDATE abierto a cualquiera (USING true / WITH CHECK
--      true): con la anon key pública se podía reasignar cualquier pantalla a
--      otro negocio, cambiarle el estado o el grupo.
--   2. display_schedules y display_schedule_events tenían "Enable all"
--      (USING true): cualquiera podía borrar o redirigir la programación de
--      todos los negocios. Como las políticas permisivas se suman con OR, la
--      política por negocio no restringía nada.
--   3. Storage "display-media": cualquier usuario autenticado podía pisar o
--      borrar archivos de OTRO negocio (y el registro es abierto).
--
-- Qué hace:
--   - Borra TODAS las políticas existentes de las tablas display_* afectadas
--     (hay políticas creadas a mano fuera de migraciones) y crea un set limpio:
--       * lectura pública (la necesita el reproductor de TV, que no tiene sesión)
--       * escritura solo para quien administra el negocio (o super admin)
--   - Las pantallas sin sesión ya no escriben directo en display_devices:
--       * display_device_heartbeat(): solo toca last_seen / telemetría / versiones
--       * display_link_device(): vincula una pantalla pendiente a un negocio,
--         verificando que el usuario administre ese negocio.
--   - Storage: solo se puede subir/modificar/borrar dentro de la carpeta
--     <commerce_id>/ de un negocio que el usuario administra.
--   - Agrega display_devices y display_schedule_events a Realtime.
--
-- Pendiente (no lo cubre esta migración): la lectura pública de pantallas
-- expone los códigos, y el canal de comandos `device:<código>` no exige
-- autenticación. Requiere un token por pantalla; se hará aparte.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

-- ¿El usuario actual puede administrar este negocio de cartelería?
-- Acepta los tres modelos que conviven en la base:
--   - super admin
--   - modelo viejo: commerce_id = id del usuario
--   - display_commerce_users (usuarios asignados por el super admin)
--   - intelligence_business_users (dueños que se registraron solos; el
--     negocio de cartelería usa el mismo id que el negocio de Intelligence)
CREATE OR REPLACE FUNCTION public.display_can_manage(p_commerce uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF public.is_super_admin() THEN
        RETURN true;
    END IF;

    IF p_commerce IS NULL THEN
        RETURN false;
    END IF;

    IF p_commerce = auth.uid() THEN
        RETURN true;
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.display_commerce_users
        WHERE commerce_id = p_commerce AND user_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    BEGIN
        IF EXISTS (
            SELECT 1 FROM public.intelligence_business_users
            WHERE business_id = p_commerce AND user_id = auth.uid()
        ) THEN
            RETURN true;
        END IF;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

    RETURN false;
END;
$$;

-- Igual que display_can_manage pero a partir de la ruta de un archivo de
-- Storage ("<commerce_id>/archivo.ext"). Si la carpeta no es un UUID, false.
CREATE OR REPLACE FUNCTION public.display_can_manage_path(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_folder text := split_part(coalesce(p_name, ''), '/', 1);
BEGIN
    IF public.is_super_admin() THEN
        RETURN true;
    END IF;
    IF v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN false;
    END IF;
    RETURN public.display_can_manage(v_folder::uuid);
END;
$$;

REVOKE ALL ON FUNCTION public.display_can_manage(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.display_can_manage_path(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_can_manage(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.display_can_manage_path(text) TO anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Borrar todas las políticas actuales de las tablas display_*
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
              'display_devices',
              'display_groups',
              'display_assignments',
              'display_campaigns',
              'display_media',
              'display_schedules',
              'display_schedule_events'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

ALTER TABLE public.display_devices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_campaigns        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_schedules        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.display_schedule_events  ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Políticas nuevas
-- -----------------------------------------------------------------------------

-- display_devices --------------------------------------------------------------
-- Lectura pública: el reproductor (sin sesión) lee su propia configuración por
-- código y escucha por Realtime cuándo lo vinculan.
CREATE POLICY "display_devices_read" ON public.display_devices
    FOR SELECT USING (true);

-- Auto-registro de una TV nueva: solo como pendiente y sin negocio.
CREATE POLICY "display_devices_register" ON public.display_devices
    FOR INSERT TO anon, authenticated
    WITH CHECK (pairing_status = 'pending' AND commerce_id IS NULL AND group_id IS NULL);

CREATE POLICY "display_devices_manage" ON public.display_devices
    FOR ALL TO authenticated
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

-- display_groups ---------------------------------------------------------------
CREATE POLICY "display_groups_manage" ON public.display_groups
    FOR ALL TO authenticated
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

-- display_campaigns ------------------------------------------------------------
CREATE POLICY "display_campaigns_read" ON public.display_campaigns
    FOR SELECT USING (true);

CREATE POLICY "display_campaigns_manage" ON public.display_campaigns
    FOR ALL TO authenticated
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

-- display_media ----------------------------------------------------------------
CREATE POLICY "display_media_read" ON public.display_media
    FOR SELECT USING (true);

CREATE POLICY "display_media_manage" ON public.display_media
    FOR ALL TO authenticated
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

-- display_assignments (no tiene commerce_id: se deriva de la pantalla o grupo) -
CREATE POLICY "display_assignments_read" ON public.display_assignments
    FOR SELECT USING (true);

CREATE POLICY "display_assignments_manage" ON public.display_assignments
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.display_devices d
                WHERE d.id = display_assignments.device_id
                  AND public.display_can_manage(d.commerce_id))
        OR EXISTS (SELECT 1 FROM public.display_groups g
                   WHERE g.id = display_assignments.group_id
                     AND public.display_can_manage(g.commerce_id))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.display_devices d
                WHERE d.id = display_assignments.device_id
                  AND public.display_can_manage(d.commerce_id))
        OR EXISTS (SELECT 1 FROM public.display_groups g
                   WHERE g.id = display_assignments.group_id
                     AND public.display_can_manage(g.commerce_id))
    );

-- display_schedules ------------------------------------------------------------
CREATE POLICY "display_schedules_read" ON public.display_schedules
    FOR SELECT USING (true);

CREATE POLICY "display_schedules_manage" ON public.display_schedules
    FOR ALL TO authenticated
    USING (public.display_can_manage(commerce_id))
    WITH CHECK (public.display_can_manage(commerce_id));

-- display_schedule_events (se deriva del schedule) -----------------------------
CREATE POLICY "display_schedule_events_read" ON public.display_schedule_events
    FOR SELECT USING (true);

CREATE POLICY "display_schedule_events_manage" ON public.display_schedule_events
    FOR ALL TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.display_schedules s
                WHERE s.id = display_schedule_events.schedule_id
                  AND public.display_can_manage(s.commerce_id))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.display_schedules s
                WHERE s.id = display_schedule_events.schedule_id
                  AND public.display_can_manage(s.commerce_id))
    );

-- -----------------------------------------------------------------------------
-- 4. RPCs para las pantallas y la vinculación
-- -----------------------------------------------------------------------------

-- Latido de la TV: solo actualiza campos de estado, nunca negocio/grupo/estado.
CREATE OR REPLACE FUNCTION public.display_device_heartbeat(
    p_device_code text,
    p_telemetry jsonb DEFAULT NULL,
    p_app_version text DEFAULT NULL,
    p_android_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_device_code IS NULL OR length(p_device_code) > 64 THEN
        RETURN;
    END IF;

    -- Telemetría razonable (evita que alguien llene la tabla con basura)
    IF p_telemetry IS NOT NULL AND pg_column_size(p_telemetry) > 16384 THEN
        p_telemetry := NULL;
    END IF;

    UPDATE public.display_devices
    SET last_seen       = now(),
        telemetry       = coalesce(p_telemetry, telemetry),
        app_version     = coalesce(left(p_app_version, 64), app_version),
        android_version = coalesce(left(p_android_version, 64), android_version)
    WHERE device_id = p_device_code;
END;
$$;

REVOKE ALL ON FUNCTION public.display_device_heartbeat(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_device_heartbeat(text, jsonb, text, text) TO anon, authenticated;

-- Vincular una pantalla pendiente (código que muestra la TV) a un negocio.
CREATE OR REPLACE FUNCTION public.display_link_device(
    p_device_code text,
    p_commerce_id uuid,
    p_name text,
    p_description text DEFAULT NULL,
    p_group_id uuid DEFAULT NULL,
    p_orientation text DEFAULT 'landscape'
)
RETURNS public.display_devices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_device public.display_devices;
BEGIN
    IF NOT public.display_can_manage(p_commerce_id) THEN
        RAISE EXCEPTION 'No tenés permisos sobre este negocio' USING ERRCODE = '42501';
    END IF;

    IF p_group_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.display_groups
        WHERE id = p_group_id AND commerce_id = p_commerce_id
    ) THEN
        RAISE EXCEPTION 'El grupo no pertenece a este negocio' USING ERRCODE = '42501';
    END IF;

    UPDATE public.display_devices
    SET name           = p_name,
        description    = p_description,
        commerce_id    = p_commerce_id,
        group_id       = p_group_id,
        pairing_status = 'linked',
        orientation    = coalesce(p_orientation, 'landscape')
    WHERE device_id = upper(trim(p_device_code))
      AND pairing_status = 'pending'
    RETURNING * INTO v_device;

    IF v_device.id IS NULL THEN
        RAISE EXCEPTION 'Código inválido o dispositivo ya vinculado.' USING ERRCODE = 'P0002';
    END IF;

    RETURN v_device;
END;
$$;

REVOKE ALL ON FUNCTION public.display_link_device(text, uuid, text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.display_link_device(text, uuid, text, text, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. Storage "display-media": escritura solo en la carpeta del propio negocio
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND cmd <> 'SELECT'
          AND (coalesce(qual, '') ILIKE '%display-media%' OR coalesce(with_check, '') ILIKE '%display-media%')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

CREATE POLICY "display_media_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'display-media' AND public.display_can_manage_path(name));

CREATE POLICY "display_media_storage_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'display-media' AND public.display_can_manage_path(name))
    WITH CHECK (bucket_id = 'display-media' AND public.display_can_manage_path(name));

CREATE POLICY "display_media_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'display-media' AND public.display_can_manage_path(name));

-- -----------------------------------------------------------------------------
-- 6. Realtime: el reproductor escucha también pantallas y eventos de horario
-- -----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'display_devices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.display_devices;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND tablename = 'display_schedule_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.display_schedule_events;
    END IF;
END $$;

COMMIT;
