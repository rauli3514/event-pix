import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Clock, Trash2, Download, RefreshCw, Zap, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings, useUpdateEventSettings, useUploadEventImage } from "@/hooks/use-event-settings";
import { Submission, SubmissionStatus } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { supabase } from "@/lib/supabase";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Switch } from "@/components/ui/switch";

import { useEvent } from "@/context/EventContext";
import { Link } from "react-router-dom";

const Admin = () => {
    const { event, isLoading: eventLoading } = useEvent();
    const { submissions, isLoading, updateStatus, deleteSubmission, deleteAllApproved, resetAll, approveAllPending } = useSubmissions(event?.id);
    const { data: settings, isLoading: settingsLoading } = useEventSettings(event?.id);
    const updateSettings = useUpdateEventSettings(event?.id);
    const uploadImage = useUploadEventImage();

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        display_template: "grid",
        text_messages_enabled: true,
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                title: settings.title || "",
                description: settings.description || "",
                display_template: settings.display_template || "grid",
                text_messages_enabled: settings.text_messages_enabled ?? true,
            });
        }
    }, [settings]);

    const handleModeration = (id: string, status: SubmissionStatus) => {
        updateStatus.mutate({ id, status });
    };

    const handleApproveAll = () => {
        if (confirm("¿Seguro que querés aprobar todos los mensajes y fotos pendientes de este evento? Esta acción no se puede deshacer.")) {
            approveAllPending.mutate();
        }
    };

    const handleDelete = (id: string) => {
        if (confirm("¿Estás seguro de eliminar esta foto permanentemente?")) {
            deleteSubmission.mutate(id);
        }
    };

    const handleDownloadApprovedPhotos = async () => {
        const photos = submissions.filter(s => s.status === 'approved' && s.type === 'photo');
        if (photos.length === 0) {
            toast.error("No hay fotos aprobadas para descargar");
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder("fotos-eventpix");
        const downloadToast = toast.loading(`Generando ZIP con ${photos.length} fotos...`);

        try {
            const promises = photos.map(async (photo, index) => {
                try {
                    const response = await fetch(photo.content);
                    const blob = await response.blob();
                    const extension = photo.content.split('.').pop()?.split('?')[0] || 'jpg';
                    folder?.file(`foto-${index + 1}.${extension}`, blob);
                } catch (e) {
                    console.error("Error downloading photo", e);
                }
            });

            await Promise.all(promises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "fotos-eventpix.zip");
            toast.dismiss(downloadToast);
            toast.success("Fotos descargadas");
        } catch (error) {
            console.error(error);
            toast.dismiss(downloadToast);
            toast.error("Error al generar el ZIP");
        }
    };

    const handleDownloadApprovedMessages = () => {
        const messages = submissions.filter(s => s.status === 'approved' && s.type === 'message');
        if (messages.length === 0) {
            toast.error("No hay mensajes aprobados");
            return;
        }

        let textContent = "MENSAJES DEL EVENTO\n===================\n\n";
        messages.forEach((msg, i) => {
            const date = new Date(msg.created_at).toLocaleString();
            textContent += `${i + 1}. DE: ${msg.author || 'Anónimo'} (${date})\n`;
            textContent += `   "${msg.content}"\n\n`;
        });

        const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
        saveAs(blob, "mensajes-eventpix.txt");
        toast.success("Mensajes descargados");
    };

    const handleClearApproved = () => {
        if (confirm("¿Estás seguro de ELIMINAR todo el contenido aprobado? Asegúrate de haberlo descargado primero.")) {
            deleteAllApproved.mutate();
        }
    };

    const handleResetAll = () => {
        const confirmText = prompt("Escribe 'BORRAR TODO' para confirmar que deseas eliminar TODAS las fotos y mensajes.");
        if (confirmText === 'BORRAR TODO') {
            resetAll.mutate();
        }
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'background_image_url' | 'display_background_url') => {
        const file = e.target.files?.[0];
        if (!file || !settings) return;

        try {
            const imageUrl = await uploadImage.mutateAsync(file);
            updateSettings.mutate({
                id: settings.id,
                [field]: imageUrl,
            } as any);
            toast.success("Imagen actualizada correctamente");
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
                    <div className={`px-2 py-1 rounded-full text-xs flex items-center ${item.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                        item.status === 'approved' ? 'bg-green-500/20 text-green-500' :
                            'bg-red-500/20 text-red-500'
                        }`}>
                        {item.status.toUpperCase()}
                    </div>
                </div>

                {item.type === 'photo' ? (
                    <div className="aspect-video rounded-md overflow-hidden bg-black/20 mb-4 relative group">
                        <img src={item.content} alt="Submission" className="w-full h-full object-cover" />
                        {item.status === 'approved' && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
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

    const simulateParty = async () => {
        if (!confirm("Esto generará 50 interacciones simuladas (APROBADAS) para probar el Wall. ¿Continuar?")) return;

        const toastId = toast.loading("Simulando fiesta... (0/50)");

        const MESSAGES = [
            "¡Qué gran fiesta!", "¡Vivan los novios!", "La comida está deliciosa",
            "¡Qué buena música!", "Saludos desde la mesa 5", "¡Felicidades!",
            "Pasándola genial", "¡Foto pal face!", "¡Salud!", "Bailando hasta el amanecer",
            "¡El DJ la rompe!", "¡Qué viva el amor!", "Mesa 8 presente", "¡Fiestón!"
        ];

        const PHOTOS = [
            "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1511285560982-1351cdeb9821?auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1520854221256-17451cc330e7?auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1530103862676-de3c9a59af57?auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80",
            "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&q=80"
        ];

        let count = 0;
        const total = 50;

        const interval = setInterval(async () => {
            if (count >= total) {
                clearInterval(interval);
                toast.dismiss(toastId);
                toast.success("Simulación completada");
                return;
            }

            const type = Math.random() > 0.6 ? 'photo' : 'message'; // 60% fotos
            const content = type === 'photo'
                ? PHOTOS[Math.floor(Math.random() * PHOTOS.length)]
                : MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

            await supabase.from('submissions').insert([{
                type,
                content,
                author: `Simulado ${count + 1}`,
                status: 'approved', // Directo al wall para probar carga
                created_at: new Date().toISOString(),
                event_id: event?.id // Importante: Asociar al evento actual
            }]);

            count++;
            toast.loading(`Simulando fiesta... (${count}/${total})`, { id: toastId });
        }, 200); // 5 por segundo
    };

    if (eventLoading || isLoading || settingsLoading) {
        return <div className="min-h-screen flex items-center justify-center text-foreground">Cargando...</div>;
    }

    if (!event) return <div className="min-h-screen flex items-center justify-center text-foreground">Evento no encontrado</div>;

    return (
        <div className="min-h-screen bg-background p-6">
            <header className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                    <Link to="/admin" className="text-muted-foreground hover:text-primary transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-serif text-primary">Panel de Administración</h1>
                        <p className="text-sm text-muted-foreground font-medium">{event.name}</p>
                    </div>
                </div>
                <nav className="flex gap-4 items-center">
                    <a href={`/${event.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">Ver Web</a>
                    <a href={`/${event.slug}/display`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">Ver Pantalla</a>
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

                <TabsContent value="pending">
                    {/* Approve All button - Only shown if there are pending items */}
                    {submissions.filter(s => s.status === 'pending').length > 0 && (
                        <div className="mb-6 flex items-center justify-center bg-card/50 p-4 rounded-xl border border-white/10">
                            <Button
                                onClick={handleApproveAll}
                                className="bg-green-600 hover:bg-green-700"
                                disabled={approveAllPending.isPending}
                            >
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                {approveAllPending.isPending ? "Aprobando..." : "Aprobar Todo lo Pendiente"}
                            </Button>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {submissions
                            .filter(item => item.status === 'pending')
                            .map(item => (
                                <SubmissionCard key={item.id} item={item} />
                            ))}
                        {submissions.filter(s => s.status === 'pending').length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                No hay contenido pendiente.
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="approved">
                    <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-white/10">
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={handleDownloadApprovedPhotos} className="bg-blue-600 hover:bg-blue-700">
                                <Download className="w-4 h-4 mr-2" /> Descargar Fotos (ZIP)
                            </Button>
                            <Button onClick={handleDownloadApprovedMessages} variant="secondary">
                                <Download className="w-4 h-4 mr-2" /> Descargar Mensajes (TXT)
                            </Button>
                        </div>
                        <Button onClick={handleClearApproved} variant="destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Vaciar Aprobados
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {submissions
                            .filter(item => item.status === 'approved')
                            .map(item => (
                                <SubmissionCard key={item.id} item={item} />
                            ))}
                        {submissions.filter(s => s.status === 'approved').length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                No hay contenido aprobado.
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="rejected">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {submissions
                            .filter(item => item.status === 'rejected')
                            .map(item => (
                                <SubmissionCard key={item.id} item={item} />
                            ))}
                        {submissions.filter(s => s.status === 'rejected').length === 0 && (
                            <div className="col-span-full text-center py-12 text-muted-foreground">
                                No hay contenido rechazado.
                            </div>
                        )}
                    </div>
                </TabsContent>

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

                                <div className="flex items-center justify-between rounded-lg border p-4 bg-card/50">
                                    <div className="space-y-0.5">
                                        <label className="text-base font-medium">Permitir mensajes de texto</label>
                                        <p className="text-sm text-muted-foreground">
                                            Si se desactiva, los invitados solo podrán subir fotos.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={formData.text_messages_enabled}
                                        onCheckedChange={(checked) => setFormData({ ...formData, text_messages_enabled: checked })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Imagen de Fondo (Inicio)</label>
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
                                            onChange={(e) => handleImageUpload(e, 'background_image_url')}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Imagen de Fondo (Pantalla/Proyector)</label>
                                    <div className="flex items-center gap-4">
                                        {settings?.display_background_url && (
                                            <img
                                                src={settings.display_background_url}
                                                alt="Display Background"
                                                className="w-20 h-20 object-cover rounded-md"
                                            />
                                        )}
                                        <Input
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, 'display_background_url')}
                                            className="cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <Button type="submit" className="w-full">
                                    Guardar Cambios
                                </Button>

                                <div className="pt-8 border-t mt-8">
                                    <h3 className="text-blue-400 font-medium mb-4">Herramientas de Prueba</h3>
                                    <Button type="button" variant="outline" className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10" onClick={simulateParty}>
                                        <Zap className="w-4 h-4 mr-2" /> ⚡ SIMULAR FIESTA (Stress Test)
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Genera 50 fotos y mensajes automáticamente para probar el rendimiento.
                                    </p>
                                </div>

                                <div className="pt-8 border-t mt-8">
                                    <h3 className="text-destructive font-medium mb-4">Zona de Peligro</h3>
                                    <Button type="button" variant="destructive" className="w-full" onClick={handleResetAll}>
                                        <RefreshCw className="w-4 h-4 mr-2" /> RESETEAR TODO EL EVENTO
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Esto eliminará todas las fotos y mensajes permanentemente.
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default Admin;
