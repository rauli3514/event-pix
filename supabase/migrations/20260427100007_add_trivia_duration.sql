-- Migration to add individual duration to trivia questions

ALTER TABLE public.trivia_questions ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 10;
