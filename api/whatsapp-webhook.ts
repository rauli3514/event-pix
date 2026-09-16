// ================================================================
// api/whatsapp-webhook.ts
// Función serverless de Vercel — recibe mensajes reales de WhatsApp
// Cloud API (Meta), los guarda en el CRM del negocio dueño del
// número, y responde solo si hay una automatización activa que
// matchea. Corre en el servidor: no depende de que nadie tenga el
// navegador abierto.
//
// Variables de entorno que necesita (Vercel → Environment Variables):
//   - VITE_SUPABASE_URL              (ya existe, se reutiliza)
//   - SUPABASE_SERVICE_ROLE_KEY      (nueva, secreta — nunca VITE_*)
//   - WHATSAPP_WEBHOOK_VERIFY_TOKEN  (nueva — la inventamos nosotros,
//                                     se pega también en el panel de
//                                     Meta al configurar el webhook)
//   - ANTHROPIC_API_KEY              (nueva, secreta — la IA que responde
//                                     sola cuando ninguna palabra clave
//                                     matchea; la provee la plataforma,
//                                     no cada cliente)
// ================================================================

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 25 };

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function sendWhatsAppText(accessToken: string, phoneNumberId: string, to: string, body: string) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body }
    })
  });
  return res.ok;
}

async function sendWhatsAppImage(accessToken: string, phoneNumberId: string, to: string, imageUrl: string, caption?: string) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { link: imageUrl, caption }
    })
  });
  return res.ok;
}

interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
}

interface AiReplyResult {
  reply: string;
  product_id: string | null;
}

