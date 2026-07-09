import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, MessageCircleQuestion, BookOpen, TerminalSquare, Plus, Trash2, Save } from 'lucide-react';
import { useAIPersonality, useAIFaqs, useAIKnowledge, useAIPrompts } from '@/hooks/use-ai-knowledge';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function AIKnowledgeManager() {
    const { commerceId } = useParams();
    const queryClient = useQueryClient();

    const { data: personality, isLoading: pLoading } = useAIPersonality(commerceId);
    const { data: faqs, isLoading: fLoading } = useAIFaqs(commerceId);
    const { data: knowledge, isLoading: kLoading } = useAIKnowledge(commerceId);
    const { data: prompts, isLoading: prLoading } = useAIPrompts(commerceId);

    // --- PERSONALITY STATE ---
    const [pName, setPName] = useState('');
    const [pPrompt, setPPrompt] = useState('');
    const [pActive, setPActive] = useState(false);

    // Initialize personality state once loaded
    useState(() => {
        if (personality) {
            setPName(personality.name);
            setPPrompt(personality.system_prompt);
            setPActive(personality.is_active);
        }
    });

    const savePersonality = async () => {
        if (!commerceId) return;
        try {
            if (personality?.id) {
                const { error } = await supabase.from('ai_personality').update({
                    name: pName || 'Asistente IA',
                    system_prompt: pPrompt,
                    is_active: pActive
                }).eq('id', personality.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('ai_personality').insert({
                    commerce_id: commerceId,
                    name: pName || 'Asistente IA',
                    system_prompt: pPrompt,
                    is_active: pActive
                });
                if (error) throw error;
            }
            toast.success("Personalidad guardada correctamente");
            queryClient.invalidateQueries({ queryKey: ["ai_personality", commerceId] });
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // --- FAQ STATE ---
    const [newFaqQ, setNewFaqQ] = useState('');
    const [newFaqA, setNewFaqA] = useState('');

    const addFaq = async () => {
        if (!commerceId || !newFaqQ || !newFaqA) return;
        try {
            const { error } = await supabase.from('ai_faq').insert({
                commerce_id: commerceId,
                question: newFaqQ,
                answer: newFaqA
            });
            if (error) throw error;
            toast.success("FAQ agregada");
            setNewFaqQ('');
            setNewFaqA('');
            queryClient.invalidateQueries({ queryKey: ["ai_faq", commerceId] });
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const deleteFaq = async (id: string) => {
        try {
            const { error } = await supabase.from('ai_faq').delete().eq('id', id);
            if (error) throw error;
            toast.success("FAQ eliminada");
            queryClient.invalidateQueries({ queryKey: ["ai_faq", commerceId] });
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    // --- KNOWLEDGE STATE ---
    const [newKTitle, setNewKTitle] = useState('');
    const [newKContent, setNewKContent] = useState('');

    const addKnowledge = async () => {
        if (!commerceId || !newKTitle || !newKContent) return;
        try {
            const { error } = await supabase.from('ai_knowledge').insert({
                commerce_id: commerceId,
                title: newKTitle,
                content: newKContent
            });
            if (error) throw error;
            toast.success("Conocimiento agregado");
            setNewKTitle('');
            setNewKContent('');
            queryClient.invalidateQueries({ queryKey: ["ai_knowledge", commerceId] });
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const deleteKnowledge = async (id: string) => {
        try {
            const { error } = await supabase.from('ai_knowledge').delete().eq('id', id);
            if (error) throw error;
            toast.success("Conocimiento eliminado");
            queryClient.invalidateQueries({ queryKey: ["ai_knowledge", commerceId] });
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold font-[Orbitron] flex items-center gap-3">
                    <BrainCircuit className="w-8 h-8 text-indigo-500" />
                    Conocimiento IA
                </h1>
                <p className="text-muted-foreground mt-2">
                    Administra lo que sabe el Asistente IA de tu negocio. Agrega manuales, reglas y respuestas.
                </p>
            </div>

            <Tabs defaultValue="personality" className="w-full">
                <TabsList className="grid w-full md:w-auto grid-cols-2 md:grid-cols-4 mb-6">
                    <TabsTrigger value="personality" className="gap-2"><BrainCircuit className="w-4 h-4"/> Personalidad</TabsTrigger>
                    <TabsTrigger value="faqs" className="gap-2"><MessageCircleQuestion className="w-4 h-4"/> FAQs</TabsTrigger>
                    <TabsTrigger value="knowledge" className="gap-2"><BookOpen className="w-4 h-4"/> Documentación</TabsTrigger>
                    <TabsTrigger value="prompts" className="gap-2"><TerminalSquare className="w-4 h-4"/> Prompts</TabsTrigger>
                </TabsList>

                {/* PERSONALITY TAB */}
                <TabsContent value="personality">
                    <Card>
                        <CardHeader>
                            <CardTitle>Personalidad del Asistente</CardTitle>
                            <CardDescription>Define cómo debe comportarse, su tono y sus reglas inquebrantables.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre del Asistente</Label>
                                <Input 
                                    placeholder="Ej: Asistente Display Digital" 
                                    defaultValue={personality?.name}
                                    onChange={e => setPName(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Reglas Base (System Prompt)</Label>
                                <Textarea 
                                    placeholder="Ej: Eres un asistente técnico. Nunca des precios. Habla en tono formal." 
                                    className="min-h-[200px]"
                                    defaultValue={personality?.system_prompt}
                                    onChange={e => setPPrompt(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <Switch 
                                    id="active-personality" 
                                    defaultChecked={personality?.is_active}
                                    onCheckedChange={setPActive}
                                />
                                <Label htmlFor="active-personality">Activar Personalidad Customizada</Label>
                            </div>
                            <Button onClick={savePersonality} className="w-full sm:w-auto gap-2">
                                <Save className="w-4 h-4" /> Guardar Personalidad
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* FAQS TAB */}
                <TabsContent value="faqs" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agregar Pregunta Frecuente</CardTitle>
                            <CardDescription>Entrena a la IA con respuestas directas a preguntas comunes.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Pregunta</Label>
                                <Input value={newFaqQ} onChange={e => setNewFaqQ(e.target.value)} placeholder="Ej: ¿Cómo conecto un TvBox?" />
                            </div>
                            <div className="space-y-2">
                                <Label>Respuesta Exacta</Label>
                                <Textarea value={newFaqA} onChange={e => setNewFaqA(e.target.value)} placeholder="Ej: Usa un cable HDMI y conéctalo al puerto 1..." />
                            </div>
                            <Button onClick={addFaq} className="gap-2">
                                <Plus className="w-4 h-4" /> Agregar FAQ
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">FAQs Actuales</h3>
                        {fLoading ? <p>Cargando...</p> : faqs?.length === 0 ? <p className="text-muted-foreground">No hay FAQs cargadas.</p> : (
                            <div className="grid gap-4">
                                {faqs?.map((faq: any) => (
                                    <Card key={faq.id}>
                                        <CardContent className="p-4 flex justify-between items-start gap-4">
                                            <div>
                                                <h4 className="font-semibold">Q: {faq.question}</h4>
                                                <p className="text-sm text-muted-foreground mt-1">A: {faq.answer}</p>
                                            </div>
                                            <Button variant="destructive" size="icon" onClick={() => deleteFaq(faq.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* KNOWLEDGE TAB */}
                <TabsContent value="knowledge" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Agregar Documentación</CardTitle>
                            <CardDescription>Pega aquí tutoriales largos, guías de usuario o manuales técnicos.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Título del Documento</Label>
                                <Input value={newKTitle} onChange={e => setNewKTitle(e.target.value)} placeholder="Ej: Manual de Usuario TvPlayer 2.0" />
                            </div>
                            <div className="space-y-2">
                                <Label>Contenido del Documento</Label>
                                <Textarea value={newKContent} onChange={e => setNewKContent(e.target.value)} placeholder="Ej: Paso 1... Paso 2... El sistema de layouts funciona así..." className="min-h-[200px]" />
                            </div>
                            <Button onClick={addKnowledge} className="gap-2">
                                <Plus className="w-4 h-4" /> Agregar Documento
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg">Documentos Actuales</h3>
                        {kLoading ? <p>Cargando...</p> : knowledge?.length === 0 ? <p className="text-muted-foreground">No hay documentos cargados.</p> : (
                            <div className="grid gap-4">
                                {knowledge?.map((doc: any) => (
                                    <Card key={doc.id}>
                                        <CardContent className="p-4 flex justify-between items-start gap-4">
                                            <div>
                                                <h4 className="font-semibold">{doc.title}</h4>
                                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{doc.content}</p>
                                            </div>
                                            <Button variant="destructive" size="icon" onClick={() => deleteKnowledge(doc.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* PROMPTS TAB */}
                <TabsContent value="prompts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Plantillas de Prompts</CardTitle>
                            <CardDescription>En construcción. Aquí podrás crear atajos de mensajes para los usuarios.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Próximamente...</p>
                        </CardContent>
                    </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
}
