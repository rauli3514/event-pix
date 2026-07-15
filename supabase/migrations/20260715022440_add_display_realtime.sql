-- Add display hub tables to supabase_realtime publication for instant sync
DO $$
BEGIN
    -- Enable realtime for display_campaigns
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'display_campaigns'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE display_campaigns;
    END IF;

    -- Enable realtime for display_assignments
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'display_assignments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE display_assignments;
    END IF;

    -- Enable realtime for display_media
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'display_media'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE display_media;
    END IF;

    -- Enable realtime for display_schedules
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'display_schedules'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE display_schedules;
    END IF;
END $$;
