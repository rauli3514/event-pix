import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
    ArrowLeft, QrCode, Download, Images, MessageSquare, Monitor, Palette, Trash2, Zap, BarChart2, CheckCircle2, Music, Menu, ExternalLink, Users, Image as ImageIcon, Settings, Layout, Share2, Camera, MonitorPlay, Save, Smartphone, Shield, Video, Sparkles, UploadCloud 
} from "lucide-react";
import { XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area } from 'recharts';
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { useSubmissions } from "@/hooks/use-submissions";
import { useEventSettings, useUpdateEventSettings, useUploadEventImage } from "@/hooks/use-event-settings";
import { supabase } from "@/lib/supabase";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import { useEvent } from "@/context/EventContext";
import { useIsSuperAdmin } from "@/hooks/use-roles";
import { ProvidersManagement } from "@/components/ProvidersManagement";
import { ThemeSelector } from "@/components/admin/ThemeSelector";
import { SubmissionCard } from "@/components/admin/SubmissionCard";
import { TriviaGameManager } from "@/components/trivia/TriviaGameManager";
import { PhotoVoteManager } from "@/components/photovote/PhotoVoteManager";

const Admin = () => {
    const { event, isLoading: eventLoading } = useEvent();
    const { submissions, isLoading, deleteAllApproved, resetAll, approveAllPending } = useSubmissions(event?.id);
    const { data: settings, isLoading: settingsLoading } = useEventSettings(event?.id);
    const updateSettings = useUpdateEventSettings(event?.id);
    const uploadImage = useUploadEventImage();
    const isSuperAdmin = useIsSuperAdmin();

    const [isSaving, setIsSaving] = useState(false);
    
    // AI Themes State
    const [aiThemes, setAiThemes] = useState<any[]>([]);
    const [isUploadingTheme, setIsUploadingTheme] = useState(false);
    const [newTheme, setNewTheme] = useState({
        name: '',
        category: '',
        prompt: '',
        negative_prompt: ''
    });
    const [themeFile, setThemeFile] = useState<File | null>(null);

    const [activeTab, setActiveTab] = useState("dashboard");
    const [moderationFilter, setModerationFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
            fetchAiThemes();
        }
    }, [settings]);

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
        doc.text(`EventPix - ${dateStr} `, pageWidth / 2, y, { align: "center" });
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
                doc.text(`- ${msg.author} `, pageWidth - margin - 10, y + cardHeight - 7, { align: "right" });
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






    const handleApproveAll = async () => {
        if (!event?.id) return;
        if (confirm("¿Estás seguro de aprobar TODAS las fotos y mensajes pendientes?")) {
            await approveAllPending.mutateAsync();
            toast.success("Todo el contenido pendiente ha sido aprobado");
        }
    };

    const handleDownloadQRPoster = async () => {
        if (!event?.slug) return;
        const url = `${window.location.origin}/${event.slug}`;

        try {
            const toastId = toast.loading("Generando Póster PDF...");

            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4"
            });

            // 1. Fondo (Imagen del tema o Color sólido)
            if (settings?.background_image_url) {
                try {
                    const bgImage = new Image();
                    bgImage.src = settings.background_image_url;
                    bgImage.crossOrigin = "Anonymous";
                    await new Promise((resolve, reject) => {
                        bgImage.onload = resolve;
                        bgImage.onerror = reject;
                    });

                    // Ajustar imagen para cubrir A4 (210x297) manteniendo aspecto (cover) o estirar
                    // Para simplificar y asegurar cobertura total:
                    doc.addImage(bgImage, 'JPEG', 0, 0, 210, 297);

                    // Añadir overlay oscuro para legibilidad (simulado con rect negro y luego texto encima, 
                    // jsPDF básico no maneja transparencia alpha fácil, pero intentaremos un truco o simplemente usaremos cajas de texto con fondo)

                    // Opción A: Dibujar un rectángulo semitransparente NO es trivial en jsPDF básico sin plugins.
                    // Opción B: Dibujar cajas negras detrás del texto.
                    // Opción C: Asumir que el usuario quiere ver la imagen y el texto debe ser legible.

                    // Intentaremos GState si está disponible en la versión, sino fallback.
                    try {
                        // @ts-ignore
                        doc.setGState(new doc.GState({ opacity: 0.7 }));
                        doc.setFillColor(0, 0, 0);
                        doc.rect(0, 0, 210, 297, 'F');
                        // @ts-ignore
                        doc.setGState(new doc.GState({ opacity: 1.0 })); // Restaurar
                    } catch (e) {
                        // Si falla GState, no hacemos el overlay global, pero podríamos poner cajas detrás del texto
                        console.warn("GState no disponible, sin overlay global");
                    }

                } catch (e) {
                    console.error("Error cargando fondo", e);
                    doc.setFillColor(15, 23, 42);
                    doc.rect(0, 0, 210, 297, 'F');
                }
            } else {
                doc.setFillColor(15, 23, 42); // Slate 950
                doc.rect(0, 0, 210, 297, 'F');
            }

            // 2. Título y Textos
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(30);
            doc.setFont("helvetica", "bold");

            // Sombra de texto simple (dibujar negro desplazado)
            doc.setTextColor(0, 0, 0);
            doc.text("¡Sube tus fotos!", 106, 41, { align: "center" });
            doc.setTextColor(255, 255, 255);
            doc.text("¡Sube tus fotos!", 105, 40, { align: "center" });

            doc.setFontSize(16);
            doc.setFont("helvetica", "normal");
            doc.text(`${event.name || 'EventPix'}`, 105, 52, { align: "center" });

            // 3. QR Code
            // URL con color transparente? No, JPG no soporta alpha, PNG si.
            // Usaremos fondo blanco para el QR para asegurar que se lea sobre cualquier imagen
            // bgcolor=ffffff
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(url)}&color=000000&bgcolor=ffffff&margin=10`;

            const qrImage = new Image();
            qrImage.src = qrUrl;
            qrImage.crossOrigin = "Anonymous";

            await new Promise((resolve) => {
                qrImage.onload = resolve;
                qrImage.onerror = resolve;
            });

            // Fondo blanco para el QR (marco)
            doc.setFillColor(255, 255, 255);
            doc.roundedRect(50, 65, 110, 110, 5, 5, 'F');

            try {
                doc.addImage(qrImage, 'PNG', 55, 70, 100, 100);
            } catch (e) {
                doc.text("Error QR", 105, 120, { align: "center" });
            }

            // 4. Instrucciones
            doc.setFontSize(14);
            // Fondo semitransparente para instrucciones si hay imagen?
            // Mejor texto con sombra.
            const instructions = [
                "1. Escanea el código QR",
                "2. Sube tus fotos o mensajes",
                "3. ¡Míralas en la pantalla!"
            ];

            let yPos = 200;
            instructions.forEach(line => {
                doc.setTextColor(0, 0, 0);
                doc.text(line, 105.5, yPos + 0.5, { align: "center" });
                doc.setTextColor(255, 255, 255);
                doc.text(line, 105, yPos, { align: "center" });
                yPos += 12;
            });

            // Link texto
            doc.setFontSize(10);
            doc.setTextColor(200, 200, 200);
            doc.text(url, 105, 280, { align: "center" });

            doc.save(`Poster_QR_${event.slug}.pdf`);
            toast.dismiss(toastId);
            toast.success("Póster PDF generado");
        } catch (error) {
            console.error(error);
            toast.error("Error al generar el PDF");
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
                    folder?.file(`foto - ${index + 1}.${extension} `, blob);
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

    const handleDownloadApprovedAudios = async () => {
        const audios = submissions.filter(s => s.status === 'approved' && s.type === 'audio');
        if (audios.length === 0) {
            toast.error("No hay audios aprobados para descargar");
            return;
        }

        const zip = new JSZip();
        const folder = zip.folder("audios-eventpix");
        const downloadToast = toast.loading(`Generando ZIP con ${audios.length} audios...`);

        try {
            const promises = audios.map(async (audio, index) => {
                try {
                    const response = await fetch(audio.content);
                    const blob = await response.blob();
                    // Intentar deducir extensión, audio suele ser webm o mp3 según recording
                    let extension = audio.content.split('.').pop()?.split('?')[0] || 'webm';
                    if (extension.length > 4) extension = 'webm'; // Fallback común

                    folder?.file(`audio - ${index + 1} - ${audio.author || 'anon'}.${extension}`, blob);
                } catch (e) {
                    console.error("Error downloading audio", e);
                }
            });

            await Promise.all(promises);
            const content = await zip.generateAsync({ type: "blob" });
            saveAs(content, "audios-eventpix.zip");
            toast.dismiss(downloadToast);
            toast.success("Audios descargados");
        } catch (error) {
            console.error(error);
            toast.dismiss(downloadToast);
            toast.error("Error al generar el ZIP de audios");
        }
    };

    const fetchAiThemes = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_themes')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            setAiThemes(data || []);
        } catch (error) {
            console.error('Error fetching themes:', error);
        }
    };

    const handleCreateTheme = async () => {
        if (!newTheme.name || !newTheme.category || !newTheme.prompt || !themeFile) {
            toast.error("Por favor completa el nombre, categoría, prompt y la imagen de portada.");
            return;
        }

        setIsUploadingTheme(true);
        try {
            const fileExt = themeFile.name.split('.').pop();
            const fileName = `theme_${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload(`ai_themes/${fileName}`, themeFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl(`ai_themes/${fileName}`);

            const { error: dbError } = await supabase
                .from('ai_themes')
                .insert([{
                    name: newTheme.name,
                    category: newTheme.category,
                    prompt: newTheme.prompt,
                    negative_prompt: newTheme.negative_prompt,
                    cover_image_url: publicUrl
                }]);

            if (dbError) throw dbError;

            toast.success("¡Temática creada con éxito!");
            setNewTheme({ name: '', category: '', prompt: '', negative_prompt: '' });
            setThemeFile(null);
            fetchAiThemes();

        } catch (error: any) {
            console.error("Error creating theme:", error);
            toast.error("Error al crear la temática: " + error.message);
        } finally {
            setIsUploadingTheme(false);
        }
    };

    const handleDeleteTheme = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar esta temática?")) return;
        
        try {
            const { error } = await supabase
                .from('ai_themes')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            toast.success("Temática eliminada");
            fetchAiThemes();
        } catch (error: any) {
            toast.error("Error al eliminar: " + error.message);
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
            onError: (err) => {
                console.error("Error updating settings:", err);
                toast.error("Error al actualizar la configuración");
            },
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
                author: `Simulado ${count + 1} `,
                status: 'approved', // Directo al wall para probar carga
                created_at: new Date().toISOString(),
                event_id: event?.id // Importante: Asociar al evento actual
            }]);

            count++;
            toast.loading(`Simulando fiesta... (${count}/${total})`, { id: toastId });
        }, 200); // 5 por segundo
    };



    // ... (existing hooks)

    // Calculate stats
    const stats = {
        pending: submissions?.filter(s => s.status === 'pending').length || 0,
        approved: submissions?.filter(s => s.status === 'approved').length || 0,
        rejected: submissions?.filter(s => s.status === 'rejected').length || 0,
        total: submissions?.length || 0
    };

    // ... (rest of logic remains, jumping to RETURN)

    // Chart Calculations
    const chartData = useMemo(() => {
        if (!submissions) return [];
        const hourly: Record<string, { time: string; photos: number; messages: number; audios: number }> = {};

        submissions.forEach(sub => {
            const date = new Date(sub.created_at);
            const hour = date.getHours().toString().padStart(2, '0') + ":00";

            if (!hourly[hour]) {
                hourly[hour] = { time: hour, photos: 0, messages: 0, audios: 0 };
            }

            if (sub.type === 'photo') hourly[hour].photos++;
            else if (sub.type === 'message') hourly[hour].messages++;
            else if (sub.type === 'audio') hourly[hour].audios++;
        });

        // Fill missing hours if needed or just sort existing
        return Object.values(hourly).sort((a, b) => a.time.localeCompare(b.time));
    }, [submissions]);

    const activeUsers = useMemo(() => {
        if (!submissions) return 0;
        const authors = new Set(submissions.map(s => s.author).filter(Boolean));
        return authors.size;
    }, [submissions]);

    if (eventLoading) {
        return <div className="min-h-screen flex items-center justify-center text-foreground bg-slate-950">Cargando datos del evento...</div>;
    }
    if (settingsLoading) {
        return <div className="min-h-screen flex items-center justify-center text-foreground bg-slate-950">Cargando configuración...</div>;
    }
    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center text-foreground bg-slate-950">Cargando contenido...</div>;
    }

    if (!event) return <div className="min-h-screen flex items-center justify-center text-foreground">Evento no encontrado</div>;

    return (
        <div className="min-h-screen bg-slate-950 flex font-sans text-slate-100">
            <AdminSidebar
                activeTab={activeTab}
                onTabChange={(id) => {
                    setActiveTab(id);
                    setIsMobileMenuOpen(false);
                }}
                onLogout={handleLogout}
                eventName={event.name}
                isMobileOpen={isMobileMenuOpen}
                onMobileClose={() => setIsMobileMenuOpen(false)}
            />

            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen">
                <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:justify-between items-start md:items-center bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-white/5 backdrop-blur-xl gap-4 md:gap-0">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden flex-shrink-0 text-slate-300 hover:text-white"
                        >
                            <Menu className="w-6 h-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                                {(() => {
                                    switch (activeTab) {
                                        case 'dashboard': return 'Panel de Control';
                                        case 'moderation': return 'Moderación';
                                        case 'trivia': return 'Control de Trivia';
                                        case 'voting': return 'Votación';
                                        case 'design': return 'Diseño';
                                        case 'settings': return 'Ajustes';
                                        case 'display': return 'Pantalla';
                                        case 'downloads': return 'Descargas';
                                        default: return 'Admin';
                                    }
                                })()}
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">Gestionando: <span className="text-white font-medium">{event.name}</span></p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto">
                        {activeTab !== 'dashboard' && (
                            <Button
                                variant="outline"
                                onClick={() => setActiveTab('dashboard')}
                                className="flex-1 md:flex-none justify-center items-center gap-2 text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                <span>Salir al Inicio</span>
                            </Button>
                        )}
                        <div className="flex gap-2 w-full md:w-auto">
                            <a href={`/${event.slug}`} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none">
                                <Button className="w-full bg-slate-800 text-white border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors">
                                    <span className="mr-2 hidden sm:inline">📱</span> Invitado
                                </Button>
                            </a>
                            <a href={`/${event.slug}/display`} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none">
                                <Button className="w-full bg-violet-600 hover:bg-violet-700">
                                    <span className="mr-2 hidden sm:inline">🖥️</span> Pantalla
                                </Button>
                            </a>
                        </div>
                    </div >
                </header >

                {/* ================= DASHBOARD TAB ================= */}
                {
                    activeTab === 'dashboard' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Pendientes</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl font-bold text-yellow-400">{stats.pending}</div></CardContent>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Aprobados</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl font-bold text-green-400">{stats.approved}</div></CardContent>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Total Fotos</CardTitle></CardHeader>
                                    <CardContent><div className="text-3xl font-bold text-white">{stats.total}</div></CardContent>
                                </Card>
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-400">Estado</CardTitle></CardHeader>
                                    <CardContent>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                                            <span className="text-sm font-medium">En Vivo</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Activity Analytics */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <Card className="bg-slate-900 border-slate-800 lg:col-span-2">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                                            <BarChart2 className="w-5 h-5 text-violet-500" /> Actividad del Evento
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="h-[300px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="colorPhotos" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                                                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                <Tooltip
                                                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9', borderRadius: '8px' }}
                                                    itemStyle={{ color: '#e2e8f0' }}
                                                />
                                                <Area type="monotone" dataKey="photos" name="Fotos" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorPhotos)" />
                                                <Area type="monotone" dataKey="messages" name="Mensajes" stroke="#10b981" strokeWidth={2} fill="none" />
                                                <Area type="monotone" dataKey="audios" name="Audios" stroke="#ef4444" strokeWidth={2} fill="none" />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader>
                                        <CardTitle className="text-lg font-semibold text-slate-100">Interacción</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">Usuarios (Autores)</span>
                                            <span className="text-xl font-bold text-white">{activeUsers}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">Mensajes Texto</span>
                                            <span className="text-xl font-bold text-white">{submissions?.filter(s => s.type === 'message').length}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-slate-800">
                                            <span className="text-slate-400 text-sm">Audios</span>
                                            <span className="text-xl font-bold text-white">{submissions?.filter(s => s.type === 'audio').length}</span>
                                        </div>

                                        <div className="pt-4">
                                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Hora Pico</h4>
                                            {chartData.length > 0 ? (
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl font-bold text-violet-400">
                                                        {(() => {
                                                            const peak = [...chartData].sort((a, b) => b.photos - a.photos)[0];
                                                            return peak?.time || "--:--";
                                                        })()}
                                                    </span>
                                                    <span className="text-xs text-slate-500">Mayor actividad</span>
                                                </div>
                                            ) : (
                                                <span className="text-sm text-slate-600">Sin datos suficientes</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader><CardTitle>Accesos Rápidos</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center group cursor-pointer hover:border-violet-500/50 transition-all" onClick={() => setActiveTab('moderation')}>
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                    <CheckCircle2 className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-white">Moderar Fotos</h4>
                                                    <p className="text-sm text-slate-400">Tienes {stats.pending} fotos esperando.</p>
                                                </div>
                                            </div>
                                            <ArrowLeft className="rotate-180 text-slate-600 group-hover:text-white transition-colors" />
                                        </div>

                                        <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center group cursor-pointer hover:border-violet-500/50 transition-all" onClick={() => setActiveTab('design')}>
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                                    <Zap className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-white">Cambiar Diseño</h4>
                                                    <p className="text-sm text-slate-400">Personaliza temas y marcos.</p>
                                                </div>
                                            </div>
                                            <ArrowLeft className="rotate-180 text-slate-600 group-hover:text-white transition-colors" />
                                        </div>
                                    </CardContent>
                                </Card>

                                {isSuperAdmin && (
                                    <div className="space-y-4">
                                        <Card className="bg-slate-900 border-slate-800">
                                            <CardHeader><CardTitle>Gestión (Super Admin)</CardTitle></CardHeader>
                                            <CardContent>
                                                <ProvidersManagement eventId={event.id} />
                                            </CardContent>
                                        </Card>
                                    </div>
                                )}

                                {/* AI Moderation - Available for ALL admins (Providers included) */}
                                <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-2">
                                                <label className="text-base font-medium text-slate-200">Moderación IA Automática</label>
                                                <span className="bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                                    <Zap className="w-3 h-3" /> BETA
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                La IA aprobará automáticamente el contenido seguro. Lo dudoso quedará pendiente.
                                            </p>
                                        </div>
                                        <Switch
                                            checked={settings?.ai_moderation_enabled ?? false}
                                            onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, ai_moderation_enabled: c } as any)}
                                        />
                                    </div>

                                    {settings?.ai_moderation_enabled && (
                                        <div className="pt-2 border-t border-slate-900 space-y-3 animate-in slide-in-from-top-2 fade-in duration-300">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-400 mb-2 block uppercase">Nivel de Rigurosidad</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {['low', 'medium', 'high'].map((level) => (
                                                        <button
                                                            key={level}
                                                            onClick={() => updateSettings.mutate({ id: settings?.id, ai_moderation_level: level as any } as any)}
                                                            className={`px-3 py-2 rounded-md text-xs font-medium border transition-all ${(settings?.ai_moderation_level || 'medium') === level
                                                                ? 'bg-violet-600 border-violet-500 text-white'
                                                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                                }`}
                                                        >
                                                            {level === 'low' && 'Baja'}
                                                            {level === 'medium' && 'Media'}
                                                            {level === 'high' && 'Alta'}
                                                        </button>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-slate-500 mt-2">
                                                    {(settings?.ai_moderation_level || 'medium') === 'low' && "Aprueba casi todo, salvo contenido muy explícito. Ideal para eventos privados de confianza."}
                                                    {(settings?.ai_moderation_level || 'medium') === 'medium' && "Equilibrado. Filtra violencia, desnudez y contenido ofensivo claro."}
                                                    {(settings?.ai_moderation_level || 'medium') === 'high' && "Muy estricto. Ante la mínima duda, dejará la foto como pendiente. Recomendado para eventos públicos y corporativos."}
                                                </p>
                                            </div>

                                            <div className="bg-yellow-900/10 border border-yellow-700/20 p-3 rounded-md flex gap-2">
                                                <div className="text-yellow-500 mt-0.5"><Monitor className="w-3 h-3" /></div>
                                                <p className="text-[10px] text-yellow-200/60 leading-tight">
                                                    <strong>Descargo de responsabilidad:</strong> EventPix no se hace responsable por errores en la moderación automática ni por el contenido que pudiera aprobarse indebidamente. La responsabilidad final del contenido mostrado es del organizador.
                                                </p>
                                            </div>
                                            
                                            <div className="pt-2">
                                                <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer">
                                                    <Button variant="outline" size="sm" className="w-full justify-between border-slate-700 hover:bg-slate-800 text-slate-300">
                                                        <span>Ver Créditos de Uso (Panel IA)</span>
                                                        <ExternalLink className="w-4 h-4 ml-2" />
                                                    </Button>
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    )
                }
                {
                    activeTab === 'moderation' && (
                        <div className="space-y-6">
                            {/* Sub-tabs for moderation */}
                            <div className="flex gap-2 p-1 bg-slate-900 w-fit rounded-lg border border-slate-800">
                                {[
                                    { id: 'pending', label: `Pendientes (${stats.pending})`, color: 'text-yellow-400' },
                                    { id: 'approved', label: `Aprobadas (${stats.approved})`, color: 'text-green-400' },
                                    { id: 'rejected', label: `Rechazadas (${stats.rejected})`, color: 'text-red-400' }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setModerationFilter(tab.id as any)}
                                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${moderationFilter === tab.id
                                            ? 'bg-slate-800 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-white'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Approve All Button (Only in pending) */}
                            {moderationFilter === 'pending' && stats.pending > 0 && (
                                <div className="p-6 bg-gradient-to-r from-green-900/20 to-emerald-900/20 rounded-xl border border-green-500/20 flex flex-col items-center justify-center gap-4">
                                    <p className="text-green-200">Hay {stats.pending} fotos esperando aprobación.</p>
                                    <Button
                                        onClick={handleApproveAll}
                                        className="bg-green-600 hover:bg-green-700 shadow-lg shadow-green-900/20 hover:scale-105 transition-all"
                                        disabled={approveAllPending.isPending}
                                    >
                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                        {approveAllPending.isPending ? "Procesando..." : "Aprobar TODO de una vez"}
                                    </Button>
                                </div>
                            )}

                            {/* Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {submissions
                                    .filter(item => item.status === moderationFilter)
                                    .map(item => (
                                        <SubmissionCard key={item.id} item={item} />
                                    ))}

                                {submissions.filter(s => s.status === moderationFilter).length === 0 && (
                                    <div className="col-span-full py-20 text-center">
                                        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Images className="w-10 h-10 text-slate-600" />
                                        </div>
                                        <h3 className="text-slate-400 text-lg">No hay contenido en esta sección</h3>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }

                {/* ================= DESIGN TAB ================= */}
                {
                    activeTab === 'design' && (
                        <div className="max-w-4xl space-y-8">
                            {/* Theme Selector Section */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-violet-400 flex items-center gap-2">
                                    <Palette className="w-5 h-5" /> Selector de Temas
                                </h3>
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
                                    <ThemeSelector
                                        currentBackground={settings?.background_image_url || null}
                                        onSelectTheme={(imageUrl, fontFamily, frameUrl) => {
                                            if (!settings) return;
                                            updateSettings.mutate({
                                                id: settings.id,
                                                background_image_url: imageUrl,
                                                font_family: fontFamily,
                                                frame_image_url: frameUrl || null,
                                                frame_enabled: !!frameUrl
                                            } as any, {
                                                onSuccess: () => toast.success("Tema actualizado correctamente ✨")
                                            });
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Custom Uploads */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader><CardTitle className="text-base">Fondo Personalizado</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="w-full h-32 bg-slate-950 rounded-lg flex items-center justify-center border border-dashed border-slate-700 relative overflow-hidden group">
                                            {settings?.background_image_url ? (
                                                <img src={settings.background_image_url} className="w-full h-full object-cover opacity-50 group-hover:opacity-100 transition-opacity" />
                                            ) : <span className="text-slate-500">Sin fondo</span>}
                                            <Input
                                                type="file"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => handleImageUpload(e, 'background_image_url')}
                                            />
                                        </div>
                                        <p className="text-xs text-slate-500 text-center">Click para subir imagen (Recomendado: 1920x1080px, JPG/PNG, Máx 5MB)</p>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader><CardTitle className="text-base">Marco / Overlay (PNG)</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="w-full h-32 bg-slate-950 rounded-lg flex items-center justify-center border border-dashed border-slate-700 relative overflow-hidden group">
                                            {settings?.frame_image_url ? (
                                                <img src={settings.frame_image_url} className="w-full h-full object-contain p-2" />
                                            ) : <span className="text-slate-500">Sin marco</span>}
                                            <Input
                                                type="file"
                                                accept="image/png"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => handleImageUpload(e, 'frame_image_url')}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-slate-500">PNG Transparente (1920x1080px)</p>
                                            <Switch
                                                checked={settings?.frame_enabled}
                                                onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, frame_enabled: c } as any)}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="bg-slate-900 border-slate-800">
                                    <CardHeader><CardTitle className="text-base">Logo Splash / Carga (Circular)</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="w-full h-32 bg-slate-950 rounded-lg flex items-center justify-center border border-dashed border-slate-700 relative overflow-hidden group">
                                            {settings?.splash_logo_url ? (
                                                <img src={settings.splash_logo_url} className="w-auto h-24 object-contain" />
                                            ) : <span className="text-slate-500">Sin logo</span>}
                                            <Input
                                                type="file"
                                                accept="image/*"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                onChange={(e) => handleImageUpload(e, 'splash_logo_url')}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs text-slate-500">Aparece en el círculo de carga</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Promo Banner & Extra (Super Admin Only) */}
                            {isSuperAdmin && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <Card className="bg-slate-900 border-slate-800">
                                        <CardHeader><CardTitle className="text-base">Banner Promocional (Sorteo)</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="w-full h-32 bg-slate-950 rounded-lg flex items-center justify-center border border-dashed border-slate-700 relative overflow-hidden group">
                                                {settings?.promo_banner_url ? (
                                                    <img src={settings.promo_banner_url} className="w-full h-full object-contain p-2" />
                                                ) : <span className="text-slate-500">Sin banner</span>}
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                    onChange={(e) => handleImageUpload(e, 'promo_banner_url' as any)}
                                                />
                                            </div>
                                            <p className="text-xs text-slate-500 text-center">Aparece en la pantalla de carga (Index). Soporta GIF, PNG, JPG. Tamaño sugerido: 600x150px.</p>

                                            <div className="pt-2">
                                                <label className="text-xs text-slate-500 mb-1 block">Enlace al hacer click (Opcional)</label>
                                                <Input
                                                    placeholder="https://instagram.com/..."
                                                    defaultValue={settings?.promo_banner_link || ''}
                                                    onBlur={(e) => {
                                                        if (settings?.id && e.target.value !== settings.promo_banner_link) {
                                                            updateSettings.mutate({ id: settings.id, promo_banner_link: e.target.value } as any);
                                                            toast.success("Enlace guardado");
                                                        }
                                                    }}
                                                    className="bg-slate-950 border-slate-800 text-xs h-8"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                                                <p className="text-sm font-medium text-slate-300">Habilitar Banner</p>
                                                <Switch
                                                    checked={settings?.promo_banner_enabled ?? true}
                                                    onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, promo_banner_enabled: c } as any)}
                                                />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* Message Settings */}
                            <div className="space-y-4">
                                <h3 className="text-xl font-semibold text-violet-400 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5" /> Configuración de Interacción
                                </h3>
                                <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5 space-y-4">
                                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium text-slate-200">Álbum de Fotos para Invitados</label>
                                            <p className="text-xs text-slate-500">Permitir que los invitados puedan ver el álbum de fotos online.</p>
                                        </div>
                                        <Switch
                                            checked={settings?.public_gallery_enabled ?? true}
                                            onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, public_gallery_enabled: c } as any)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium text-slate-200">Mensajes de Texto</label>
                                            <p className="text-xs text-slate-500">Permitir que los invitados envíen textos.</p>
                                        </div>
                                        <Switch
                                            checked={settings?.text_messages_enabled ?? true}
                                            onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, text_messages_enabled: c } as any)}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-slate-950 rounded-lg border border-slate-800">
                                        <div className="space-y-0.5">
                                            <label className="text-base font-medium text-slate-200">Mensajes de Audio</label>
                                            <p className="text-xs text-slate-500">Permitir que los invitados envíen audios.</p>
                                        </div>
                                        <Switch
                                            checked={settings?.audio_messages_enabled ?? true}
                                            onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, audio_messages_enabled: c } as any)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* ================= DISPLAY CONTROLS TAB ================= */}
                {
                    activeTab === 'display' && (
                        <div className="max-w-4xl space-y-6">
                            <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-violet-500 text-slate-100">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2 text-slate-100">
                                        <Monitor className="w-5 h-5 text-violet-400" /> Control del Carrusel
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                        {/* Fader: Loops */}
                                        <div className="space-y-4 bg-slate-950/50 p-6 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-medium text-slate-300">Repeticiones (Loops)</label>
                                                <span className="bg-violet-500/10 text-violet-400 px-3 py-1 rounded-full text-xs font-bold border border-violet-500/20">
                                                    {formData.carousel_max_loops} vueltas
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1"
                                                max="10"
                                                step="1"
                                                value={formData.carousel_max_loops}
                                                onChange={(e) => setFormData({ ...formData, carousel_max_loops: parseInt(e.target.value) || 1 })}
                                                className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500 hover:accent-violet-400 transition-all"
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1">
                                                <span>1</span>
                                                <span>5</span>
                                                <span>10</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">Veces que se muestran las fotos antes de pedir nuevas.</p>
                                        </div>

                                        {/* Fader: Interval */}
                                        <div className="space-y-4 bg-slate-950/50 p-6 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-medium text-slate-300">Velocidad (Tiempo por foto)</label>
                                                <span className="bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full text-xs font-bold border border-blue-500/20">
                                                    {formData.carousel_interval_ms / 1000} seg
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min="2000"
                                                max="15000"
                                                step="500"
                                                value={formData.carousel_interval_ms}
                                                onChange={(e) => setFormData({ ...formData, carousel_interval_ms: parseInt(e.target.value) || 5000 })}
                                                className="w-full h-3 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
                                            />
                                            <div className="flex justify-between text-[10px] text-slate-600 font-mono mt-1">
                                                <span>2s</span>
                                                <span>8s</span>
                                                <span>15s</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-2">Controla qué tan rápido pasan las fotos.</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        <Button onClick={handleSettingsSubmit} disabled={updateSettings.isPending} className="bg-violet-600 hover:bg-violet-700 text-white">
                                            Guardar Configuración
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* DJ Mode */}
                            <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-amber-500 text-slate-100">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-slate-100">
                                            <Zap className="w-5 h-5 text-amber-500" /> Panel DJ (Efectos en Vivo)
                                        </CardTitle>
                                        <Switch
                                            checked={settings?.dj_mode_enabled}
                                            onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, dj_mode_enabled: c } as any)}
                                        />
                                    </div>
                                </CardHeader>
                                {settings?.dj_mode_enabled && (
                                    <CardContent>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <Button variant="outline" className="h-24 flex flex-col hover:bg-red-500/10 hover:text-red-400 border-slate-700 text-slate-300 hover:border-red-500/50" onClick={() => triggerDjEffect('siren')}>
                                                <span className="text-3xl mb-2">🚨</span> Alerta
                                            </Button>
                                            <Button variant="outline" className="h-24 flex flex-col hover:bg-pink-500/10 hover:text-pink-400 border-slate-700 text-slate-300 hover:border-pink-500/50" onClick={() => triggerDjEffect('love')}>
                                                <span className="text-3xl mb-2">💘</span> Romance
                                            </Button>
                                            <Button variant="outline" className="h-24 flex flex-col hover:bg-cyan-500/10 hover:text-cyan-400 border-slate-700 text-slate-300 hover:border-cyan-500/50" onClick={() => triggerDjEffect('party')}>
                                                <span className="text-3xl mb-2">🕺</span> Fiesta
                                            </Button>
                                            <Button variant="outline" className="h-24 flex flex-col hover:bg-yellow-500/10 hover:text-yellow-400 border-slate-700 text-slate-300 hover:border-yellow-500/50" onClick={() => triggerDjEffect('camera')}>
                                                <span className="text-3xl mb-2">📸</span> Foto Grupal
                                            </Button>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>

                            {/* Photo Booth */}
                            <Card className="bg-slate-900 border-slate-800 border-l-4 border-l-pink-500 text-slate-100">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-slate-100">
                                            <span className="text-2xl">📸</span> Photo Booth (Souvenir)
                                        </CardTitle>
                                        <Switch
                                            checked={settings?.photo_booth_enabled}
                                            onCheckedChange={(c) => updateSettings.mutate({ id: settings?.id, photo_booth_enabled: c } as any)}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-400 text-sm">
                                        Permite a los invitados descargar sus fotos con el marco o tema del evento como recuerdo.
                                        Se mostrará automáticamente después de subir una foto.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    )
                }

                {/* ================= TRIVIA TAB ================= */}
                {
                    activeTab === 'trivia' && event && (
                        <div className="max-w-6xl">
                            <TriviaGameManager
                                eventId={event.id}
                                onBackToDashboard={() => setActiveTab('dashboard')}
                            />
                        </div>
                    )
                }

                {/* ================= PHOTO BATTLE / VOTING TAB ================= */}
                {
                    activeTab === 'voting' && event && (
                        <div className="max-w-6xl">
                            <PhotoVoteManager eventId={event.id} />
                        </div>
                    )
                }


                {/* ================= DOWNLOADS TAB ================= */}
                {
                    activeTab === 'downloads' && (
                        <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group" onClick={handleDownloadApprovedPhotos}>
                                <CardContent className="flex flex-col items-center justify-center py-12 gap-6">
                                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                        <Images className="w-10 h-10" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-white mb-2">Descargar Fotos (ZIP)</h3>
                                        <p className="text-slate-400">Obtén todas las {stats.approved} fotos aprobadas en alta calidad.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 border-slate-800 hover:border-violet-500/50 transition-all cursor-pointer group" onClick={downloadMessagesPDF}>
                                <CardContent className="flex flex-col items-center justify-center py-12 gap-6">
                                    <div className="w-20 h-20 bg-violet-500/10 rounded-full flex items-center justify-center text-violet-500 group-hover:scale-110 transition-transform">
                                        <Download className="w-10 h-10" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-white mb-2">Libro de Firmas (PDF)</h3>
                                        <p className="text-slate-400">Descarga un PDF elegante con los mensajes y saludos.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 border-slate-800 hover:border-pink-500/50 transition-all cursor-pointer group" onClick={handleDownloadQRPoster}>
                                <CardContent className="flex flex-col items-center justify-center py-12 gap-6">
                                    <div className="w-20 h-20 bg-pink-500/10 rounded-full flex items-center justify-center text-pink-500 group-hover:scale-110 transition-transform">
                                        <QrCode className="w-10 h-10" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-white mb-2">Póster QR (PDF)</h3>
                                        <p className="text-slate-400">Descarga un póster listo para imprimir con el diseño del evento.</p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="bg-slate-900 border-slate-800 hover:border-red-500/50 transition-all cursor-pointer group" onClick={handleDownloadApprovedAudios}>
                                <CardContent className="flex flex-col items-center justify-center py-12 gap-6">
                                    <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                        <Music className="w-10 h-10" />
                                    </div>
                                    <div className="text-center">
                                        <h3 className="text-xl font-bold text-white mb-2">Descargar Audios (ZIP)</h3>
                                        <p className="text-slate-400">Obtén todas las notas de voz y saludos de audio aprobados.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )
                }

                {/* ================= SETTINGS TAB (Legacy Form) ================= */}
                {
                    activeTab === 'settings' && (
                        <div className="max-w-2xl">
                            <Card className="bg-slate-900 border-slate-800 text-slate-100">
                                <CardHeader><CardTitle className="text-slate-100">Información General</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-300">Título del Evento</label>
                                        <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="bg-slate-950 border-slate-700 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm text-slate-300">Descripción</label>
                                        <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white" />
                                    </div>
                                    <div className="pt-4 flex justify-end">
                                        <Button onClick={handleSettingsSubmit} disabled={updateSettings.isPending}>Guardar Cambios</Button>
                                    </div>

                                    <div className="pt-8 border-t mt-8">
                                        <h3 className="text-blue-400 font-medium mb-4">Herramientas de Prueba</h3>
                                        <Button type="button" variant="outline" className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10" onClick={simulateParty}>
                                            <Zap className="w-4 h-4 mr-2" /> ⚡ SIMULAR FIESTA (Stress Test)
                                        </Button>
                                        <p className="text-xs text-muted-foreground mt-2 text-center">
                                            Genera fotos y mensajes falsos para probar el carrusel.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="mt-8 p-6 border border-red-900/30 bg-red-900/10 rounded-xl">
                                <h3 className="text-red-400 font-bold mb-2">Zona de Peligro</h3>
                                <div className="space-y-4">
                                    <Button variant="destructive" className="w-full justify-start" onClick={handleClearApproved}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Vaciar Aprobados
                                    </Button>
                                    <Button variant="destructive" className="w-full justify-start" onClick={async () => { await resetAll.mutateAsync(); toast.success("Reset completo"); }}>
                                        <Trash2 className="w-4 h-4 mr-2" /> Reiniciar Evento (Borrar Todo)
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
};

export default Admin;
