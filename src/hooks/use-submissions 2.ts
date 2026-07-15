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
            console.log("createSubmission started", newSubmission);
            toast.info("Iniciando carga...");

            // ... (checks) ...

            if (!eventId) throw new Error("No event ID provided");

            let contentUrl = newSubmission.content;

            if ((newSubmission.type === 'photo' || newSubmission.type === 'audio') && newSubmission.file) {
                // Hard limit check (Safety net)
                const MAX_SIZE = 15 * 1024 * 1024;
                if (newSubmission.file.size > MAX_SIZE) {
                    throw new Error(`El archivo es demasiado pesado (>${MAX_SIZE / 1024 / 1024}MB).`);
                }

                const folder = newSubmission.type === 'audio' ? 'audios' : 'photos';
                const fileName = `${folder}/${Date.now()}-${newSubmission.file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('photos')
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

            // 1. Insert via RPC
            let insertedId;
            try {
                const { data, error: insertError } = await supabase.rpc('submit_photo', {
                    p_event_id: eventId,
                    p_content: contentUrl,
                    p_type: newSubmission.type,
                    p_author: newSubmission.author
                });
                if (insertError) throw insertError;
                insertedId = data;
            } catch (err: any) {
                console.error("RPC Error:", err);
                toast.error(`Error al guardar en BD: ${err.message}`);
                throw err;
            }

            if (!insertedId) throw new Error("No ID returned from submission");

            // Reconstruct Key (Obfuscation: Base64)
            const apiKey = import.meta.env.VITE_OPENAI_KEY_B64 ? atob(import.meta.env.VITE_OPENAI_KEY_B64) : '';

            // 2. AI Moderation Flow
            if (aiEnabled && apiKey && (newSubmission.type === 'photo' || newSubmission.type === 'message')) {
                const level = settings?.ai_moderation_level || 'medium';

                // SYSTEM PROMPT Construction (STRICTER)
                const systemPrompt = "You are a Content Moderator for a public family event. Censor ANY content that is inappropriate for children or grandparents. Output ONLY valid JSON: { \"safe\": boolean, \"reason\": string }.";

                let criteria = "";
                if (level === 'low') {
                    criteria = "ALLOW: People having fun, drinking (moderately), funny faces, beachwear. BLOCK: Explicit nudity, sexual acts, heavy gore, hate symbols.";
                } else if (level === 'high') {
                    criteria = "STRICT MODE. BLOCK: 1. Alcohol (bottles/glasses). 2. Drugs/Smoking. 3. Partial nudity/Cleavage/Swimwear (unless beach). 4. Intimate/Sexual poses. 5. Rude gestures (middle finger). 6. Suggestive expressions.";
                } else {
                    criteria = "STANDARD MODE. BLOCK: Nudity, Drugs, Violence, Hate Symbols, Middle Fingers, Highly Sexualized poses. ALLOW: Alcohol in moderation, innocent kissing.";
                }

                const finalPrompt = `CRITERIA: ${criteria}. If unsure, REJECT. If prohibited items present, "safe": false.`;

                toast.info("Analizando con IA...");

                // Helper to convert File to Base64
                const fileToBase64 = (file: File): Promise<string> => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.readAsDataURL(file);
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = error => reject(error);
                    });
                };

                // Non-blocking check
                (async () => {
                    try {
                        let isSafe = false; // Default to FALSE
                        let reason = "Analysis failed";

                        if (newSubmission.type === 'message') {
                            // ... existing message logic ...
                            const res = await fetch('https://api.openai.com/v1/moderations', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({ input: contentUrl })
                            });
                            if (!res.ok) throw new Error(`OpenAI Error: ${res.status}`);
                            const data = await res.json();
                            if (data.results) {
                                isSafe = !data.results[0].flagged;
                                reason = isSafe ? "Safe text" : ("Flagged: " + Object.keys(data.results[0].categories).filter(k => data.results[0].categories[k]).join(', '));
                            }
                        } else {
                            // PHOTO LOGIC
                            let imageUrlToSend = contentUrl;

                            // Try to use Base64 if file is available (More robust than URL)
                            if (newSubmission.file) {
                                try {
                                    imageUrlToSend = await fileToBase64(newSubmission.file);
                                    console.log("Using Base64 for AI Analysis (Size: " + imageUrlToSend.length + ")");
                                } catch (e) {
                                    console.error("Base64 conversion failed, falling back to URL");
                                }
                            }

                            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: "gpt-4o-mini",
                                    messages: [
                                        { role: "system", content: systemPrompt },
                                        {
                                            role: "user",
                                            content: [
                                                { type: "text", text: finalPrompt },
                                                { type: "image_url", image_url: { url: imageUrlToSend } }
                                            ]
                                        }
                                    ],
                                    max_tokens: 300,
                                    temperature: 0.1
                                })
                            });

                            if (!res.ok) {
                                const errData = await res.json().catch(() => ({}));
                                throw new Error(errData.error?.message || `OpenAI Error: ${res.status}`);
                            }

                            const data = await res.json();
                            console.log("AI Response:", data);

                            if (data.choices && data.choices[0]?.message?.content) {
                                const content = data.choices[0].message.content;
                                // Clean up markdown code blocks if present ```json ... ```
                                const cleanContent = content.replace(/```json/g, '').replace(/```/g, '');
                                const jsonStart = cleanContent.indexOf('{');
                                const jsonEnd = cleanContent.lastIndexOf('}');

                                if (jsonStart !== -1 && jsonEnd !== -1) {
                                    const jsonStr = cleanContent.substring(jsonStart, jsonEnd + 1);
                                    try {
                                        const analysis = JSON.parse(jsonStr);
                                        isSafe = analysis.safe;
                                        reason = analysis.reason || "No reason given";
                                        console.log("AI Analysis:", analysis);
                                    } catch (e) {
                                        console.error("Failed to parse AI JSON:", jsonStr);
                                        reason = "JSON Parse Error";
                                        isSafe = false;
                                    }
                                } else {
                                    reason = "Invalid JSON Format";
                                    isSafe = false;
                                }
                            }
                        }

                        if (isSafe) {
                            // Call RPC to approve (Security by UUID knowledge)
                            const { error: updateError } = await supabase.rpc('ai_approve_submission', {
                                p_submission_id: insertedId
                            });

                            if (updateError) {
                                console.error("Error updating status:", updateError);
                                toast.error("Error BD al aprobar: " + updateError.message);
                            } else {
                                toast.success(`¡Aprobado! (${reason})`);
                                // Invalidate to show in public wall immediately
                                queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
                            }
                        } else {
                            const modeLabel = level === 'high' ? 'Estricto' : level === 'low' ? 'Bajo' : 'Medio';
                            toast.warning(`Rechazado IA (${modeLabel}): ${reason}`);
                        }
                    } catch (err: any) {
                        console.error("AI Auto-Moderation Failed:", err);

                        let friendluError = `Fallo IA: ${err.message}`;
                        if (err.message.includes('quota') || err.message.includes('billing')) {
                            friendluError = "⚠️ IA Pausada: Sin crédito en OpenAI. La foto requiere aprobación manual.";
                        } else if (err.message.includes('context_length')) {
                            friendluError = "⚠️ Foto muy grande para la IA. Aprobación manual requerida.";
                        }

                        toast.error(friendluError, { duration: 5000 });
                    }
                })();

            } else {  // Manual mode (AI disabled or no key)
                if (!aiEnabled) toast.info("Moderación manual (Configuración)");
                else if (!apiKey) toast.error("Error: Falta API Key de OpenAI");
            }

            return contentUrl;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions', eventId] });
            toast.success('Enviado con éxito! Pendiente de aprobación.');
        },
        onError: (error) => {
            console.error(error);
            toast.error(`Error al enviar: ${error.message || 'Desconocido'}`);
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
