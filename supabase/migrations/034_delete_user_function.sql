
-- Función segura para eliminar usuario (Auth y Profiles)
-- Solo ejecutable por super_admins (verificada en la lógica, aunqueSECURITY DEFINER la hace potente)
CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id UUID)
RETURNS VOID
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Verificar que quien ejecuta la función es super_admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'super_admin'
  ) THEN
    RAISE EXCEPTION 'No tienes permisos para realizar esta acción';
  END IF;

  -- 2. Eliminar de auth.users (el cascadeo eliminará profile, submissions, etc.)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;
