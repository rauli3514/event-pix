import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DisplayMedia } from '@/types/display';


export const useDisplayMedia = (commerceId?: string) => {
    return useQuery({
        queryKey: ['display_media', commerceId],
        queryFn: async () => {
            if (!commerceId) return [];
            
            const { data, error } = await supabase
                .from('display_media')
                .select('*')
                .eq('commerce_id', commerceId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as DisplayMedia[];
        },
        enabled: !!commerceId
    });
};

export const useUploadDisplayMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ commerceId, file }: { commerceId: string; file: File }) => {
            // 1. Determine file type classification
            let type = 'docs';
            if (file.type.startsWith('image/')) type = 'image';
            else if (file.type.startsWith('video/')) type = 'video';
            else if (file.type.startsWith('audio/')) type = 'audio';

            // 2. Generate unique storage path
            const fileExt = file.name.split('.').pop();
            const uniqueFilename = `${crypto.randomUUID()}.${fileExt}`;
            const storagePath = `${commerceId}/${uniqueFilename}`;

            // 3. Upload to Supabase Storage bucket 'display-media'
            const { error: uploadError } = await supabase.storage
                .from('display-media')
                .upload(storagePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // 4. Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('display-media')
                .getPublicUrl(storagePath);

            // 5. Insert metadata record into display_media table
            const { data: mediaRecord, error: dbError } = await supabase
                .from('display_media')
                .insert({
                    commerce_id: commerceId,
                    name: file.name,
                    type: type,
                    url: publicUrl,
                    storage_path: storagePath,
                    size_bytes: file.size
                })
                .select()
                .single();

            if (dbError) {
                // Rollback upload if db insert fails
                await supabase.storage.from('display-media').remove([storagePath]);
                throw dbError;
            }

            return mediaRecord as DisplayMedia;
        },
        onSuccess: (_, { commerceId }) => {
            queryClient.invalidateQueries({ queryKey: ['display_media', commerceId] });
        }
    });
};

export const useDeleteDisplayMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (media: DisplayMedia) => {
            // 1. Delete from storage
            const { error: storageError } = await supabase.storage
                .from('display-media')
                .remove([media.storage_path]);
                
            if (storageError) throw storageError;

            // 2. Delete from DB
            const { error: dbError } = await supabase
                .from('display_media')
                .delete()
                .eq('id', media.id);

            if (dbError) throw dbError;
        },
        onSuccess: (_, media) => {
            queryClient.invalidateQueries({ queryKey: ['display_media', media.commerce_id] });
        }
    });
};
