import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Submission, SubmissionStatus } from '@/types';
import { toast } from 'sonner';

const MOCK_SUBMISSIONS: Submission[] = [
    { id: '1', type: 'photo', content: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80', created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(), status: 'pending' },
    { id: '2', type: 'message', content: '¡Felicidades a los novios! 🎉', author: 'Tía María', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), status: 'pending' },
    { id: '3', type: 'photo', content: 'https://images.unsplash.com/photo-1511285560982-1351cdeb9821?auto=format&fit=crop&q=80', created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), status: 'approved' },
];

export const useSubmissions = (eventId?: string) => {
    const queryClient = useQueryClient();

    const { data: submissions, isLoading } = useQuery({
        queryKey: ['submissions', eventId],
        queryFn: async () => {
            const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!isConfigured || import.meta.env.VITE_SUPABASE_URL?.includes('your_supabase_url')) {
                console.log('Supabase not configured, using mock data');
                return MOCK_SUBMISSIONS;
            }

            let query = supabase
                .from('submissions')
                .select('*')
                .order('created_at', { ascending: false });

            if (eventId) {
                query = query.eq('event_id', eventId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching submissions:', error);
                toast.error('Error al cargar las submisiones');
                throw error;
            }

            return data as Submission[];
        },
        refetchInterval: 5000,
        enabled: !!eventId || (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL?.includes('your_supabase_url')),
    });

    const updateStatus = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: SubmissionStatus }) => {
            const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;
            if (!isConfigured || import.meta.env.VITE_SUPABASE_URL?.includes('your_supabase_url')) {
                return;
            }

            const { error } = await supabase
                .from('submissions')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
        },
        onError: () => {
            toast.error('Error al actualizar el estado');
        }
    });

    const createSubmission = useMutation({
        mutationFn: async (newSubmission: Omit<Submission, 'id' | 'created_at' | 'status'> & { file?: File }) => {
            const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!isConfigured || import.meta.env.VITE_SUPABASE_URL?.includes('your_supabase_url')) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return;
            }

            if (!eventId) throw new Error("No event ID provided");

            let contentUrl = newSubmission.content;

            if ((newSubmission.type === 'photo' || newSubmission.type === 'audio') && newSubmission.file) {
                // Hard limit check (Safety net)
                // If compression worked, it should be small. If logic bypassed or audio, limit to 15MB.
                const MAX_SIZE = 15 * 1024 * 1024;
                if (newSubmission.file.size > MAX_SIZE) {
                    throw new Error(`El archivo es demasiado pesado (>${MAX_SIZE / 1024 / 1024}MB).`);
                }

                const folder = newSubmission.type === 'audio' ? 'audios' : 'photos';
                const fileName = `${folder}/${Date.now()}-${newSubmission.file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('photos') // Reutilizamos el bucket 'photos' pero organizamos en carpetas si es posible, o todo en root con prefijo
                    .upload(fileName, newSubmission.file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('photos')
                    .getPublicUrl(fileName);

                contentUrl = publicUrl;
            }

            const { data: settings } = await supabase
                .from('event_settings')
                .select('ai_moderation_enabled, ai_moderation_level')
                .eq('event_id', eventId)
                .maybeSingle();

            const aiEnabled = settings?.ai_moderation_enabled ?? false;
            let status = 'pending';

            // Audio is auto-approved unless we want to change that later
            if (newSubmission.type === 'audio') status = 'approved';

            const { data: inserted, error } = await supabase
                .from('submissions')
                .insert([{
                    type: newSubmission.type,
                    content: contentUrl,
                    author: newSubmission.author,
                    status: status,
                    event_id: eventId
                }])
                .select()
                .single();

            if (error) throw error;

            // Trigger Client-Side AI Moderation
            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

            if (aiEnabled && apiKey && (newSubmission.type === 'photo' || newSubmission.type === 'message') && inserted) {
                const level = settings?.ai_moderation_level || 'medium';
                let promptInstruction = "Answer JSON: { \"safe\": boolean, \"reason\": string }.";
                if (level === 'low') promptInstruction += " Be lenient. Only flag explicit nudity, sexual acts, or extreme gore.";
                else if (level === 'high') promptInstruction += " Be strict. Flag any partial nudity, excessive alcohol, or rude gestures.";
                else promptInstruction += " Standard moderation. Flag nudity, violence, hate symbols, and offensive content.";

                // Non-blocking check
                (async () => {
                    try {
                        let isSafe = true;

                        if (newSubmission.type === 'message') {
                            const res = await fetch('https://api.openai.com/v1/moderations', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ input: contentUrl })
                            });
                            const data = await res.json();
                            if (data.results) isSafe = !data.results[0].flagged;
                        } else {
                            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: "gpt-4o",
                                    messages: [{
                                        role: "user",
                                        content: [
                                            { type: "text", text: `Is this image appropriate for a family event? ${promptInstruction}` },
                                            { type: "image_url", image_url: { url: contentUrl } }
                                        ]
                                    }],
                                    max_tokens: 300
                                })
                            });
                            const data = await res.json();
                            if (data.choices) {
                                const jsonStr = data.choices[0].message.content.replace(/```json\n|\n```/g, '').trim();
                                const analysis = JSON.parse(jsonStr);
                                isSafe = analysis.safe;
                            }
                        }

                        if (isSafe) {
                            await supabase.from('submissions').update({ status: 'approved' }).eq('id', inserted.id);
                            toast.success("¡Aprobado automáticamente por IA!");
                        } else {
                            toast.info("Contenido en revisión (Filtro IA)");
                        }
                    } catch (err) {
                        console.error("AI Auto-Moderation Failed:", err);
                    }
                })();
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Enviado con éxito! Pendiente de aprobación.');
        },
        onError: (error) => {
            console.error(error);
            toast.error('Error al enviar');
        }
    });

    const toggleAlbum = useMutation({
        mutationFn: async ({ id, in_album }: { id: string; in_album: boolean }) => {
            const { error } = await supabase
                .from('submissions')
                .update({ in_album })
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Álbum actualizado');
        },
        onError: () => {
            toast.error('Error al actualizar el álbum');
        }
    });

    const deleteSubmission = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('submissions')
                .delete()
                .eq('id', id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Foto eliminada');
        },
        onError: () => {
            toast.error('Error al eliminar la foto');
        }
    });

    const deleteAllApproved = useMutation({
        mutationFn: async () => {
            if (!eventId) return;
            const { error } = await supabase
                .from('submissions')
                .delete()
                .eq('status', 'approved')
                .eq('event_id', eventId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Contenido aprobado eliminado');
        },
        onError: () => {
            toast.error('Error al eliminar aprobados');
        }
    });

    const resetAll = useMutation({
        mutationFn: async () => {
            if (!eventId) return;
            const { error } = await supabase
                .from('submissions')
                .delete()
                .eq('event_id', eventId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Todo el contenido ha sido eliminado');
        },
        onError: () => {
            toast.error('Error al resetear todo');
        }
    });

    const approveAllPending = useMutation({
        mutationFn: async () => {
            if (!eventId) return;
            const { error } = await supabase
                .from('submissions')
                .update({ status: 'approved' })
                .eq('status', 'pending')
                .eq('event_id', eventId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Todo el contenido pendiente ha sido aprobado');
        },
        onError: () => {
            toast.error('Error al aprobar todo');
        }
    });

    return {
        submissions: submissions || [],
        isLoading,
        updateStatus,
        createSubmission,
        toggleAlbum,
        deleteSubmission,
        deleteAllApproved,
        resetAll,
        approveAllPending
    };
};
