-- 1. Insertar comercios faltantes a partir de datos existentes para no romper nada
INSERT INTO public.display_commerces (id, name)
SELECT DISTINCT commerce_id, 'Comercio ' || substr(commerce_id::text, 1, 4)
FROM public.display_devices
WHERE commerce_id NOT IN (SELECT id FROM public.display_commerces)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.display_commerces (id, name)
SELECT DISTINCT commerce_id, 'Comercio ' || substr(commerce_id::text, 1, 4)
FROM public.display_groups
WHERE commerce_id NOT IN (SELECT id FROM public.display_commerces)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.display_commerces (id, name)
SELECT DISTINCT commerce_id, 'Comercio ' || substr(commerce_id::text, 1, 4)
FROM public.display_campaigns
WHERE commerce_id NOT IN (SELECT id FROM public.display_commerces)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.display_commerces (id, name)
SELECT DISTINCT commerce_id, 'Comercio ' || substr(commerce_id::text, 1, 4)
FROM public.display_media
WHERE commerce_id NOT IN (SELECT id FROM public.display_commerces)
ON CONFLICT (id) DO NOTHING;

-- 2. Actualizar Pantallas (devices)
ALTER TABLE public.display_devices DROP CONSTRAINT IF EXISTS display_devices_commerce_id_fkey;
ALTER TABLE public.display_devices ADD CONSTRAINT display_devices_commerce_id_fkey FOREIGN KEY (commerce_id) REFERENCES public.display_commerces(id) ON DELETE CASCADE;

-- 3. Actualizar Grupos (groups)
ALTER TABLE public.display_groups DROP CONSTRAINT IF EXISTS display_groups_commerce_id_fkey;
ALTER TABLE public.display_groups ADD CONSTRAINT display_groups_commerce_id_fkey FOREIGN KEY (commerce_id) REFERENCES public.display_commerces(id) ON DELETE CASCADE;

-- 4. Actualizar Campañas (campaigns)
ALTER TABLE public.display_campaigns DROP CONSTRAINT IF EXISTS display_campaigns_commerce_id_fkey;
ALTER TABLE public.display_campaigns ADD CONSTRAINT display_campaigns_commerce_id_fkey FOREIGN KEY (commerce_id) REFERENCES public.display_commerces(id) ON DELETE CASCADE;

-- 5. Actualizar Medios (media)
ALTER TABLE public.display_media DROP CONSTRAINT IF EXISTS display_media_commerce_id_fkey;
ALTER TABLE public.display_media ADD CONSTRAINT display_media_commerce_id_fkey FOREIGN KEY (commerce_id) REFERENCES public.display_commerces(id) ON DELETE CASCADE;
