import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { submissionId, content, type, level } = await req.json()
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')

    if (!OPENAI_API_KEY) {
      throw new Error('Missing OpenAI API Key')
    }

    let isSafe = false;
    let reason = "";

    // Adjust strictness rules
    let promptInstruction = "Answer JSON: { \"safe\": boolean, \"reason\": string }.";
    if (level === 'low') {
      promptInstruction += " Be lenient. Only flag explicit nudity, sexual acts, or extreme gore. Allow alcohol, kissing, and party behavior.";
    } else if (level === 'high') {
      promptInstruction += " Be strict. Flag partial nudity, excessive alcohol focus, rude gestures, or anything unsuitable for a formal corporate event.";
    } else {
      // Medium
      promptInstruction += " Standard moderation. Flag nudity, violence, hate symbols, and offensive gestures.";
    }

    if (type === 'message') {
      // Use GPT-4o for nuanced text moderation if level is high, otherwise moderate endpoint
      // For simplicity/cost, we stick to moderations endpoint but could check categories
      const response = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: content }),
      })

      const data = await response.json()
      const result = data.results[0]
      isSafe = !result.flagged

      if (!isSafe) {
        reason = "Contenido de texto inapropiado detectado.";
      }
    } else if (type === 'photo') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Is this image appropriate for a family/social event? ${promptInstruction}` },
                { type: "image_url", image_url: { url: content } },
              ],
            },
          ],
          max_tokens: 300,
        }),
      })

      const data = await response.json()
      const reply = data.choices[0].message.content
      const jsonStr = reply.replace(/```json\n|\n```/g, '').trim()
      const analysis = JSON.parse(jsonStr)
      isSafe = analysis.safe
      reason = analysis.reason
    }

    // Update Supabase
    // If Safe -> Approved.
    // If Unsafe -> Pending (Human review). User requested "queda pendiente".
    // We only update if approved? 
    // If we leave it as pending, it's effectively "rejected by auto-approver".
    // Status update:
    const status = isSafe ? 'approved' : 'pending';

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseClient
      .from('submissions')
      .update({ status: status })
      .eq('id', submissionId)

    return new Response(
      JSON.stringify({
        success: true,
        moderated: true,
        isSafe,
        reason
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
