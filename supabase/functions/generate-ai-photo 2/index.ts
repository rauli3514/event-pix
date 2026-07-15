import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')
    if (!REPLICATE_API_TOKEN) throw new Error('Falta REPLICATE_API_TOKEN')

    const body = await req.json()
    const { imageUrl, prompt, predictionId, action } = body
    
    if (predictionId) {
      const poll = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      });
      const prediction = await poll.json();
      return new Response(JSON.stringify({ success: true, prediction }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Determinar qué modelo y qué inputs enviar
    let version = "8baa7ef2255075b46f4d91cd238c21d31181b3e6a864463f967960bb0112525b"; // Retrato Mundial por defecto
    let input: any = {
      main_face_image: imageUrl,
      prompt: prompt,
      num_steps: 20,
      start_step: 4, 
      guidance_scale: 5,
      true_cfg: 1.0,
      ip_adapter_scale: 1.2
    };

    if (action === 'remove_bg') {
      // Usar modelo rembg (rápido y barato) para quitar el fondo
      version = "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003";
      input = { image: imageUrl };
    }

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ version, input }),
    });

    const prediction = await response.json();
    
    if (!response.ok) {
        return new Response(JSON.stringify({ success: false, error: prediction.detail || 'Falla en IA' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, prediction }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})
