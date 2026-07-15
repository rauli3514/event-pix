-- Create Kiosk Events table
CREATE TABLE IF NOT EXISTS kiosk_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    event_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Kiosk Photos table
CREATE TABLE IF NOT EXISTS kiosk_photos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kiosk_event_id UUID REFERENCES kiosk_events(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Allow public access for Kiosk operations (since kiosk runs anonymously)
ALTER TABLE kiosk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE kiosk_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read kiosk events" ON kiosk_events FOR SELECT USING (true);
CREATE POLICY "Allow public insert kiosk events" ON kiosk_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update kiosk events" ON kiosk_events FOR UPDATE USING (true);
CREATE POLICY "Allow public delete kiosk events" ON kiosk_events FOR DELETE USING (true);

CREATE POLICY "Allow public read kiosk photos" ON kiosk_photos FOR SELECT USING (true);
CREATE POLICY "Allow public insert kiosk photos" ON kiosk_photos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public delete kiosk photos" ON kiosk_photos FOR DELETE USING (true);
