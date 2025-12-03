import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProviders, useEventProviders, useEventProvidersList } from "@/hooks/use-roles";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus, Users, Trash2 } from "lucide-react";

interface ProvidersManagementProps {
    eventId?: string;
}

/**
 * Componente para gestionar providers asignados a un evento
 * Solo visible para super_admin
 */
export const ProvidersManagement = ({ eventId }: ProvidersManagementProps) => {
    const { data: allProviders, isLoading: loadingProviders } = useProviders();
    const { data: assignedProviders, isLoading: loadingAssigned } = useEventProvidersList(eventId);
    const { assignProvider, removeProvider } = useEventProviders();
    const [selectedProvider, setSelectedProvider] = useState<string>("");

    const handleAssign = () => {
        if (!selectedProvider || !eventId) return;

        assignProvider.mutate(
            { eventId, providerId: selectedProvider },
            {
                onSuccess: () => {
                    toast.success("Provider asignado correctamente");
                    setSelectedProvider("");
                },
                onError: (error: any) => {
                    toast.error(error.message || "Error al asignar provider");
                },
            }
        );
    };

    const handleRemove = (providerId: string) => {
        if (!eventId) return;

        if (confirm("¿Desasignar este provider del evento?")) {
            removeProvider.mutate(
                { eventId, providerId },
                {
                    onSuccess: () => toast.success("Provider desasignado"),
                    onError: (error: any) => toast.error(error.message),
                }
            );
        }
    };

    // Filtrar providers ya asignados
    const availableProviders = allProviders?.filter(
        p => !assignedProviders?.some(ap => ap.provider_id === p.id)
    ) || [];

    if (!eventId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Gestión de Providers
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Selecciona un evento para gestionar sus providers.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (loadingProviders || loadingAssigned) {
        return <div>Cargando providers...</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Providers del Evento
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Asignar Nuevo Provider */}
                <div className="border rounded-lg p-4 bg-card/50">
                    <h3 className="font-medium mb-3 flex items-center gap-2">
                        <UserPlus className="w-4 h-4" />
                        Asignar Provider
                    </h3>
                    <div className="flex gap-2">
                        <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                            <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Seleccionar provider..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availableProviders.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">
                                        No hay providers disponibles
                                    </div>
                                ) : (
                                    availableProviders.map(provider => (
                                        <SelectItem key={provider.id} value={provider.id}>
                                            {provider.name || provider.email}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                        <Button
                            onClick={handleAssign}
                            disabled={!selectedProvider || assignProvider.isPending}
                        >
                            {assignProvider.isPending ? "Asignando..." : "Asignar"}
                        </Button>
                    </div>
                </div>

                {/* Lista de Providers Asignados */}
                <div>
                    <h3 className="font-medium mb-3">
                        Providers Asignados ({assignedProviders?.length || 0})
                    </h3>
                    {!assignedProviders || assignedProviders.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            No hay providers asignados a este evento.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {assignedProviders.map((ap: any) => (
                                <div
                                    key={ap.id}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-card/30"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {ap.provider?.name || ap.provider?.email}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Asignado: {new Date(ap.assigned_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => handleRemove(ap.provider_id)}
                                        disabled={removeProvider.isPending}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
