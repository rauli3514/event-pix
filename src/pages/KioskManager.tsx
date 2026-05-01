import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import {
    Sparkles, ArrowLeft, Trash2, Save,
    Monitor, Download, Printer, Settings, ExternalLink, Camera, Instagram, Users,
    FolderOpen, Plus, RefreshCw, AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Simple Modal Component
const Modal = ({ isOpen, title, children }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-slate-50 rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">{title}</h3>
                    {children}
                </div>
            </div>
        </div>
    );
};

const KioskManager = () => {
    const [activeTab, setActiveTab] = useState("themes");
    const [aiThemes, setAiThemes] = useState<any[]>([]);
    const [isUploadingTheme, setIsUploadingTheme] = useState(false);
    const [newTheme, setNewTheme] = useState({
        name: '',
        category: '',
        prompt: '',
        negative_prompt: '',
        max_people: 1,
        emoji: '🎨'
    });
    const [themeFile, setThemeFile] = useState<File | null>(null);

    // Design State
    const [frameFile, setFrameFile] = useState<File | null>(null);
    const [isSavingDesign, setIsSavingDesign] = useState(false);
    const [selectedFrame, setSelectedFrame] = useState(() => localStorage.getItem('kiosk_frame_url') || 'none');

    // Camera Settings State
    const [cameraSettings, setCameraSettings] = useState(() => {
        const saved = localStorage.getItem('kiosk_camera_settings');
        return saved ? JSON.parse(saved) : {
            deviceId: 'default',
            rotation: 0,
            orientation: 'vertical',
            timer: 3,
            mirror: false
        };
    });
    const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
    const previewVideoRef = React.useRef<HTMLVideoElement>(null);

    // Albums/Events State
    const [kioskEvents, setKioskEvents] = useState<any[]>([]);
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({ name: '', description: '', event_date: '' });
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [eventPhotos, setEventPhotos] = useState<any[]>([]);
    const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

    // Printer Settings State
    const [printerSettings, setPrinterSettings] = useState(() => {
        const saved = localStorage.getItem('kiosk_printer_settings');
        return saved ? JSON.parse(saved) : {
            selectedPrinter: '',
            paperSize: 'A4',
            orientation: 'portrait',
            imageAdjust: 'contain',
            rotation: 0,
            copies: 1,
            autoPrint: false,
            borderless: false,
        };
    });
    const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
    const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);


    // Persist printer settings
    useEffect(() => {
        localStorage.setItem('kiosk_printer_settings', JSON.stringify(printerSettings));
    }, [printerSettings]);

    const enumeratePrinters = async () => {
        setIsLoadingPrinters(true);
        try {
            // Browsers don't expose printers directly. We try the print server API first.
            const res = await fetch('http://localhost:3001/printers').catch(() => null);
            if (res && res.ok) {
                const data = await res.json();
                setAvailablePrinters(data.printers || []);
                toast.success(`${data.printers.length} impresoras detectadas`);
            } else {
                // Fallback: use window.print() - browser will show printer dialog
                setAvailablePrinters(['Impresora del Sistema (diálogo del navegador)']);
                toast.info('Conecta el servidor de impresión local para detectar impresoras específicas.');
            }
        } catch (err) {
            setAvailablePrinters(['Impresora del Sistema (diálogo del navegador)']);
        } finally {
            setIsLoadingPrinters(false);
        }
    };




    const IMAGE_ADJUSTMENTS = [
        { value: 'contain', label: 'Contain — Ajusta completa, sin recortar' },
        { value: 'cover', label: 'Cover — Rellena, puede recortar' },
        { value: 'fill', label: 'Fill — Estira para rellenar' },
    ];

    // Instagram Settings
    const [igSettings, setIgSettings] = useState(() => {
        const saved = localStorage.getItem('kiosk_ig_settings');
        return saved ? JSON.parse(saved) : {
            hashtag: '',
            shareUrl: '',
            showQrOnResult: false,
            qrMessage: 'Compártela con el hashtag:',
        };
    });
    const [igQrPreview, setIgQrPreview] = useState<string | null>(null);

    useEffect(() => {
        localStorage.setItem('kiosk_ig_settings', JSON.stringify(igSettings));
    }, [igSettings]);

    const generateIgQr = async () => {
        const tag = igSettings.hashtag.replace(/^#/, '');
        const url = igSettings.shareUrl || `https://www.instagram.com/explore/tags/${tag}/`;
        // Use a public QR generator API
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=0f0f1a&color=a78bfa&qzone=1`;
        setIgQrPreview(qrUrl);
        toast.success('QR generado');
    };

    // Profiles State
    const [profiles, setProfiles] = useState<any[]>(() => {
        try { return JSON.parse(localStorage.getItem('kiosk_profiles') || '[]'); }
        catch { return []; }
    });
    const [newProfileName, setNewProfileName] = useState('');

    const saveProfile = () => {
        if (!newProfileName.trim()) { toast.error('Dale un nombre al perfil'); return; }
        const profile = {
            id: Date.now().toString(),
            name: newProfileName,
            createdAt: new Date().toISOString(),
            camera: JSON.parse(localStorage.getItem('kiosk_camera_settings') || '{}'),
            printer: JSON.parse(localStorage.getItem('kiosk_printer_settings') || '{}'),
            instagram: JSON.parse(localStorage.getItem('kiosk_ig_settings') || '{}'),
        };
        const updated = [profile, ...profiles];
        setProfiles(updated);
        localStorage.setItem('kiosk_profiles', JSON.stringify(updated));
        setNewProfileName('');
        toast.success(`Perfil "${profile.name}" guardado`);
    };

    const loadProfile = (profile: any) => {
        if (profile.camera) {
            setCameraSettings(profile.camera);
            localStorage.setItem('kiosk_camera_settings', JSON.stringify(profile.camera));
        }
        if (profile.printer) {
            setPrinterSettings(profile.printer);
            localStorage.setItem('kiosk_printer_settings', JSON.stringify(profile.printer));
        }
        if (profile.instagram) {
            setIgSettings(profile.instagram);
            localStorage.setItem('kiosk_ig_settings', JSON.stringify(profile.instagram));
        }
        toast.success(`Perfil "${profile.name}" cargado`);
    };

    const deleteProfile = (id: string) => {
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);
        localStorage.setItem('kiosk_profiles', JSON.stringify(updated));
        toast.success('Perfil eliminado');
    };

    // General Settings
    const [generalSettings, setGeneralSettings] = useState(() => {
        const saved = localStorage.getItem('kiosk_general_settings');
        return saved ? JSON.parse(saved) : {
            kioskName: 'Photo Booth IA',
            welcomeTitle: 'Toca para empezar',
            welcomeSubtitle: 'Descubre tu nueva versión con Inteligencia Artificial',
            idleTimeout: 60,
            showCountdown: true,
            enableSounds: false,
            adminPin: '1234',
            allowRetake: true,
            resultTimeout: 30,
            accentColor: '#7c3aed',
            autoFullscreen: true,
            lockKiosk: false,
        };
    });

    useEffect(() => {
        localStorage.setItem('kiosk_general_settings', JSON.stringify(generalSettings));
    }, [generalSettings]);

    const handleSaveGeneral = () => {
        toast.success('Ajustes generales guardados');
    };
    useEffect(() => {
        localStorage.setItem('kiosk_camera_settings', JSON.stringify(cameraSettings));
    }, [cameraSettings]);

    // Fetch themes and events
    useEffect(() => {
        fetchAiThemes();
        fetchKioskEvents();
    }, []);

    const fetchKioskEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('kiosk_events')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setKioskEvents(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateKioskEvent = async () => {
        if (!newEvent.name || !newEvent.event_date) {
            toast.error("Nombre y fecha son obligatorios");
            return;
        }
        try {
            const { error } = await supabase.from('kiosk_events').insert([newEvent]);
            if (error) throw error;
            toast.success("Evento creado");
            setIsEventModalOpen(false);
            setNewEvent({ name: '', description: '', event_date: '' });
            fetchKioskEvents();
        } catch (err: any) {
            toast.error("Error al crear evento: " + err.message);
        }
    };

    const handleDeleteKioskEvent = async (id: string) => {
        if (!confirm('¿Eliminar este evento y todas sus fotos?')) return;
        try {
            const { error } = await supabase.from('kiosk_events').delete().eq('id', id);
            if (error) throw error;
            toast.success('Evento eliminado');
            fetchKioskEvents();
            if (selectedEvent?.id === id) setSelectedEvent(null);
        } catch (err: any) {
            toast.error('Error al eliminar: ' + err.message);
        }
    };

    const handleDownloadAll = async () => {
        if (!eventPhotos.length) {
            toast.error("No hay fotos para descargar");
            return;
        }
        toast.info(`Iniciando descarga de ${eventPhotos.length} fotos...`);
        for (let i = 0; i < eventPhotos.length; i++) {
            const photo = eventPhotos[i];
            const response = await fetch(photo.image_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `foto_${selectedEvent.name}_${i+1}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            await new Promise(r => setTimeout(r, 300));
        }
        toast.success("Descarga completada");
    };

    const openEventAlbum = async (event: any) => {
        setSelectedEvent(event);
        localStorage.setItem('kiosk_active_event_id', event.id);
        setIsLoadingPhotos(true);
        try {
            const { data, error } = await supabase
                .from('kiosk_photos')
                .select('*')
                .eq('kiosk_event_id', event.id)
                .order('created_at', { ascending: false });
            if (!error && data) setEventPhotos(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingPhotos(false);
        }
    };

    // Enumerate cameras
    useEffect(() => {
        const getCameras = async () => {
            try {
                // Request permission first to get labels
                await navigator.mediaDevices.getUserMedia({ video: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(device => device.kind === 'videoinput');
                setAvailableCameras(videoInputs);
                if (!cameraSettings.deviceId && videoInputs.length > 0) {
                    setCameraSettings((prev: any) => ({ ...prev, deviceId: videoInputs[0].deviceId }));
                }
            } catch (err) {
                console.error("Error accessing cameras:", err);
            }
        };
        getCameras();
    }, []);

    // Start live preview
    useEffect(() => {
        if (activeTab !== 'camera' || !previewVideoRef.current) return;

        let stream: MediaStream | null = null;
        const startPreview = async () => {
            try {
                const constraints: MediaStreamConstraints = {
                    video: cameraSettings.deviceId && cameraSettings.deviceId !== 'default'
                        ? { deviceId: { exact: cameraSettings.deviceId } }
                        : true
                };
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Preview error:", err);
            }
        };
        startPreview();

        return () => {
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, [activeTab, cameraSettings.deviceId]);

    useEffect(() => {
        fetchAiThemes();
    }, []);

    const fetchAiThemes = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_themes')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAiThemes(data || []);

            // Also fetch the current frame if it exists
            const { data: frameData } = supabase.storage
                .from('photos')
                .getPublicUrl('kiosk_frame.png');

            if (frameData && frameData.publicUrl) {
                // Frame URL is managed via selectedFrame state
            }
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
                    max_people: newTheme.max_people,
                    emoji: newTheme.emoji,
                    preview_url: publicUrl,
                    is_default: false
                }]);

            if (dbError) throw dbError;

            toast.success("¡Temática creada con éxito!");
            setNewTheme({ name: '', category: '', prompt: '', negative_prompt: '', max_people: 1, emoji: '🎨' });
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

    const handleSaveDesign = async () => {
        if (!frameFile) {
            toast.success("Apariencia guardada (sin cambios en el marco).");
            return;
        }

        setIsSavingDesign(true);
        try {
            // Overwrite the specific frame file
            const { error: uploadError } = await supabase.storage
                .from('photos')
                .upload('kiosk_frame.png', frameFile, {
                    upsert: true,
                    cacheControl: '0'
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('photos')
                .getPublicUrl('kiosk_frame.png');
            
            localStorage.setItem('kiosk_frame_url', publicUrl);
            setSelectedFrame(publicUrl);
            toast.success("¡Marco actualizado correctamente!");
            setFrameFile(null);
            fetchAiThemes(); // Re-fetches the url
        } catch (error: any) {
            console.error("Error saving frame:", error);
            toast.error("Error al guardar el marco: " + error.message);
        } finally {
            setIsSavingDesign(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 p-6 md:p-10 text-slate-100">
            <header className="max-w-6xl mx-auto flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/20 rounded-lg">
                        <Sparkles className="w-6 h-6 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Configuración del Kiosco IA</h1>
                        <p className="text-sm text-slate-400">Gestiona temáticas, fondos, impresiones y la galería IA.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" className="bg-slate-900 border-slate-800 text-slate-300 hover:text-white">
                        <Link to="/admin">
                            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio
                        </Link>
                    </Button>
                    <Button asChild className="bg-violet-600 hover:bg-violet-700 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                        <a href={`/kiosco${selectedEvent ? `?event=${selectedEvent.id}` : ''}`} target="_blank" rel="noreferrer">
                            <ExternalLink className="w-4 h-4 mr-2" /> Lanzar Kiosco (Pantalla Completa)
                        </a>
                    </Button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex gap-6">
                    <TabsList className="flex flex-col bg-slate-900 border border-slate-800 h-auto w-64 items-stretch p-2">
                        <TabsTrigger value="themes" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Sparkles className="w-4 h-4" /> Temáticas de IA
                        </TabsTrigger>
                        <TabsTrigger value="design" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Monitor className="w-4 h-4" /> Diseño y Marcos
                        </TabsTrigger>
                        <TabsTrigger value="camera" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Camera className="w-4 h-4" /> Cámara
                        </TabsTrigger>
                        <TabsTrigger value="albums" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <FolderOpen className="w-4 h-4" /> Álbumes / Eventos
                        </TabsTrigger>
                        <TabsTrigger value="printing" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Printer className="w-4 h-4" /> Impresoras
                        </TabsTrigger>
                        <TabsTrigger value="instagram" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Instagram className="w-4 h-4" /> Instagram
                        </TabsTrigger>
                        <TabsTrigger value="profiles" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Users className="w-4 h-4" /> Perfiles
                        </TabsTrigger>
                        <TabsTrigger value="settings" className="justify-start gap-2 data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400">
                            <Settings className="w-4 h-4" /> Ajustes Generales
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1">
                        <TabsContent value="themes" className="m-0 space-y-6">
                            {/* Create New Theme */}
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-lg text-white">Crear Nueva Temática</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Nombre del Estilo</Label>
                                            <Input
                                                placeholder="Ej: Guerrero Vikingo"
                                                className="bg-slate-950 border-slate-800 text-white"
                                                value={newTheme.name}
                                                onChange={(e) => setNewTheme({ ...newTheme, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Categoría</Label>
                                            <Input
                                                placeholder="Ej: deportes, fantasia, epocas..."
                                                className="bg-slate-950 border-slate-800 text-white"
                                                value={newTheme.category}
                                                onChange={(e) => setNewTheme({ ...newTheme, category: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Emoji</Label>
                                            <Input
                                                placeholder="Ej: 🎨, ⚔️, 🎭"
                                                className="bg-slate-950 border-slate-800 text-white"
                                                value={newTheme.emoji}
                                                onChange={(e) => setNewTheme({ ...newTheme, emoji: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-slate-300">Personas (1 o 2)</Label>
                                            <select
                                                className="w-full bg-slate-950 border border-slate-800 text-white rounded-md p-2 h-10"
                                                value={newTheme.max_people}
                                                onChange={(e) => setNewTheme({ ...newTheme, max_people: parseInt(e.target.value) })}
                                            >
                                                <option value={1}>1 Persona</option>
                                                <option value={2}>2 Personas</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2 col-span-full">
                                            <Label className="text-slate-300">Prompt de IA</Label>
                                            <textarea
                                                placeholder="portrait of a warrior in medieval armor..."
                                                className="w-full bg-slate-950 border-slate-800 text-white rounded-md p-3 min-h-[80px]"
                                                value={newTheme.prompt}
                                                onChange={(e) => setNewTheme({ ...newTheme, prompt: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-2 col-span-full border border-slate-800 rounded-lg p-4 bg-slate-950 flex items-center gap-4">
                                            <div className="flex-1">
                                                <Label className="text-slate-300">Imagen de Portada</Label>
                                                <Input
                                                    type="file"
                                                    accept="image/*"
                                                    className="mt-2 bg-slate-900 border-slate-700 text-slate-300"
                                                    onChange={(e) => setThemeFile(e.target.files?.[0] || null)}
                                                />
                                            </div>
                                            <Button
                                                onClick={handleCreateTheme}
                                                disabled={isUploadingTheme}
                                                className="bg-violet-600 hover:bg-violet-700 mt-6"
                                            >
                                                {isUploadingTheme ? 'Guardando...' : 'Agregar Temática'}
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* List Themes */}
                            <h3 className="text-xl font-bold text-white mt-8 mb-4">Temáticas Activas</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {aiThemes.map(theme => (
                                    <div key={theme.id} className="relative group bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-xl">
                                        {theme.preview_url || theme.cover_image_url ? (
                                            <img src={theme.preview_url || theme.cover_image_url} alt={theme.name} className="w-full aspect-[3/4] object-cover opacity-80 group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <div className="w-full aspect-[3/4] bg-slate-950 flex items-center justify-center text-4xl">{theme.emoji || '🎨'}</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-end p-4">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-violet-400 text-[10px] uppercase font-bold tracking-widest">{theme.category}</span>
                                                <span className="text-white/50 text-[10px]">{theme.max_people === 2 ? '👥' : '👤'}</span>
                                            </div>
                                            <h4 className="text-white font-bold leading-tight">{theme.emoji} {theme.name}</h4>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteTheme(theme.id)}
                                            className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="design" className="m-0 space-y-6">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-lg">Marco de Foto</CardTitle>
                                    <p className="text-sm text-slate-400 mt-1">Seleccioná el marco para Selfie Grupal y Retrato Mágico. El Modo Mundial usa su propio marco.</p>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { id: 'none',    label: 'Sin Marco',   url: 'none',               preview: null },
                                            { id: 'mundial', label: 'Mundial',     url: '/kiosk-marco-mundial.png', preview: '/kiosk-marco-mundial.png' },
                                            { id: 'marco1',  label: 'Marco 1',     url: '/kiosk-marco-1.png', preview: '/kiosk-marco-1.png' },
                                            { id: 'marco2',  label: 'Marco 2',     url: '/kiosk-marco-2.png', preview: '/kiosk-marco-2.png' },
                                            { id: 'marco4',  label: 'Marco 4',     url: '/kiosk-marco-4.png', preview: '/kiosk-marco-4.png' },
                                            { id: 'custom',  label: 'Personalizado (Subir)', url: 'custom', preview: null },
                                        ].map(f => {
                                            const isSelected = selectedFrame === f.url || (f.id === 'custom' && selectedFrame?.startsWith('data:'));
                                            return (
                                                <button
                                                    key={f.id}
                                                    onClick={() => {
                                                        if (f.id === 'custom') {
                                                            document.getElementById('frame-upload')?.click();
                                                        } else {
                                                            setSelectedFrame(f.url);
                                                            localStorage.setItem('kiosk_frame_url', f.url);
                                                            toast.success(`Marco "${f.label}" seleccionado`);
                                                        }
                                                    }}
                                                    className={`relative rounded-2xl overflow-hidden border-2 transition-all ${
                                                        isSelected ? 'border-violet-500 ring-2 ring-violet-500/40' : 'border-slate-700 hover:border-slate-500'
                                                    }`}
                                                    style={{ aspectRatio: '3/4', background: '#0a0a1a' }}
                                                >
                                                    {f.id === 'custom' && selectedFrame?.startsWith('data:') && (
                                                        <img src={selectedFrame} alt="Custom" className="absolute inset-0 w-full h-full object-contain" />
                                                    )}
                                                    {f.preview ? (
                                                        <img src={f.preview} alt={f.label} className="absolute inset-0 w-full h-full object-contain" />
                                                    ) : (
                                                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                                            <span className="text-3xl">&#128683;</span>
                                                            <span className="text-slate-400 text-xs">Sin Marco</span>
                                                        </div>
                                                    )}
                                                    {isSelected && (
                                                        <div className="absolute top-2 right-2 bg-violet-500 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold">&#10003;</div>
                                                    )}
                                                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-center py-2">
                                                        <span className="text-white text-xs font-medium">{f.label}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <div className="pt-4 border-t border-slate-800 space-y-3">
                                        <Label className="text-slate-300 text-sm">Subir marco personalizado (PNG transparente)</Label>
                                        <Input type="file" accept="image/png" className="bg-slate-950 border-slate-800 text-slate-300" onChange={(e) => setFrameFile(e.target.files?.[0] || null)} />
                                        {frameFile && (
                                            <Button onClick={handleSaveDesign} disabled={isSavingDesign} className="bg-violet-600 hover:bg-violet-700 w-full">
                                                {isSavingDesign ? 'Subiendo...' : 'Subir Marco Personalizado'}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="camera" className="m-0 space-y-6">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-lg">Vista Previa de la Cámara</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-8">
                                    <p className="text-sm text-slate-400 -mt-4">
                                        Configura el dispositivo, ángulo de rotación y aspecto. Estos ajustes se guardan automáticamente en este equipo.
                                    </p>

                                    {/* CAMERA SELECTION */}
                                    <div className="space-y-3">
                                        <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Cámara</Label>
                                        <select
                                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white appearance-none focus:outline-none focus:border-violet-500"
                                            value={cameraSettings.deviceId}
                                            onChange={(e) => setCameraSettings({...cameraSettings, deviceId: e.target.value})}
                                        >
                                            <option value="default">Cámara Predeterminada</option>
                                            {availableCameras.map(cam => (
                                                <option key={cam.deviceId} value={cam.deviceId}>{cam.label || `Cámara Desconocida`}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* ROTATION */}
                                    <div className="space-y-3">
                                        <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Ángulo de Rotación</Label>
                                        <div className="grid grid-cols-4 gap-4">
                                            {[0, 90, 180, 270].map(rot => (
                                                <Button
                                                    key={rot}
                                                    variant="outline"
                                                    onClick={() => setCameraSettings({...cameraSettings, rotation: rot})}
                                                    className={`py-6 ${cameraSettings.rotation === rot ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                                >
                                                    {rot}°
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ORIENTATION */}
                                    <div className="space-y-3">
                                        <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Orientación de Foto</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCameraSettings({...cameraSettings, orientation: 'vertical'})}
                                                className={`py-10 flex flex-col gap-2 ${cameraSettings.orientation === 'vertical' ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                            >
                                                <div className="w-4 h-8 border-2 border-current rounded-sm"></div>
                                                Vertical (9:16)
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setCameraSettings({...cameraSettings, orientation: 'horizontal'})}
                                                className={`py-10 flex flex-col gap-2 ${cameraSettings.orientation === 'horizontal' ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                            >
                                                <div className="w-8 h-4 border-2 border-current rounded-sm"></div>
                                                Horizontal (16:9)
                                            </Button>
                                        </div>
                                    </div>

                                    {/* TIMER */}
                                    <div className="space-y-3">
                                        <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Temporizador</Label>
                                        <div className="grid grid-cols-4 gap-4">
                                            {[3, 5, 7, 10].map(time => (
                                                <Button
                                                    key={time}
                                                    variant="outline"
                                                    onClick={() => setCameraSettings({...cameraSettings, timer: time})}
                                                    className={`py-6 flex gap-2 ${cameraSettings.timer === time ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                                >
                                                    <Camera className="w-4 h-4" /> {time}s
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* MIRROR VIEW */}
                                    <div className="space-y-3">
                                        <Label className="text-slate-300 text-xs font-bold uppercase tracking-wider">Vista en Espejo</Label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                variant="outline"
                                                onClick={() => setCameraSettings({...cameraSettings, mirror: false})}
                                                className={`py-4 ${!cameraSettings.mirror ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                            >
                                                Desactivado
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => setCameraSettings({...cameraSettings, mirror: true})}
                                                className={`py-4 ${cameraSettings.mirror ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                            >
                                                Activado
                                            </Button>
                                        </div>
                                    </div>

                                    {/* LIVE PREVIEW */}
                                    <div className="border border-slate-800 rounded-xl bg-black p-4 flex flex-col items-center justify-center mt-8">
                                        <p className="text-slate-500 text-xs uppercase tracking-widest mb-4">Vista en vivo</p>
                                        <div className="relative w-full max-w-xs overflow-hidden rounded-lg bg-slate-900"
                                            style={{ aspectRatio: cameraSettings.orientation === 'vertical' ? '9/16' : '16/9' }}>
                                            <video
                                                ref={previewVideoRef}
                                                autoPlay
                                                playsInline
                                                muted
                                                className="w-full h-full object-cover"
                                                style={{ transform: `rotate(${cameraSettings.rotation}deg) scaleX(${cameraSettings.mirror ? -1 : 1})` }}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => {
                                            localStorage.setItem('kiosk_camera_settings', JSON.stringify(cameraSettings));
                                            toast.success('Configuración de cámara guardada');
                                        }}
                                        className="bg-violet-600 hover:bg-violet-700 w-full"
                                    >
                                        Guardar Configuración de Cámara
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="albums" className="m-0 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-white">Eventos y Álbumes</h3>
                                <Button onClick={() => setIsEventModalOpen(true)} className="bg-violet-600 hover:bg-violet-700">
                                    <Plus className="w-4 h-4 mr-2" /> Nuevo Evento
                                </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Event List */}
                                <div className="md:col-span-1 space-y-4">
                                    {kioskEvents.map(event => (
                                        <Card 
                                            key={event.id} 
                                            className={`cursor-pointer transition-all border-slate-800 ${selectedEvent?.id === event.id ? 'bg-violet-600/20 border-violet-500' : 'bg-slate-900 hover:bg-slate-800'}`}
                                            onClick={() => openEventAlbum(event)}
                                        >
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div>
                                                    <h4 className="text-white font-bold">{event.name}</h4>
                                                    <p className="text-slate-400 text-xs">{new Date(event.event_date).toLocaleDateString()}</p>
                                                </div>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteKioskEvent(event.id); }}
                                                    className="text-slate-500 hover:text-red-400 p-2"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* Photos Grid */}
                                <div className="md:col-span-2">
                                    {selectedEvent ? (
                                        <Card className="bg-slate-900 border-slate-800 h-full">
                                            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800">
                                                <div>
                                                    <CardTitle className="text-lg">Fotos de {selectedEvent.name}</CardTitle>
                                                    <span className="text-slate-400 text-xs">{eventPhotos.length} fotos capturadas</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button asChild size="sm" className="bg-violet-600 hover:bg-violet-700">
                                                        <a href={`/kiosco?event=${selectedEvent.id}`} target="_blank" rel="noreferrer">
                                                            <Monitor className="w-4 h-4 mr-2" /> Iniciar Kiosco
                                                        </a>
                                                    </Button>
                                                    <Button onClick={handleDownloadAll} variant="outline" size="sm" className="bg-slate-950 border-slate-800">
                                                        <Download className="w-4 h-4 mr-2" /> Descargar Todo
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6">
                                                {isLoadingPhotos ? (
                                                    <div className="flex items-center justify-center py-20">
                                                        <RefreshCw className="w-8 h-8 text-violet-500 animate-spin" />
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                                        {eventPhotos.map(photo => (
                                                            <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group border border-slate-800">
                                                                <img src={photo.image_url} className="w-full h-full object-cover" alt="Kiosk" />
                                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                    <a href={photo.image_url} target="_blank" rel="noreferrer" className="p-2 bg-white/20 rounded-full hover:bg-white/40">
                                                                        <ExternalLink className="w-4 h-4 text-white" />
                                                                    </a>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <div className="h-full border-2 border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center p-12 text-center">
                                            <FolderOpen className="w-12 h-12 text-slate-700 mb-4" />
                                            <h4 className="text-slate-400 font-medium">Seleccioná un evento para ver las fotos</h4>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Nuevo Evento */}
                            <Modal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} title="Crear Nuevo Evento">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Nombre del Evento</Label>
                                        <Input 
                                            value={newEvent.name} 
                                            onChange={(e) => setNewEvent({...newEvent, name: e.target.value})}
                                            placeholder="Boda de Ana y Juan"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha</Label>
                                        <Input 
                                            type="date"
                                            value={newEvent.event_date} 
                                            onChange={(e) => setNewEvent({...newEvent, event_date: e.target.value})}
                                        />
                                    </div>
                                    <div className="flex gap-3 mt-6">
                                        <Button variant="outline" onClick={() => setIsEventModalOpen(false)} className="flex-1">Cancelar</Button>
                                        <Button onClick={handleCreateKioskEvent} className="flex-1 bg-violet-600 hover:bg-violet-700">Crear Evento</Button>
                                    </div>
                                </div>
                            </Modal>
                        </TabsContent>

                        <TabsContent value="printing" className="m-0">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                                {/* LEFT: CALIBRATION */}
                                <div className="lg:col-span-7 space-y-6">
                                    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                                        <CardHeader>
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-violet-400 mb-1">Print Test</p>
                                            <CardTitle className="text-2xl font-bold text-white">Calibración de impresoras</CardTitle>
                                            <p className="text-sm text-slate-400">Selecciona la impresora disponible para comprobar que la integración funciona antes de iniciar el evento.</p>
                                        </CardHeader>
                                        <CardContent className="space-y-8">
                                            {/* ACTIVE PRINTER */}
                                            <div className="space-y-3">
                                                <Label className="text-slate-300 text-[10px] uppercase font-bold tracking-wider">Impresora Activa</Label>
                                                <div className="flex gap-3">
                                                    <select 
                                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white appearance-none focus:ring-2 focus:ring-violet-500/20 outline-none"
                                                        value={printerSettings.selectedPrinter}
                                                        onChange={(e) => setPrinterSettings({...printerSettings, selectedPrinter: e.target.value})}
                                                    >
                                                        <option value="">Seleccionar impresora...</option>
                                                        {availablePrinters.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                    <Button onClick={enumeratePrinters} disabled={isLoadingPrinters} className="bg-slate-800 hover:bg-slate-700 text-white uppercase text-xs font-bold px-6 py-6 rounded-xl">
                                                        {isLoadingPrinters ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Actualizar'}
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* PREFERENCES */}
                                            <div className="space-y-3">
                                                <Label className="text-slate-300 text-[10px] uppercase font-bold tracking-wider">Preferencias de Impresora</Label>
                                                <div className="flex gap-3">
                                                    <Button variant="outline" className="flex-1 bg-slate-950 border-slate-800 text-slate-400 py-6 rounded-xl flex items-center justify-center gap-2">
                                                        <RefreshCw className="w-4 h-4" /> Obteniendo preferencias...
                                                    </Button>
                                                    <Button variant="outline" className="flex-1 bg-slate-950 border-slate-800 text-slate-400 py-6 rounded-xl flex items-center justify-center gap-2">
                                                        <Settings className="w-4 h-4" /> Abrir preferencias
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* REMINDER */}
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-4">
                                                <AlertCircle className="w-6 h-6 text-blue-400 shrink-0" />
                                                <div className="space-y-1">
                                                    <p className="text-blue-400 font-bold text-sm">Recordatorio: Impresión sin márgenes</p>
                                                    <p className="text-slate-400 text-xs leading-relaxed">No olvides activar la opción "Sin márgenes" en las preferencias de la impresora. Si está desactivada, las fotos pueden salir más recortadas.</p>
                                                </div>
                                            </div>

                                            {/* PRINT LIMIT */}
                                            <div className="space-y-3 pt-4 border-t border-slate-800">
                                                <Label className="text-slate-300 text-[10px] uppercase font-bold tracking-wider">Límite de impresión por foto</Label>
                                                <Input 
                                                    type="number"
                                                    value={printerSettings.copies}
                                                    onChange={(e) => setPrinterSettings({...printerSettings, copies: parseInt(e.target.value) || 1})}
                                                    className="bg-slate-950 border-slate-800 text-white py-6 rounded-xl"
                                                />
                                                <p className="text-slate-500 text-xs">Establece cuántas veces se puede imprimir cada foto. 0 = no permitir imprimir.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* RIGHT: PREVIEW & ADJUSTS */}
                                <div className="lg:col-span-5 space-y-6">
                                    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                                        <CardHeader>
                                            <p className="text-[10px] uppercase font-bold tracking-widest text-violet-400 mb-1">Vista Previa</p>
                                            <CardTitle className="text-xl font-bold text-white">Ajustes de impresión</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            {/* PREVIEW IMAGE */}
                                            <div className="relative aspect-[3/2] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 group">
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <img src="/ai-themes/jugador-seleccion.jpg" className="w-full h-full object-cover opacity-40" />
                                                    {selectedFrame !== 'none' && <img src={selectedFrame} className="absolute inset-0 w-full h-full object-contain z-10" />}
                                                </div>
                                                <div className="absolute bottom-2 inset-x-0 text-center z-20">
                                                    <p className="text-[10px] text-white/50 uppercase tracking-widest">4" x 6" ({printerSettings.orientation})</p>
                                                </div>
                                            </div>

                                            {/* FRAME SELECTOR */}
                                            <div className="space-y-2">
                                                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Marco Actual</Label>
                                                <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl p-4">
                                                    <span className="text-white text-sm font-bold truncate">
                                                        {selectedFrame === 'none' ? 'Sin Marco' : (selectedFrame?.startsWith('data:') ? 'Personalizado' : (selectedFrame || 'Mundial'))}
                                                    </span>
                                                    <Button variant="outline" size="sm" onClick={() => document.getElementById('tab-design-trigger')?.click()} className="text-violet-400 border-violet-500/30">
                                                        Cambiar
                                                    </Button>
                                                </div>
                                            </div>

                                            {/* ORIENTATION */}
                                            <div className="space-y-2">
                                                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Orientación de impresión</Label>
                                                <Button 
                                                    onClick={() => setPrinterSettings({...printerSettings, orientation: printerSettings.orientation === 'portrait' ? 'landscape' : 'portrait'})}
                                                    className="w-full bg-slate-800 hover:bg-slate-700 text-white py-6 rounded-xl carlmarx-bold"
                                                >
                                                    {printerSettings.orientation === 'portrait' ? 'Vertical (Portrait)' : 'Horizontal (Landscape)'}
                                                </Button>
                                                <p className="text-[10px] text-slate-500 text-center">Se usa la orientación configurada en la impresora</p>
                                            </div>

                                            {/* IMAGE ADJUST */}
                                            <div className="space-y-2">
                                                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Ajuste de imagen</Label>
                                                <select 
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white appearance-none outline-none"
                                                    value={printerSettings.imageAdjust}
                                                    onChange={(e) => setPrinterSettings({...printerSettings, imageAdjust: e.target.value})}
                                                >
                                                    {IMAGE_ADJUSTMENTS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                                </select>
                                            </div>

                                            {/* ROTATION */}
                                            <div className="space-y-2">
                                                <Label className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Rotación de imagen</Label>
                                                <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
                                                    <Button variant="ghost" className="flex-1 text-slate-500 text-xs py-1"><RefreshCw className="w-3 h-3 mr-1" /> Rotar</Button>
                                                    {[0, 90, 180, 270].map(r => (
                                                        <Button 
                                                            key={r}
                                                            onClick={() => setPrinterSettings({...printerSettings, rotation: r})}
                                                            className={`w-10 h-10 rounded-lg text-xs font-bold ${printerSettings.rotation === r ? 'bg-violet-600 text-white' : 'bg-transparent text-slate-500'}`}
                                                        >
                                                            {r}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <Button 
                                                onClick={() => { localStorage.setItem('kiosk_print_settings', JSON.stringify(printerSettings)); toast.success('Configuración guardada'); }}
                                                className="w-full bg-violet-600 hover:bg-violet-700 text-white py-8 rounded-2xl carlmarx-bold text-lg shadow-lg shadow-violet-500/20"
                                            >
                                                Guardar Cambios
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="instagram" className="m-0 space-y-6">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader><CardTitle className="text-lg">Compartir en Instagram (QR)</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-slate-300">Hashtag del Evento</Label>
                                                <Input 
                                                    value={igSettings.hashtag} 
                                                    onChange={(e) => setIgSettings({...igSettings, hashtag: e.target.value})}
                                                    placeholder="#BodaAnaYJuan2024"
                                                    className="bg-slate-950 border-slate-800"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-300">URL Personalizada (Opcional)</Label>
                                                <Input 
                                                    value={igSettings.shareUrl} 
                                                    onChange={(e) => setIgSettings({...igSettings, shareUrl: e.target.value})}
                                                    placeholder="https://linktr.ee/evento"
                                                    className="bg-slate-950 border-slate-800"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-300">Mensaje junto al QR</Label>
                                                <Input 
                                                    value={igSettings.qrMessage} 
                                                    onChange={(e) => setIgSettings({...igSettings, qrMessage: e.target.value})}
                                                    className="bg-slate-950 border-slate-800"
                                                />
                                            </div>
                                            <div className="flex items-center gap-3 py-2">
                                                <input 
                                                    type="checkbox" 
                                                    checked={igSettings.showQrOnResult} 
                                                    onChange={(e) => setIgSettings({...igSettings, showQrOnResult: e.target.checked})}
                                                    className="w-5 h-5 accent-violet-500"
                                                />
                                                <Label>Mostrar QR automáticamente al finalizar</Label>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Button onClick={generateIgQr} className="bg-violet-600 hover:bg-violet-700">
                                                    Generar QR
                                                </Button>
                                                <Button 
                                                    variant="outline"
                                                    onClick={() => { localStorage.setItem('kiosk_ig_settings', JSON.stringify(igSettings)); toast.success('Guardado'); }}
                                                    className="border-slate-700 text-white"
                                                >
                                                    Guardar
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
                                            {igQrPreview ? (
                                                <>
                                                    <img src={igQrPreview} alt="QR" className="w-48 h-48 rounded-lg mb-4" />
                                                    <p className="text-slate-400 text-sm">{igSettings.qrMessage}</p>
                                                    <p className="text-violet-400 font-bold">{igSettings.hashtag}</p>
                                                </>
                                            ) : (
                                                <div className="text-slate-700">
                                                    <Instagram className="w-16 h-16 mx-auto mb-4 opacity-20" />
                                                    <p>Completa los datos para generar el QR</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="profiles" className="m-0 space-y-6">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader><CardTitle className="text-lg">Gestión de Perfiles</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <p className="text-sm text-slate-400">Guarda la configuración actual (cámara, impresión, instagram) para reutilizarla en otros eventos.</p>
                                    
                                    <div className="flex gap-4">
                                        <Input 
                                            value={newProfileName} 
                                            onChange={(e) => setNewProfileName(e.target.value)}
                                            placeholder="Nombre del perfil (ej: Boda Vertical, Corporativo 1...)"
                                            className="bg-slate-950 border-slate-800"
                                        />
                                        <Button onClick={saveProfile} className="bg-violet-600 hover:bg-violet-700">
                                            <Save className="w-4 h-4 mr-2" /> Guardar Actual
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                                        {profiles.map(p => (
                                            <Card key={p.id} className="bg-slate-950 border-slate-800">
                                                <CardContent className="p-4 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-white font-bold">{p.name}</h4>
                                                        <p className="text-slate-500 text-xs">Guardado: {new Date(p.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => loadProfile(p)} className="bg-slate-900 border-slate-800 text-xs">
                                                            Cargar
                                                        </Button>
                                                        <Button variant="outline" size="sm" onClick={() => deleteProfile(p.id)} className="bg-red-950 border-red-900 text-red-400 hover:bg-red-900 text-xs">
                                                            <Trash2 className="w-3 h-3" />
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="settings" className="m-0 space-y-6">
                            <Card className="bg-slate-900 border-slate-800">
                                <CardHeader><CardTitle className="text-lg">Ajustes del Kiosco</CardTitle></CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-slate-200 font-bold">Nombre del Kiosco</Label>
                                                <Input 
                                                    value={generalSettings.kioskName} 
                                                    onChange={(e) => setGeneralSettings({...generalSettings, kioskName: e.target.value})}
                                                    className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                                                    placeholder="Nombre descriptivo..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-200 font-bold">Título de Bienvenida</Label>
                                                <Input 
                                                    value={generalSettings.welcomeTitle} 
                                                    onChange={(e) => setGeneralSettings({...generalSettings, welcomeTitle: e.target.value})}
                                                    className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600"
                                                    placeholder="Toca para empezar..."
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-slate-200 font-bold">Tiempo de Inactividad (segundos)</Label>
                                                <Input 
                                                    type="number"
                                                    value={generalSettings.idleTimeout} 
                                                    onChange={(e) => setGeneralSettings({...generalSettings, idleTimeout: parseInt(e.target.value)})}
                                                    className="bg-slate-950 border-slate-800 text-white"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-slate-200 font-bold">Tiempo de Resultado (segundos)</Label>
                                                <Input 
                                                    type="number"
                                                    value={generalSettings.resultTimeout} 
                                                    onChange={(e) => setGeneralSettings({...generalSettings, resultTimeout: parseInt(e.target.value)})}
                                                    className="bg-slate-950 border-slate-800 text-white"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-slate-800 space-y-4">
                                        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                                            <div>
                                                <h4 className="text-white font-medium">Pantalla Completa Automática</h4>
                                                <p className="text-slate-500 text-sm">Abrir el kiosco maximizado automáticamente</p>
                                            </div>
                                            <input 
                                                type="checkbox" 
                                                checked={generalSettings.autoFullscreen} 
                                                onChange={(e) => setGeneralSettings({...generalSettings, autoFullscreen: e.target.checked})}
                                                className="w-6 h-6 accent-violet-500"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-slate-950 rounded-xl border border-slate-800">
                                            <div>
                                                <h4 className="text-white font-medium">Modo de Bloqueo de Kiosco</h4>
                                                <p className="text-slate-500 text-sm">Evita que se cierre la aplicación sin el PIN</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Input 
                                                    placeholder="PIN" 
                                                    className="w-20 bg-slate-900 border-slate-700 text-center h-10" 
                                                    value={generalSettings.adminPin}
                                                    onChange={(e) => setGeneralSettings({...generalSettings, adminPin: e.target.value})}
                                                />
                                                <input 
                                                    type="checkbox" 
                                                    checked={generalSettings.lockKiosk} 
                                                    onChange={(e) => setGeneralSettings({...generalSettings, lockKiosk: e.target.checked})}
                                                    className="w-6 h-6 accent-violet-500"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between p-4 bg-red-950/20 rounded-xl border border-red-900/30">
                                            <div>
                                                <h4 className="text-red-400 font-medium">Zona de Peligro</h4>
                                                <p className="text-red-900/60 text-sm">Borrar todos los ajustes locales de este equipo</p>
                                            </div>
                                            <Button 
                                                onClick={() => { if(confirm('¿Borrar todo?')) { localStorage.clear(); window.location.reload(); } }}
                                                className="bg-red-600 hover:bg-red-700 text-white"
                                            >Reiniciar App</Button>
                                        </div>
                                    </div>

                                    <Button onClick={handleSaveGeneral} className="w-full bg-violet-600 hover:bg-violet-700">
                                        Guardar Ajustes Generales
                                    </Button>
                                </CardContent>
                            </Card>
                        </TabsContent>


                    </div>
                    </Tabs>
                </main>
            </div>
    );
};

export default KioskManager;
