
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
    console.log("Testing submit_photo RPC...");

    // 1. Get a valid event ID (any active event)
    const { data: events, error: eventError } = await supabase
        .from('events')
        .select('id')
        .eq('status', 'active')
        .limit(1);

    if (eventError || !events || events.length === 0) {
        console.error("Failed to find active event:", eventError);
        return;
    }

    const eventId = events[0].id;
    console.log("Using Event ID:", eventId);

    // 2. Call RPC
    const { data: submissionId, error: rpcError } = await supabase.rpc('submit_photo', {
        p_event_id: eventId,
        p_content: 'https://placehold.co/600x400',
        p_type: 'photo',
        p_author: 'Test Bot'
    });

    if (rpcError) {
        console.error("RPC Failed:", rpcError);
    } else {
        console.log("RPC Success! Submission ID:", submissionId);

        // Cleanup
        await supabase.from('submissions').delete().eq('id', submissionId);
        console.log("Cleanup done.");
    }
}

testRpc();
