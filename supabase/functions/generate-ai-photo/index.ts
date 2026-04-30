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
    const { imageUrl, prompt } = await req.json()
    const REPLICATE_API_TOKEN = Deno.env.get('REPLICATE_API_TOKEN')

    if (!REPLICATE_API_TOKEN) {
      throw new Error('Missing Replicate API Token')
    }

    // We'll use lucataco/flux-dev-pulid or zsxkib/flux-pulid. 
    // zsxkib/flux-pulid version: 8a89b0ab59a050244a751b6475d91041a8582ba33692ae6af66214bf650a3603 (example, we will use official endpoint format)
    
    // Create prediction
    const response = await fetch('https://api.replicate.com/v1/models/zsxkib/flux-pulid/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait'
      },
      body: JSON.stringify({
        input: {
          prompt: prompt,
          main_face_image: imageUrl,
          num_steps: 20,
          guidance: 4,
          true_cfg: 1,
          width: 768,
          height: 1024,
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Replicate API error:', errorText);
      throw new Error(`Replicate API error: ${response.status}`);
    }

    let prediction = await response.json();

    // If it didn't finish within the 'wait' period, we poll
    let attempts = 0;
    while (
      prediction.status !== 'succeeded' &&
      prediction.status !== 'failed' &&
      prediction.status !== 'canceled' &&
      attempts < 30
    ) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const pollResponse = await fetch(
        `https://api.replicate.com/v1/predictions/${prediction.id}`,
        {
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          },
        }
      );
      prediction = await pollResponse.json();
      attempts++;
    }

    if (prediction.status === 'succeeded') {
      const outputUrl = prediction.output[0] || prediction.output;
      return new Response(
        JSON.stringify({
          success: true,
          outputUrl: Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    } else {
      throw new Error(`Prediction failed with status: ${prediction.status}`);
    }

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
