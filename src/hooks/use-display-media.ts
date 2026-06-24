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
        mutationFn: async ({ commerceId, file, webUrl, webName, folderPath = '/', isFolder = false }: { commerceId: string; file?: File; webUrl?: string; webName?: string; folderPath?: string; isFolder?: boolean }) => {
            let type = 'docs';
            let publicUrl = '';
            let storagePath = 'web_link';
            let name = webName || '';
            let size = 0;

            if (isFolder) {
                type = 'folder';
                name = webName || 'Nueva Carpeta';
            } else if (file) {
                if (file.type.startsWith('image/')) type = 'image';
                else if (file.type.startsWith('video/')) type = 'video';
                else if (file.type.startsWith('audio/')) type = 'audio';

                const fileExt = file.name.split('.').pop();
                const uniqueFilename = `${crypto.randomUUID()}.${fileExt}`;
                storagePath = `${commerceId}/${uniqueFilename}`;
                name = file.name;
                size = file.size;

                const { error: uploadError } = await supabase.storage
                    .from('display-media')
                    .upload(storagePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data } = supabase.storage
                    .from('display-media')
                    .getPublicUrl(storagePath);
                
                publicUrl = data.publicUrl;
            } else if (webUrl) {
                type = 'web';
                publicUrl = webUrl;
            } else {
                throw new Error("No file or web URL provided");
            }

            const { data: mediaRecord, error: dbError } = await supabase
                .from('display_media')
                .insert({
                    commerce_id: commerceId,
                    name: name,
                    type: type,
                    url: publicUrl,
                    storage_path: storagePath,
                    size_bytes: size,
                    folder_path: folderPath
                })
                .select()
                .single();

            if (dbError) {
                if (file) {
                    await supabase.storage.from('display-media').remove([storagePath]);
                }
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

export const useUpdateDisplayMedia = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: Partial<DisplayMedia> }) => {
            const { data, error } = await supabase
                .from('display_media')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return data as DisplayMedia;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['display_media', data.commerce_id] });
        }
    });
};
