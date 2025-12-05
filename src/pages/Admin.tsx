import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, X, Clock, Trash2, Download, Zap, ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { jsPDF } from "jspdf";

import { useEvent } from "@/context/EventContext";
import { Link } from "react-router-dom";
import { useUserProfile, useIsSuperAdmin } from "@/hooks/use-roles";
import { ProvidersManagement } from "@/components/ProvidersManagement";
import { PhotoBoothModal } from "@/components/PhotoBoothModal";

const Admin = () => {
    const { event, isLoading: eventLoading } = useEvent();
    const { submissions, isLoading, updateStatus, deleteSubmission, deleteAllApproved, resetAll, approveAllPending } = useSubmissions(event?.id);
    const { data: settings, isLoading: settingsLoading } = useEventSettings(event?.id);
    const updateSettings = useUpdateEventSettings(event?.id);
    const uploadImage = useUploadEventImage();
    const [testPhotoBoothOpen, setTestPhotoBoothOpen] = useState(false);

    // Sistema de roles
    const { data: userProfile } = useUserProfile();
    const isSuperAdmin = useIsSuperAdmin();

    // Filtrar contenido
    const approvedMessages = submissions?.filter(s => s.type === 'message' && s.status === 'approved') || [];

    // Función para generar PDF de mensajes
    const downloadMessagesPDF = () => {
        if (approvedMessages.length === 0) {
            toast.error("No hay mensajes aprobados para descargar");
            return;
        }

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 20;
        let y = 20;

        // Título del Evento
        doc.setFontSize(24);
        doc.setTextColor(33, 33, 33);
        doc.text(event?.name || "Libro de Firmas", pageWidth / 2, y, { align: "center" });
        y += 10;

        // Subtítulo / Fecha
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100);
        const dateStr = event?.date ? new Date(event.date).toLocaleDateString() : new Date().toLocaleDateString();
        doc.text(`EventPix - ${dateStr}`, pageWidth / 2, y, { align: "center" });
        y += 20;

        // Línea separadora
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 15;

        // Mensajes
        doc.setFontSize(12);

        approvedMessages.forEach((msg) => {
            // Verificar si necesitamos nueva página
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            // Fondo de la tarjeta (gris muy suave)
            doc.setFillColor(250, 250, 250);
            doc.setDrawColor(230, 230, 230);

            // Calcular altura del texto
            const textLines = doc.splitTextToSize(msg.content, pageWidth - (margin * 2) - 10);
            const cardHeight = (textLines.length * 7) + 20;

            // Dibujar tarjeta
            doc.roundedRect(margin, y, pageWidth - (margin * 2), cardHeight, 3, 3, 'FD');

            // Texto del mensaje
            doc.setTextColor(50, 50, 50);
            doc.setFont("helvetica", "normal");
            doc.text(textLines, margin + 5, y + 10);

            // Autor
            if (msg.author) {
                doc.setFont("helvetica", "bold");
                doc.setTextColor(100, 100, 100);
                doc.setFontSize(10);
                doc.text(`- ${msg.author}`, pageWidth - margin - 10, y + cardHeight - 7, { align: "right" });
                doc.setFontSize(12); // Restaurar tamaño
            }

            y += cardHeight + 10;
        });

        // Pie de página
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount} - Generado por EventPix`, pageWidth / 2, 290, { align: "center" });
        }

        doc.save(`Libro_Firmas_${event?.slug || 'evento'}.pdf`);
        toast.success("Libro de firmas descargado correctamente");
    };

    const [formData, setFormData] = useState({
        title: "",
        description: "",
        display_template: "grid",
        text_messages_enabled: true,
        carousel_max_loops: 3,
        carousel_interval_ms: 5000,
        wall_show_controls: true,
    });

    useEffect(() => {
        if (settings) {
            setFormData({
                title: settings.title || "",
                description: settings.description || "",
                display_template: settings.display_template || "grid",
                text_messages_enabled: settings.text_messages_enabled ?? true,
                carousel_max_loops: settings.carousel_max_loops ?? 3,
                carousel_interval_ms: settings.carousel_interval_ms ?? 5000,
                wall_show_controls: settings.wall_show_controls ?? true,
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



    const handleClearApproved = () => {
        if (confirm("¿Estás seguro de ELIMINAR todo el contenido aprobado? Asegúrate de haberlo descargado primero.")) {
            deleteAllApproved.mutate();
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

    const handleImageUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        field: 'background_image_url' | 'display_background_url' | 'frame_image_url' | 'splash_logo_url' | 'photobooth_frame_url'
    ) => {
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

    const triggerDjEffect = async (effect: string) => {
        if (!event?.id) return;

        // Usar Broadcast para enviar el efecto instantáneamente
        const channel = supabase.channel('dj-effects');

        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'dj-effect',
                    payload: { effect, eventId: event.id }
                });
                // Desconectar después de enviar para no dejar canales abiertos
                supabase.removeChannel(channel);
                toast.success(`Efecto lanzado: ${effect} 🚀`);
            }
        });
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
                    <div className="rounded-md overflow-hidden bg-black/20 mb-4 relative group min-h-64 max-h-96 flex items-center justify-center">
                        <img src={item.content} alt="Submission" className="w-full h-auto max-h-96 object-contain" />
                        {item.status === 'approved' && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-black/20 p-4 rounded-md mb-4 relative group">
                        <p className="text-lg">{item.content}</p>
                        {item.author && <p className="text-sm text-muted-foreground mt-2">- {item.author}</p>}

                        {item.status === 'approved' && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(item.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        )}
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
                    {userProfile && (
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${isSuperAdmin
                            ? 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                            {isSuperAdmin ? '👑 Super Admin' : '🎯 Provider'}
                        </div>
                    )}
                    <a href={`/${event.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">Ver Web</a>
                    <a href={`/${event.slug}/display`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">Ver Pantalla</a>
                    <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground hover:text-destructive">
                        Salir
                    </Button>
                </nav>
            </header>

            <Tabs defaultValue="pending" className="w-full">
                <TabsList className={`grid w-full mb-8 ${isSuperAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
                    <TabsTrigger value="pending">Pendientes ({submissions.filter(s => s.status === 'pending').length})</TabsTrigger>
                    <TabsTrigger value="approved">Aprobados ({submissions.filter(s => s.status === 'approved').length})</TabsTrigger>
                    <TabsTrigger value="rejected">Rechazados ({submissions.filter(s => s.status === 'rejected').length})</TabsTrigger>
                    <TabsTrigger value="settings">Configuración</TabsTrigger>
                    {isSuperAdmin && <TabsTrigger value="access">Acceso</TabsTrigger>}
                </TabsList>

                <TabsContent value="pending">

                    {/* ========== DJ CONTROL PANEL ========== */}
                    {settings?.dj_mode_enabled && (
                        <Card className="border-amber-500/50 bg-amber-500/5 shadow-lg animate-in fade-in slide-in-from-top-4 mb-6">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-amber-600 flex items-center gap-2 text-lg">
                                    <Zap className="w-5 h-5 fill-amber-500" /> Panel de Control DJ
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <Button
                                        variant="outline"
                                        className="h-20 flex flex-col gap-2 border-red-200 hover:bg-red-50 hover:border-red-500 transition-all"
                                        onClick={() => triggerDjEffect('siren')}
                                    >
                                        <span className="text-2xl">🚨</span>
                                        <span className="font-bold text-red-600">Alerta</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-20 flex flex-col gap-2 border-pink-200 hover:bg-pink-50 hover:border-pink-500 transition-all"
                                        onClick={() => triggerDjEffect('love')}
                                    >
                                        <span className="text-2xl">💘</span>
                                        <span className="font-bold text-pink-600">Romance</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-20 flex flex-col gap-2 border-cyan-200 hover:bg-cyan-50 hover:border-cyan-500 transition-all"
                                        onClick={() => triggerDjEffect('party')}
                                    >
                                        <span className="text-2xl">🕺</span>
                                        <span className="font-bold text-cyan-600">Fiesta</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="h-20 flex flex-col gap-2 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-500 transition-all"
                                        onClick={() => triggerDjEffect('camera')}
                                    >
                                        <span className="text-2xl">📸</span>
                                        <span className="font-bold text-yellow-600">Foto Grupal</span>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

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
                    {isSuperAdmin && (
                        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between bg-card/50 p-4 rounded-xl border border-white/10">
                            <div className="flex flex-wrap gap-2">
                                <Button onClick={handleDownloadApprovedPhotos} className="bg-blue-600 hover:bg-blue-700">
                                    <Download className="w-4 h-4 mr-2" /> Descargar Fotos (ZIP)
                                </Button>
                                <Button onClick={downloadMessagesPDF} variant="secondary">
                                    <Download className="w-4 h-4 mr-2" /> Descargar Libro de Firmas (PDF)
                                </Button>
                            </div>
                            <Button onClick={handleClearApproved} variant="destructive">
                                <Trash2 className="w-4 h-4 mr-2" /> Vaciar Aprobados
                            </Button>
                        </div>
                    )}

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

                                {/* ========== SECCIÓN: FUNCIONALIDADES PRO ========== */}
                                <div className="space-y-4 border-t pt-6 mt-6">
                                    <h3 className="font-semibold text-lg text-amber-500 flex items-center gap-2">
                                        <Zap className="w-5 h-5" /> Funcionalidades PRO
                                    </h3>

                                    {/* Reacciones en Vivo */}
                                    <div className="flex items-center justify-between rounded-lg border p-4 bg-card/50">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium">Reacciones en Vivo 🎉</label>
                                            <p className="text-sm text-muted-foreground">
                                                Los invitados pueden enviar emojis que aparecen en el muro.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings?.reactions_enabled ?? true}
                                            onCheckedChange={(checked) => updateSettings.mutate({ id: settings?.id, reactions_enabled: checked } as any)}
                                        />
                                    </div>

                                    {/* DJ Mode */}            <div className="flex items-center justify-between rounded-lg border p-4 bg-card/50">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium">Modo DJ / Efectos Manuales 🎛️</label>
                                            <p className="text-sm text-muted-foreground">
                                                Habilita un panel para lanzar efectos masivos (sirenas, humo, amor) en el muro.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings?.dj_mode_enabled ?? false}
                                            onCheckedChange={(checked) => updateSettings.mutate({ id: settings?.id, dj_mode_enabled: checked } as any)}
                                        />
                                    </div>

                                    {/* Photo Booth Mode */}
                                    <div className="rounded-lg border p-4 bg-card/50 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <label className="text-base font-medium">Modo Photo Booth (Souvenir) 🖼️</label>
                                                <p className="text-sm text-muted-foreground">
                                                    Genera una foto descargable con marco al subir una imagen.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={settings?.photo_booth_enabled ?? false}
                                                onCheckedChange={(checked) => updateSettings.mutate({ id: settings?.id, photo_booth_enabled: checked } as any)}
                                            />
                                        </div>

                                        {settings?.photo_booth_enabled && (
                                            <div className="pt-2 border-t border-white/10 animate-in fade-in slide-in-from-top-2">
                                                <label className="block text-sm font-medium mb-2">
                                                    Fondo / Marco para Photo Booth (JPG o PNG - 10x15cm)
                                                </label>
                                                <div className="flex items-center gap-4">
                                                    {settings?.photobooth_frame_url && (
                                                        <div className="relative w-16 h-24 bg-slate-800 rounded border border-white/20 overflow-hidden">
                                                            <img src={settings.photobooth_frame_url} alt="Marco" className="w-full h-full object-cover" />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col gap-2">
                                                        <Input
                                                            type="file"
                                                            accept="image/jpeg,image/png"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleImageUpload(e, 'photobooth_frame_url');
                                                            }}
                                                        />
                                                        {settings?.photobooth_frame_url && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => setTestPhotoBoothOpen(true)}
                                                                className="w-full"
                                                            >
                                                                <Zap className="w-4 h-4 mr-2" />
                                                                Probar Marco
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Sube una imagen vertical (ratio 2:3). La foto del invitado se colocará encima.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Galería Pública */}
                                    <div className="flex items-center justify-between rounded-lg border p-4 bg-card/50">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium">Galería Pública en Móvil 📱</label>
                                            <p className="text-sm text-muted-foreground">
                                                Permite a los invitados ver todas las fotos aprobadas en sus celulares.
                                                <span className="block text-amber-500 text-xs mt-1">⚠️ Consume más datos de internet.</span>
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings?.public_gallery_enabled ?? false}
                                            onCheckedChange={(checked) => updateSettings.mutate({ id: settings?.id, public_gallery_enabled: checked } as any)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t">
                                    <h3 className="font-medium">Configuración del Carrusel</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Vueltas del Carrusel</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={10}
                                                value={formData.carousel_max_loops}
                                                onChange={(e) => setFormData({ ...formData, carousel_max_loops: parseInt(e.target.value) || 1 })}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Cuántas veces pasar todas las fotos antes de mostrar el QR.
                                            </p>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Tiempo por Foto (ms)</label>
                                            <Input
                                                type="number"
                                                min={1000}
                                                step={500}
                                                value={formData.carousel_interval_ms}
                                                onChange={(e) => setFormData({ ...formData, carousel_interval_ms: parseInt(e.target.value) || 5000 })}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Milisegundos que se muestra cada foto (5000ms = 5s).
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-lg border p-4 bg-card/50">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium">Mostrar Controles en Pantalla</label>
                                            <p className="text-sm text-muted-foreground">
                                                Botones de Pausa/Reanudar en la esquina inferior.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={formData.wall_show_controls}
                                            onCheckedChange={(checked) => setFormData({ ...formData, wall_show_controls: checked })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 border-t pt-4">
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

                                {/* ========== SECCIÓN: MARCOS Y LOGOS DE MARCA ========== */}
                                <div className="space-y-4 border-t pt-6">
                                    <h3 className="font-semibold text-lg text-violet-400">🎨 Marcos y Logos de Marca</h3>
                                    <p className="text-sm text-muted-foreground">Personaliza la experiencia con tu logo y marcos personalizados.</p>

                                    {/* Marco PNG para el muro */}
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Marco de Marca (PNG transparente)</label>
                                        <p className="text-xs text-muted-foreground">Se superpondrá sobre cada foto en el muro. Ideal para "Boda Ana & Juan - 29/11"</p>
                                        <div className="flex items-center gap-4">
                                            {settings?.frame_image_url && (
                                                <img
                                                    src={settings.frame_image_url}
                                                    alt="Marco"
                                                    className="w-20 h-20 object-contain rounded-md border"
                                                />
                                            )}
                                            <Input
                                                type="file"
                                                accept="image/png"
                                                onChange={(e) => handleImageUpload(e, 'frame_image_url')}
                                                className="cursor-pointer"
                                            />
                                        </div>

                                        {/* Switch para activar/desactivar marco */}
                                        <div className="flex items-center justify-between rounded-lg border p-3 bg-card/30 mt-2">
                                            <div className="space-y-0.5">
                                                <label className="text-sm font-medium">Mostrar marco en el muro</label>
                                                <p className="text-xs text-muted-foreground">
                                                    Activa o desactiva la superposición del marco sobre las fotos.
                                                </p>
                                            </div>
                                            <Switch
                                                checked={settings?.frame_enabled ?? true}
                                                onCheckedChange={(checked) =>
                                                    updateSettings.mutate({ id: settings?.id, frame_enabled: checked } as any)
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Logo para pantalla de carga */}
                                    <div className="space-y-2 pt-4 border-t">
                                        <label className="text-sm font-medium">Logo de Carga (Splash Screen)</label>
                                        <p className="text-xs text-muted-foreground">Se mostrará cuando la app esté cargando. Si no subes uno, usará la imagen de fondo.</p>
                                        <div className="flex items-center gap-4">
                                            {settings?.splash_logo_url && (
                                                <img
                                                    src={settings.splash_logo_url}
                                                    alt="Logo Splash"
                                                    className="w-20 h-20 object-contain rounded-md border"
                                                />
                                            )}
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleImageUpload(e, 'splash_logo_url')}
                                                className="cursor-pointer"
                                            />
                                        </div>

                                        {/* Switch para activar/desactivar splash */}
                                        <div className="flex items-center justify-between rounded-lg border p-3 bg-card/30 mt-2">
                                            <div className="space-y-0.5">
                                                <label className="text-sm font-medium">Mostrar logo en pantalla de carga</label>
                                                <p className="text-xs text-muted-foreground">
                                                    Si se desactiva, la carga será solo el mensaje de "Cargando...".
                                                </p>
                                            </div>
                                            <Switch
                                                checked={settings?.show_splash_logo ?? true}
                                                onCheckedChange={(checked) =>
                                                    updateSettings.mutate({ id: settings?.id, show_splash_logo: checked } as any)
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full" disabled={updateSettings.isPending}>
                                    {updateSettings.isPending ? "Guardando..." : "Guardar Cambios"}
                                </Button>

                                <div className="pt-8 border-t mt-8">
                                    <h3 className="text-blue-400 font-medium mb-4">Herramientas de Prueba</h3>
                                    <Button type="button" variant="outline" className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10" onClick={simulateParty}>
                                        <Zap className="w-4 h-4 mr-2" /> ⚡ SIMULAR FIESTA (Stress Test)
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Genera fotos y mensajes falsos para probar el carrusel.
                                    </p>
                                </div>

                                <div className="pt-8 border-t">
                                    <h3 className="text-lg font-medium text-destructive mb-4">Zona de Peligro</h3>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        className="w-full"
                                        onClick={async () => {
                                            await resetAll.mutateAsync();
                                            toast.success("Evento reiniciado correctamente");
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" /> Reiniciar Evento (Borrar Todo)
                                    </Button>
                                    <p className="text-xs text-muted-foreground mt-2 text-center">
                                        Esto eliminará todas las fotos y mensajes permanentemente.
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </TabsContent>

                {isSuperAdmin && (
                    <TabsContent value="access">
                        <ProvidersManagement eventId={event.id} />
                    </TabsContent>
                )}
            </Tabs>
            {/* Modal de Prueba Photo Booth */}
            {testPhotoBoothOpen && settings?.photobooth_frame_url && (
                <PhotoBoothModal
                    isOpen={testPhotoBoothOpen}
                    onClose={() => setTestPhotoBoothOpen(false)}
                    photoUrl="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=1000&auto=format&fit=crop"
                    frameUrl={settings.photobooth_frame_url}
                />
            )}
        </div >
    );
};

export default Admin;