// Genera una respuesta grounded en el conocimiento del negocio (FAQs,
// precios, catálogo real) en vez de una palabra clave fija. Devuelve
// también qué producto conviene mostrar por foto, si corresponde.
async function generateAiReply(params: {
  businessName: string;
  knowledgeBase: any;
  products: CatalogProduct[];
  customerMessage: string;
}): Promise<AiReplyResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const catalogText = params.products.length
    ? params.products
        .map(p => `- id:${p.id} | ${p.name}${p.price ? ` | $${p.price}` : ''}${p.description ? ` | ${p.description}` : ''}`)
        .join('\n')
    : '(sin productos cargados todavía)';

  const kb = params.knowledgeBase || {};
  const systemPrompt = `Sos el asistente de WhatsApp de "${params.businessName}". Respondé como si fueras un vendedor real de ese negocio: corto, cordial, en español rioplatense.

Descripción del negocio: ${kb.business_description || 'sin descripción cargada'}
Política de precios: ${kb.pricing_policy || 'no especificada'}
Horarios: ${kb.operating_hours || 'no especificados'}
FAQs: ${JSON.stringify(kb.faqs || [])}
Reglas: ${kb.disclaimers || 'Si no sabés el precio o el stock exacto, derivá a un asesor humano.'}

Catálogo de productos (usá el id exacto si el cliente pregunta por alguno de estos):
${catalogText}

Respondé SIEMPRE en JSON válido, sin texto extra, con esta forma exacta:
{"reply": "tu respuesta al cliente", "product_id": "id del producto del catálogo si corresponde mostrar su foto, o null"}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: params.customerMessage }]
      })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data?.content?.[0]?.text || '';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.reply) return null;
    return { reply: String(parsed.reply), product_id: parsed.product_id || null };
  } catch (err) {
    console.error('whatsapp-webhook: fallo generando respuesta con IA', err);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // 1. Verificación del webhook (handshake de Meta al configurar la URL)
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe' && token && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send('Verificación fallida');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Meta espera un 200 rápido. Confirmamos primero y procesamos después
  // no es una opción simple en funciones serverless (no hay "background
  // job"), así que procesamos igual pero devolvemos 200 apenas podemos,
  // sin dejar que un error de un mensaje tire abajo la respuesta.
  try {
    const supabase = getServiceClient();
    if (!supabase) {
      console.error('whatsapp-webhook: faltan SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_URL');
      res.status(200).json({ received: true });
      return;
    }

    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const phoneNumberId = value.metadata?.phone_number_id;
        const messages = value.messages || [];
        if (!phoneNumberId || messages.length === 0) continue;

        const { data: business } = await supabase
          .from('intelligence_businesses')
          .select('id, whatsapp_access_token, name')
          .eq('whatsapp_phone_number_id', phoneNumberId)
          .maybeSingle();

        if (!business) {
          console.warn('whatsapp-webhook: sin negocio para phone_number_id', phoneNumberId);
          continue;
        }

        for (const msg of messages) {
          if (msg.type !== 'text') continue;
          const fromPhone = msg.from as string;
          const text = msg.text?.body || '';
          const contact = (value.contacts || []).find((c: any) => c.wa_id === fromPhone);
          const leadName = contact?.profile?.name || fromPhone;

          // 1. Lead: buscar o crear
          let { data: lead } = await supabase
            .from('intelligence_crm_leads')
            .select('id')
            .eq('business_id', business.id)
            .eq('phone', fromPhone)
            .maybeSingle();

          if (!lead) {
            const { data: newLead } = await supabase
              .from('intelligence_crm_leads')
              .insert({
                business_id: business.id,
                name: leadName,
                phone: fromPhone,
                channel: 'whatsapp',
                source: { type: 'whatsapp_webhook' }
              })
              .select('id')
              .single();
            lead = newLead;
          }
          if (!lead) continue;

          // 2. Conversación: buscar o crear
          let { data: conversation } = await supabase
            .from('intelligence_crm_conversations')
            .select('id, ai_mode, unread_count')
            .eq('business_id', business.id)
            .eq('lead_id', lead.id)
            .maybeSingle();

          if (!conversation) {
            const { data: newConv } = await supabase
              .from('intelligence_crm_conversations')
              .insert({ business_id: business.id, lead_id: lead.id, channel: 'whatsapp' })
              .select('id, ai_mode, unread_count')
              .single();
            conversation = newConv;
          }
          if (!conversation) continue;

          // 3. Guardar el mensaje entrante
          await supabase.from('intelligence_crm_messages').insert({
            conversation_id: conversation.id,
            sender_type: 'lead',
            sender_name: leadName,
            content: text,
            status: 'received',
            message_type: 'incoming'
          });

          await supabase
            .from('intelligence_crm_conversations')
            .update({
              unread_count: (conversation.unread_count || 0) + 1,
              last_interaction_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', conversation.id);

          await supabase
            .from('intelligence_crm_leads')
            .update({ last_interaction_at: new Date().toISOString() })
            .eq('id', lead.id);

          if (conversation.ai_mode === 'disabled') continue;

          // 4. Automatizaciones por palabra clave
          const { data: automations } = await supabase
            .from('intelligence_crm_automations')
            .select('*')
            .eq('business_id', business.id)
            .eq('trigger_event', 'keyword_match')
            .eq('is_active', true);

          const lowerText = text.toLowerCase();
          const matched = (automations || []).find((a: any) =>
            a.trigger_keyword && lowerText.includes(String(a.trigger_keyword).toLowerCase())
          );

          if (matched) {
            const replyText = matched.action_payload?.message_template;
            if (replyText && !matched.requires_human_approval && business.whatsapp_access_token) {
              const sent = await sendWhatsAppText(business.whatsapp_access_token, phoneNumberId, fromPhone, replyText);
              await supabase.from('intelligence_crm_messages').insert({
                conversation_id: conversation.id,
                sender_type: 'ai_auto',
                sender_name: business.name,
                content: replyText,
                status: sent ? 'sent' : 'rejected',
                message_type: 'auto_reply',
                ai_metadata: { automation_id: matched.id, reasoning: `Disparado por palabra clave: "${matched.trigger_keyword}"` }
              });
            } else if (replyText) {
              // Requiere aprobación humana: queda como sugerencia en el CRM, no se envía sola.
              await supabase.from('intelligence_crm_messages').insert({
                conversation_id: conversation.id,
                sender_type: 'ai_suggested',
                sender_name: business.name,
                content: replyText,
                status: 'suggested',
                message_type: 'auto_reply',
                ai_metadata: { automation_id: matched.id, reasoning: `Sugerido por palabra clave: "${matched.trigger_keyword}"` }
              });
            }
            continue;
          }

          // 5. Ninguna palabra clave matcheó: la IA responde sola, grounded
          //    en el conocimiento del negocio y el catálogo real de productos.
          const [{ data: knowledgeBase }, { data: catalog }] = await Promise.all([
            supabase
              .from('intelligence_business_knowledge_base')
              .select('*')
              .eq('business_id', business.id)
              .maybeSingle(),
            supabase
              .from('intelligence_business_products')
              .select('id, name, description, price, image_url')
              .eq('business_id', business.id)
              .eq('is_active', true)
          ]);

          const aiResult = await generateAiReply({
            businessName: business.name,
            knowledgeBase,
            products: (catalog || []) as CatalogProduct[],
            customerMessage: text
          });

          if (!aiResult) continue;

          const matchedProduct = aiResult.product_id
            ? (catalog || []).find((p: CatalogProduct) => p.id === aiResult.product_id)
            : null;

          if (conversation.ai_mode === 'automatic' && business.whatsapp_access_token) {
            const sent = await sendWhatsAppText(business.whatsapp_access_token, phoneNumberId, fromPhone, aiResult.reply);
            let imageSent = false;
            if (matchedProduct?.image_url) {
              imageSent = await sendWhatsAppImage(business.whatsapp_access_token, phoneNumberId, fromPhone, matchedProduct.image_url, matchedProduct.name);
            }
            await supabase.from('intelligence_crm_messages').insert({
              conversation_id: conversation.id,
              sender_type: 'ai_auto',
              sender_name: business.name,
              content: aiResult.reply,
              status: sent ? 'sent' : 'rejected',
              message_type: 'auto_reply',
              ai_metadata: {
                reasoning: 'Respuesta generada por IA (sin regla de palabra clave)',
                product_id: matchedProduct?.id,
                product_image_sent: imageSent
              }
            });
          } else {
            // Modo sugerencia (o sin token todavía): queda para que un humano la apruebe.
            await supabase.from('intelligence_crm_messages').insert({
              conversation_id: conversation.id,
              sender_type: 'ai_suggested',
              sender_name: business.name,
              content: aiResult.reply,
              status: 'suggested',
              message_type: 'auto_reply',
              ai_metadata: {
                reasoning: 'Sugerencia generada por IA (sin regla de palabra clave)',
                product_id: matchedProduct?.id,
                product_image_url: matchedProduct?.image_url
              }
            });
          }
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('whatsapp-webhook error:', err);
    // Igual devolvemos 200: si Meta ve error, reintenta el mismo mensaje en loop.
    res.status(200).json({ received: true, error: err.message });
  }
}
