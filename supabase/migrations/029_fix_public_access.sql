-- Allow public access to read events (so guests can load the page)
DROP POLICY IF EXISTS "Public can view events" ON events;
CREATE POLICY "Public can view events"
    ON events FOR SELECT
    USING (true);

-- Allow public access to read event settings (so guests can see theme, etc)
DROP POLICY IF EXISTS "Public can view event settings" ON event_settings;
CREATE POLICY "Public can view event settings"
    ON event_settings FOR SELECT
    USING (true);
