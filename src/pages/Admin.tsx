import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Clock } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings, useUpdateEventSettings, useUploadEventImage } from "@/hooks/use-event-settings";
import { Submission, SubmissionStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const Admin = () => {
    const { submissions, isLoading, updateStatus } = useSubmissions();
    const { data: settings, isLoading: settingsLoading } = useEventSettings();
    const updateSettings = useUpdateEventSettings();
    const uploadImage = useUploadEventImage();

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        display_template: "grid",
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                title: settings.title || "",
                description: settings.description || "",
                display_template: settings.display_template || "grid",
            });
        }
    }, [settings]);

    const handleModeration = (id: string, status: SubmissionStatus) => {
        updateStatus.mutate({ id, status });
    };

    const handleSettingsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        updateSettings.mutate({
            id: settings.id,
            ...formData,
        } as any, {
            onSuccess: () => toast.success("Configuración actualizada"),
            onError: () => toast.error("Error al actualizar la configuración"),
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !settings) return;

        try {
            const imageUrl = await uploadImage.mutateAsync(file);
            updateSettings.mutate({
                id: settings.id,
                background_image_url: imageUrl,
            } as any);
            toast.success("Imagen de fondo actualizada");
        } catch (error) {
            toast.error("Error al subir la imagen");
        }
    };

    const SubmissionCard = ({ item }: { item: Submission }) => (
        <Card className="overflow-hidden bg-card/50 backdrop-blur border-white/10">
            <div className="p-4">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs ${item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                        item.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                            'bg-red-500/20 text-red-500'
                        }`}>
                        {item.status.toUpperCase()}
                    </div>
                </div>

                {item.type === 'photo' ? (
                    <div className="aspect-video rounded-md overflow-hidden bg-black/20 mb-4">
                        <img src={item.content} alt="Submission" className="w-full h-full object-cover" />
                    </div>
                ) : (
                    <div className="bg-black/20 p-4 rounded-md mb-4">
                        <p className="text-lg">{item.content}</p>
                        {item.author && <p className="text-sm text-muted-foreground mt-2">- {item.author}</p>}
                    </div>
                )}

                {item.status === 'pending' && (
                    <div className="flex gap-2">
                        <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => handleModeration(item.id, 'approved')}
                        >
                            <Check className="w-4 h-4 mr-2" /> Aprobar
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1"
                            onClick={() => handleModeration(item.id, 'rejected')}
                        >
                            <X className="w-4 h-4 mr-2" /> Rechazar
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    if (isLoading || settingsLoading) {
        return <div className="min-h-screen flex items-center justify-center text-foreground">Cargando...</div>;
    }

    return (
        <div className="min-h-screen bg-background p-6">
            <header className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-serif text-primary">Panel de Administración</h1>
                <nav className="flex gap-4 items-center">
                    <NavLink to="/">Inicio</NavLink>
                    <NavLink to="/display">Pantalla</NavLink>
                    <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                        Salir
                    </Button>
                </nav>
            </header>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="pending">Pendientes ({submissions.filter(s => s.status === 'pending').length})</TabsTrigger>
                    <TabsTrigger value="approved">Aprobados ({submissions.filter(s => s.status === 'approved').length})</TabsTrigger>
                    <TabsTrigger value="rejected">Rechazados ({submissions.filter(s => s.status === 'rejected').length})</TabsTrigger>
                    <TabsTrigger value="settings">Configuración</TabsTrigger>
                </TabsList>

                {['pending', 'approved', 'rejected'].map((status) => (
                    <TabsContent key={status} value={status}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {submissions
                                .filter(item => item.status === status)
                                .map(item => (
                                    <SubmissionCard key={item.id} item={item} />
                                ))}
                        </div>
                    </TabsContent>
                ))}

                <TabsContent value="settings">
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader>
                            <CardTitle>Configuración del Evento</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSettingsSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Título del Evento</label>
                                    <Input
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ej: Boda de Ana y Juan"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Descripción</label>
                                    <Textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Una breve descripción para tus invitados"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Plantilla de Visualización</label>
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.display_template}
                                        onChange={(e) => setFormData({ ...formData, display_template: e.target.value })}
                                    >
                                        <option value="grid">Cuadrícula (Grid)</option>
                                        <option value="slideshow">Presentación (Slideshow)</option>
                                        <option value="masonry">Mosaico (Masonry)</option>
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Imagen de Fondo</label>
                                    <div className="flex items-center gap-4">
                                        {settings?.background_image_url && (
                                            <img
                                                src={settings.background_image_url}
                                                alt="Background"
                                                className="w-20 h-20 object-cover rounded-md"
                                            />
                                        )}
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full">
                                    Guardar Cambios
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Admin;
