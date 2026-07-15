-- Allow TVs to read their assignments and campaigns anonymously
CREATE POLICY "Anon can read assignments" ON public.display_assignments FOR SELECT USING (true);
CREATE POLICY "Anon can read campaigns" ON public.display_campaigns FOR SELECT USING (true);
