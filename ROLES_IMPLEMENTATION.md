# 🎯 Sistema de Roles y Permisos - EventPix

## ✅ Resumen de Implementación

He implementado un sistema completo de roles y permisos para EventPix con **3 niveles de acceso**:

### 🔐 Roles Implementados

1. **Super Administrador** (`super_admin`)
   - Acceso total a toda la base de datos
   - Gestiona eventos, providers y asignaciones
   - Ve y modera todas las fotos/mensajes

2. **Proveedor** (`provider`)
   - Solo ve eventos asignados a él
   - Modera fotos/mensajes de sus eventos
   - No puede ver eventos de otros

3. **Invitado** (sin autenticación)
   - Sube fotos/mensajes desde un link/QR
   - Sin acceso a paneles de administración

---

## 📦 Archivos Creados

### 1. Migración SQL
📄 `supabase/migrations/004_roles_and_permissions.sql`
- ✅ Tabla `profiles` con roles
- ✅ Tabla `event_providers` (relación muchos a muchos)
- ✅ Políticas RLS completas para todas las tablas
- ✅ Funciones helpers para verificar permisos
- ✅ Trigger automático para crear perfiles

### 2. Tipos TypeScript
📄 `src/types/index.ts`
- ✅ `UserRole`, `Profile`, `Event`, `EventProvider`
- ✅ Tipos actualizados para `Submission`

### 3. Hooks React Query
📄 `src/hooks/use-roles.ts`
- ✅ `useUserProfile()` - Obtener perfil y rol actual
- ✅ `useIsSuperAdmin()` - Verificar si es super admin
- ✅ `useProviders()` - Lista de todos los providers
- ✅ `useEventProviders()` - Asignar/desasignar providers
- ✅ `useEventProvidersList()` - Ver providers de un evento
- ✅ `useHasEventAccess()` - Verificar acceso a evento
- ✅ `useCreateProvider()` - Crear nuevo provider

### 4. Componentes
📄 `src/components/ProvidersManagement.tsx`
- ✅ Gestión visual de providers por evento
- ✅ Asignar/desasignar providers
- ✅ Lista de providers asignados

📄 `src/components/ui/select.tsx`
- ✅ Componente Select para formularios

### 5. Documentación
📄 `ROLES_GUIDE.md`
- ✅ Guía completa con ejemplos de código
- ✅ 6 casos de uso documentados
- ✅ Estructura sugerida de paneles

---

## 🚀 Pasos para Activar

### 1. Aplicar Migración en Supabase

```bash
# Opción A: Desde Supabase Dashboard
# 1. Ve a tu proyecto Supabase
# 2. SQL Editor
# 3. Copia y pega el contenido de:
#    supabase/migrations/004_roles_and_permissions.sql
# 4. Ejecuta
```

### 2. Crear tu Primer Super Admin

Ejecuta esto en Supabase SQL Editor reemplazando con tu email:

```sql
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'tu-email@ejemplo.com';
```

### 3. Instalar Dependencias Necesarias

```bash
npm install @radix-ui/react-select
```

---

## 📋 Cómo Usar

### Detectar Rol del Usuario

```typescript
import { useUserProfile, useIsSuperAdmin } from "@/hooks/use-roles";

function MyComponent() {
    const { data: profile } = useUserProfile();
    const isSuperAdmin = useIsSuperAdmin();

    return (
        <div>
            {isSuperAdmin && <p>Eres Super Admin</p>}
            <p>Rol: {profile?.role}</p>
        </div>
    );
}
```

### Listar Eventos del Provider

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// Opción 1: Con función SQL
const { data: events } = useQuery({
    queryKey: ["provider-events"],
    queryFn: async () => {
        const { data } = await supabase.rpc("get_provider_events");
        return data;
    },
});

// Opción 2: Con JOIN
const { data: events } = useQuery({
    queryKey: ["provider-events"],
    queryFn: async () => {
        const { data } = await supabase
            .from("event_providers")
            .select("event:events(*)");
        return data?.map(item => item.event);
    },
});
```

### Aprobar una Foto

```typescript
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const approve = useMutation({
    mutationFn: async (submissionId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data } = await supabase
            .from("submissions")
            .update({
                status: "approved",
                moderated_by: user?.id,
                moderated_at: new Date().toISOString(),
            })
            .eq("id", submissionId)
            .select()
            .single();
        
        return data;
    },
});

