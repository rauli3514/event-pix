# 📚 Guía de Uso - Sistema de Roles EventPix

## 🎯 Índice
1. [Detectar Rol del Usuario](#detectar-rol)
2. [Listar Eventos del Provider](#listar-eventos-provider)
3. [Aprobar una Foto](#aprobar-foto)
4. [Aprobar Todas las Fotos Pendientes](#aprobar-todas)
5. [Asignar Provider a Evento](#asignar-provider)
6. [Crear Nuevo Provider](#crear-provider)

---

## 1. Detectar Rol del Usuario {#detectar-rol}

```typescript
import { useUserProfile, useIsSuperAdmin } from "@/hooks/use-roles";

function MyComponent() {
    const { data: profile, isLoading } = useUserProfile();
    const isSuperAdmin = useIsSuperAdmin();

    if (isLoading) return <div>Cargando...</div>;

    if (!profile) {
        return <div>No autenticado</div>;
    }

    return (
        <div>
            <p>Usuario: {profile.name || profile.email}</p>
            <p>Rol: {profile.role}</p>
            {isSuperAdmin && <p>✅ Eres Super Admin</p>}
        </div>
    );
}
```

---

## 2. Listar Eventos del Provider {#listar-eventos-provider}

### Opción A: Usando función SQL personalizada

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useProviderEvents = () => {
    return useQuery({
        queryKey: ["provider-events"],
        queryFn: async () => {
            // Usa la función SQL get_provider_events()
            const { data, error } = await supabase
                .rpc("get_provider_events");

            if (error) throw error;
            return data;
        },
    });
};

// Uso en componente
function ProviderDashboard() {
    const { data: events, isLoading } = useProviderEvents();

    if (isLoading) return <div>Cargando eventos...</div>;

    return (
        <ul>
            {events?.map(event => (
                <li key={event.id}>
                    {event.name} - {event.location}
                </li>
            ))}
        </ul>
    );
}
```

### Opción B: Query directa con JOIN

```typescript
export const useProviderEventsAlt = () => {
    return useQuery({
        queryKey: ["provider-events-alt"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("event_providers")
                .select(`
                    event:events(*)
                `)
                .order("assigned_at", { ascending: false });

            if (error) throw error;
            
            // Extraer solo los eventos
            return data.map(item => item.event);
        },
    });
};
```

---

## 3. Aprobar una Foto {#aprobar-foto}

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const useApproveSubmission = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (submissionId: string) => {
            const { data: { user } } = await supabase.auth.getUser();

            const { data, error } = await supabase
                .from("submissions")
                .update({
                    status: "approved",
                    moderated_by: user?.id,
                    moderated_at: new Date().toISOString(),
                })
                .eq("id", submissionId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            toast.success("Foto aprobada");
            queryClient.invalidateQueries({ queryKey: ["submissions"] });
        },
        onError: (error) => {
            toast.error("Error al aprobar: " + error.message);
        },
    });
};

// Uso en componente
function SubmissionCard({ submission }) {
    const approve = useApproveSubmission();

    return (
        <div>
            <img src={submission.content} alt="Submission" />
            <button 
                onClick={() => approve.mutate(submission.id)}
                disabled={approve.isPending}
            >
                {approve.isPending ? "Aprobando..." : "Aprobar"}
            </button>
        </div>
    );
}
```

---

## 4. Aprobar Todas las Fotos Pendientes {#aprobar-todas}

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const useApproveAllPending = (eventId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();

            // Aprobar todas las submissions pendientes del evento
            const { data, error } = await supabase
                .from("submissions")
                .update({
                    status: "approved",
                    moderated_by: user?.id,
                    moderated_at: new Date().toISOString(),
                })
                .eq("event_id", eventId)
                .eq("status", "pending")
                .select();

            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast.success(`${data.length} fotos aprobadas`);
            queryClient.invalidateQueries({ queryKey: ["submissions"] });
        },
        onError: (error) => {
            toast.error("Error: " + error.message);
        },
    });
};

// Uso en componente
function EventModerationPanel({ eventId }) {
    const approveAll = useApproveAllPending(eventId);

    return (
        <button
            onClick={() => {
                if (confirm("¿Aprobar todas las fotos pendientes?")) {
                    approveAll.mutate();
                }
            }}
            disabled={approveAll.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded"
        >
            {approveAll.isPending ? "Aprobando..." : "Aprobar Todas"}
        </button>
    );
}
```

---

## 5. Asignar Provider a Evento {#asignar-provider}

```typescript
import { useEventProviders } from "@/hooks/use-roles";
import { toast } from "sonner";

function AssignProviderPanel({ eventId }) {
    const { assignProvider, removeProvider } = useEventProviders();
    const [selectedProviderId, setSelectedProviderId] = useState("");
    const { data: providers } = useProviders();

    const handleAssign = () => {
        assignProvider.mutate(
            { eventId, providerId: selectedProviderId },
            {
                onSuccess: () => toast.success("Provider asignado"),
                onError: (error) => toast.error("Error: " + error.message),
            }
        );
    };

    const handleRemove = (providerId: string) => {
        if (confirm("¿Desasignar este provider?")) {
            removeProvider.mutate(
                { eventId, providerId },
                {
                    onSuccess: () => toast.success("Provider desasignado"),
                }
            );
        }
    };

    return (
        <div>
            <select 
                value={selectedProviderId}
                onChange={(e) => setSelectedProviderId(e.target.value)}
            >
                <option value="">Seleccionar provider...</option>
                {providers?.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.name || p.email}
                    </option>
                ))}
            </select>
            <button onClick={handleAssign}>
                Asignar
            </button>
        </div>
    );
}
```

---

## 6. Crear Nuevo Provider {#crear-provider}

```typescript
import { useCreateProvider } from "@/hooks/use-roles";
import { useState } from "react";
import { toast } from "sonner";

function CreateProviderForm() {
    const createProvider = useCreateProvider();
    const [formData, setFormData] = useState({
        email: "",
        name: "",
        password: "",
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        createProvider.mutate(formData, {
            onSuccess: () => {
                toast.success("Provider creado exitosamente");
                setFormData({ email: "", name: "", password: "" });
            },
            onError: (error) => {
                toast.error("Error: " + error.message);
            },
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
            />
            <input
                type="text"
                placeholder="Nombre"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <input
                type="password"
                placeholder="Contraseña"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
            />
            <button 
                type="submit"
                disabled={createProvider.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded"
            >
                {createProvider.isPending ? "Creando..." : "Crear Provider"}
            </button>
        </form>
    );
}
```

---

## 🔐 Verificación de Permisos en Componentes

### Componente Protegido por Rol

```typescript
import { useIsSuperAdmin } from "@/hooks/use-roles";
import { Navigate } from "react-router-dom";

function SuperAdminOnlyPage() {
    const isSuperAdmin = useIsSuperAdmin();

    if (!isSuperAdmin) {
        return <Navigate to="/unauthorized" />;
    }

    return (
        <div>
            <h1>Panel Super Admin</h1>
            {/* Contenido solo para super admin */}
        </div>
    );
}
```

### Renderizado Condicional

```typescript
function EventActions({ eventId }) {
    const isSuperAdmin = useIsSuperAdmin();
    const { hasAccess } = useHasEventAccess(eventId);

    return (
        <div>
            {(isSuperAdmin || hasAccess) && (
                <button>Editar Evento</button>
            )}
            
            {isSuperAdmin && (
                <button>Eliminar Evento</button>
            )}
        </div>
    );
}
```

---

## 📊 Estructura de Paneles Sugerida

### Panel Super Admin
```
/admin
├── Dashboard
├── Eventos
│   ├── Lista de todos los eventos
│   ├── Crear evento
│   ├── Editar evento
│   └── Asignar providers
├── Providers
│   ├── Lista de providers
│   ├── Crear provider
│   └── Editar provider
└── Configuración Global
```

### Panel Provider
```
/provider
├── Mis Eventos
│   └── [event-id]
│       ├── Fotos Pendientes
│       ├── Fotos Aprobadas
│       ├── Mensajes
│       └── Configuración del evento
└── Mi Perfil
```

---

## ⚠️ Notas Importantes

1. **Primer Super Admin**: Después de ejecutar la migración, ejecuta esto en Supabase SQL Editor:
```sql
UPDATE profiles 
SET role = 'super_admin' 
WHERE email = 'tu-email@ejemplo.com';
```

2. **RLS está activado**: Todas las queries respetan automáticamente los permisos.

3. **Invitados sin cuenta**: Pueden subir fotos sin autenticación gracias a la política "Invitados pueden crear submissions".

4. **Moderación**: Todas las fotos/mensajes quedan `pending` hasta que un provider o super_admin las apruebe.
