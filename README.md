# EventPix 📸

EventPix es una aplicación web interactiva para eventos especiales donde los asistentes pueden compartir fotos y mensajes en tiempo real.

## Características

- **Landing Page**: Interfaz elegante para subir fotos y mensajes.
- **Panel de Administración**: Moderación en tiempo real (Aprobar/Rechazar contenido).
- **Pantalla de Visualización**: Carrusel automático de contenido aprobado para proyectar en el evento.
- **Modo Híbrido**: Funciona con datos de prueba (Mock) si no hay backend configurado, o con Supabase para persistencia real.

## Configuración del Backend (Supabase)

Para activar la funcionalidad completa (persistencia, subida de fotos real, autenticación):

1.  **Crear Proyecto en Supabase**:
    - Ve a [supabase.com](https://supabase.com) y crea un nuevo proyecto.

2.  **Configurar Base de Datos**:
    - Ve al "SQL Editor" en tu dashboard de Supabase.
    - Copia el contenido del archivo `supabase/schema.sql` de este proyecto.
    - Ejecuta el script para crear las tablas y políticas de seguridad.

3.  **Configurar Variables de Entorno**:
    - Renombra el archivo `.env.example` a `.env`.
    - Copia la `Project URL` y `anon public key` de los ajustes de tu proyecto en Supabase.
    - Pégalos en el archivo `.env`:
      ```env
      VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
      VITE_SUPABASE_ANON_KEY=tu-anon-key-larga
      ```

4.  **Crear Usuario Admin**:
    - Ve a "Authentication" > "Users" en Supabase.
    - Crea un nuevo usuario con email y contraseña.
    - Usa estas credenciales para iniciar sesión en `/login`.

## Ejecución Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

## Estructura

- `/` - Landing page para invitados
- `/login` - Acceso para moderadores
- `/admin` - Panel de moderación (requiere login)
- `/display` - Pantalla de proyección (solo muestra contenido aprobado)