// Uso
<button onClick={() => approve.mutate(photoId)}>
    Aprobar
</button>
```

### Aprobar Todas las Pendientes

```typescript
const approveAll = useMutation({
    mutationFn: async (eventId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data } = await supabase
            .from("submissions")
            .update({
                status: "approved",
                moderated_by: user?.id,
                moderated_at: new Date().toISOString(),
            })
            .eq("event_id", eventId)
            .eq("status", "pending")
            .select();
        
        return data;
    },
});
```

### Asignar Provider a Evento

```typescript
import { useEventProviders } from "@/hooks/use-roles";

function AssignProvider({ eventId }) {
    const { assignProvider } = useEventProviders();

    return (
        <button onClick={() => 
            assignProvider.mutate({ eventId, providerId })
        }>
            Asignar
        </button>
    );
}
```

---

## 🔒 Seguridad - RLS Activado

### Tabla `profiles`
- ✅ Super admin ve todos
- ✅ Cada usuario ve solo su perfil
- ✅ Solo super admin puede crear/editar otros perfiles

### Tabla `events`
- ✅ Super admin ve/edita todos
- ✅ Provider ve/edita solo eventos asignados
- ✅ Provider puede crear eventos (autoasignado)

### Tabla `event_providers`
- ✅ Solo super admin puede asignar/desasignar
- ✅ Providers ven sus propias asignaciones

### Tabla `submissions`
- ✅ Super admin ve/modera todas
- ✅ Provider ve/modera solo de sus eventos
- ✅ Invitados pueden crear (INSERT público)

---

## 🎨 Estructura de Paneles

### Panel Super Admin (`/admin`)
```
Dashboard
├── Eventos
│   ├── Lista completa
│   ├── Crear evento
│   ├── Editar evento
│   └── Asignar providers  ← Nuevo
├── Providers              ← Nuevo
│   ├── Lista
│   ├── Crear provider
│   └── Ver asignaciones
└── Moderación Global
```

### Panel Provider (`/provider`)
```
Mis Eventos
├── Lista de eventos asignados
└── [event-id]
    ├── Fotos Pendientes
    ├── Fotos Aprobadas
    ├── Mensajes
    ├── Botón "Aprobar Todo"
    └── Configuración
```

---

## ⚡ Funciones SQL Útiles

### `is_super_admin()`
Verifica si el usuario actual es super admin
```sql
SELECT is_super_admin();
```

### `has_event_access(event_id)`
Verifica si el usuario tiene acceso a un evento
```sql
SELECT has_event_access('event-uuid-here');
```

### `get_provider_events(provider_id)`
Obtiene todos los eventos de un provider
```sql
SELECT * FROM get_provider_events();
```

---

## 📚 Documentación Adicional

Para más ejemplos y detalles, consulta:
- 📖 **ROLES_GUIDE.md** - Guía completa con código
- 🗃️ **004_roles_and_permissions.sql** - Migración SQL completa

---

## ✨ Próximos Pasos Sugeridos

1. ✅ Aplicar la migración SQL
2. ✅ Crear tu super_admin
3. 🔄 Adaptar tu `Admin.tsx` para detectar rol y mostrar opciones según permisos
4. 🔄 Crear página `/super-admin` con gestión de providers
5. 🔄 Crear página `/provider` con solo eventos asignados
6. 🔄 Agregar componente `ProvidersManagement` en el panel de cada evento

---

## 🛠️ Troubleshooting

### "No puedo ver eventos"
- Verifica que estés asignado al evento en `event_providers`
- Super admin ve todo automáticamente

### "Error de permisos al insertar"
- RLS está activo, verifica las políticas
- Invitados pueden INSERT en `submissions` sin auth

### "Cómo crear providers"
```typescript
import { useCreateProvider } from "@/hooks/use-roles";

const create = useCreateProvider();
create.mutate({
    email: "provider@example.com",
    name: "Nombre Provider",
    password: "password123"
});
```

---

¿Necesitás ayuda implementando alguna parte específica? 🚀
