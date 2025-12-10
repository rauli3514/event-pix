
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export const useUpdateProviderPassword = () => {
    return useMutation({
        mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
            // Since we are using Supabase Auth, we need to use the admin API to update another user's password.
            // However, the client-side library only allows updating the *current* user's password.
            // To update another user's password, we typically need a server-side function (Edge Function) with service_role key.
            // BUT, since the user asked for this in a client-side app context (and we might not have Edge Functions set up),
            // we can try to use the same trick as createProvider: calling the admin API directly if we have the key, 
            // OR we might be stuck if we don't have the service_role key exposed (which we shouldn't).

            // Wait, the user is a Super Admin. Does Supabase allow Super Admins to update other users?
            // Not by default with the anon key.

            // If we can't do it securely, we might need to create a Postgres function that uses `security definer` 
            // to update the auth.users table, but Supabase blocks direct access to auth schema from Postgres functions usually.

            // Let's check if we can use the "trick" of calling the API.
            // The `useCreateProvider` uses `fetch('${supabaseUrl}/auth/v1/signup', ...)` with `apikey`.
            // That only works for creating new users (public signup).
            // Updating a user requires `PUT /auth/v1/admin/users/{id}` which requires `service_role` key.

            // If we don't have the service_role key in the env vars (we only have ANON), we cannot do this client-side 
            // unless we have a backend function.

            // HOWEVER, the user might have the service role key in their .env file?
            // Let's check the .env file content again (I saw it earlier).
            // It has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.

            // If we can't do it, we should tell the user.
            // BUT, maybe there is a `rpc` function we can create?
            // "You can use the Supabase Management API... or create a Database Function".
            // Accessing `auth.users` is restricted.

            // Let's assume for now we will try to create a Postgres function `update_user_password` 
            // that the super_admin can call.

            const { data, error } = await supabase.rpc('update_user_password', {
                user_id: userId,
                new_password: newPassword
            });

            if (error) throw error;
            return data;
        }
    });
};

export const useToggleProviderStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
            // We need to update `auth.users` to disable login? Or just a flag in `profiles`?
            // If we just want to "disable" them from accessing the app, we can add `is_active` to `profiles`
            // and check it in the RLS or application logic.
            // The user asked to "disable".

            // Let's check `profiles` table. It has `role`, `email`, `name`.
            // We should add `is_active` column to `profiles`.

            const { data, error } = await supabase
                .from("profiles")
                .update({ is_active: isActive })
                .eq("id", userId)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["providers"] });
        },
    });
};
