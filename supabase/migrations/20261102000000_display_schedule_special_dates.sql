-- Display Digital: fechas especiales en la programación.
--
-- Una franja puede valer solo en una fecha o en varios días seguidos
-- (feriado, Navidad, un evento). En su horario le gana a la semana tipo.
-- Las franjas con fecha se guardan con days_of_week vacío: una TV que todavía
-- tenga la versión anterior las ignora en lugar de mostrarlas todas las semanas.
--
-- Se corre en el SQL Editor de Supabase (se puede correr más de una vez).

ALTER TABLE public.display_schedule_events ADD COLUMN IF NOT EXISTS date_from date;
ALTER TABLE public.display_schedule_events ADD COLUMN IF NOT EXISTS date_to date;
ALTER TABLE public.display_schedule_events ADD COLUMN IF NOT EXISTS label text;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'display_schedule_events_dates_check'
    ) THEN
        ALTER TABLE public.display_schedule_events
            ADD CONSTRAINT display_schedule_events_dates_check
            CHECK (date_to IS NULL OR (date_from IS NOT NULL AND date_to >= date_from));
    END IF;
END $$;
