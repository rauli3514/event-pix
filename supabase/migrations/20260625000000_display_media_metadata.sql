-- Add metadata column to display_media table to support Apps and Layouts
ALTER TABLE public.display_media 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
