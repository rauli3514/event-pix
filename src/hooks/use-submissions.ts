import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Submission, SubmissionStatus } from '@/types';
import { toast } from 'sonner';

const MOCK_SUBMISSIONS: Submission[] = [
    { id: '1', type: 'photo', content: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80', created_at: new Date(Date.now() - 1000 * 60 * 2).toISOString(), status: 'pending' },
    { id: '2', type: 'message', content: '¡Felicidades a los novios! 🎉', author: 'Tía María', created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), status: 'pending' },
    { id: '3', type: 'photo', content: 'https://images.unsplash.com/photo-1511285560982-1351cdeb9821?auto=format&fit=crop&q=80', created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(), status: 'approved' },
];

export const useSubmissions = () => {
    const queryClient = useQueryClient();

    const { data: submissions, isLoading } = useQuery({
        queryKey: ['submissions'],
        queryFn: async () => {
            const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!isConfigured || import.meta.env.VITE_SUPABASE_URL?.includes('your_supabase_url')) {
                console.log('Supabase not configured, using mock data');
                return MOCK_SUBMISSIONS;
            }

            const { data, error } = await supabase
                .from('submissions')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching submissions:', error);
                toast.error('Error al cargar las submisiones');
                throw error;
            }

            return data as Submission[];
        },
        refetchInterval: 5000, // Auto-refresh every 5 seconds
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
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
        },
        onError: () => {
            toast.error('Error al actualizar el estado');
        }
    });

    const createSubmission = useMutation({
        mutationFn: async (newSubmission: Omit<Submission, 'id' | 'created_at' | 'status'> & { file?: File }) => {
            const isConfigured = import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY;

            if (!isConfigured || import.meta.env.VITE_SUPABASE_URL?.includes('your_supabase_url')) {
                // Simulate success
                await new Promise(resolve => setTimeout(resolve, 1000)); // Fake delay
                return;
            }

            let contentUrl = newSubmission.content;

            if (newSubmission.type === 'photo' && newSubmission.file) {
                const fileName = `${Date.now()}-${newSubmission.file.name}`;
                const { error: uploadError } = await supabase.storage
                    .from('photos')
                    .upload(fileName, newSubmission.file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('photos')
                    .getPublicUrl(fileName);

                contentUrl = publicUrl;
            }

            const { error } = await supabase
                .from('submissions')
                .insert([{
                    type: newSubmission.type,
                    content: contentUrl,
                    author: newSubmission.author,
                    status: 'pending'
                }]);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
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
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
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
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            toast.success('Foto eliminada');
        },
        onError: () => {
            toast.error('Error al eliminar la foto');
        }
    });

    const deleteAllApproved = useMutation({
        mutationFn: async () => {
            const { error } = await supabase
                .from('submissions')
                .delete()
                .eq('status', 'approved');

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            toast.success('Contenido aprobado eliminado');
        },
        onError: () => {
            toast.error('Error al eliminar aprobados');
        }
    });

    const resetAll = useMutation({
        mutationFn: async () => {
            // Delete all submissions
            const { error } = await supabase
                .from('submissions')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            toast.success('Todo el contenido ha sido eliminado');
        },
        onError: () => {
            toast.error('Error al resetear todo');
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
        resetAll
    };
};
