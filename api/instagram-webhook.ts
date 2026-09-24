// ================================================================
// api/instagram-webhook.ts
// Función serverless de Vercel — recibe DMs reales de Instagram
// (Instagram API con Instagram Login), los guarda en el mismo CRM
// que usa WhatsApp, y responde con IA grounded en el conocimiento
// del negocio o con automatizaciones por palabra clave.
//
// Variables de entorno que necesita (Vercel → Environment Variables):
//   - VITE_SUPABASE_URL               (ya existe, se reutiliza)
//   - SUPABASE_SERVICE_ROLE_KEY       (ya existe, se reutiliza)
//   - INSTAGRAM_WEBHOOK_VERIFY_TOKEN  (nueva — la inventamos nosotros,
//                                      se pega también en el panel de
//                                      Meta al configurar el webhook)
//   - ANTHROPIC_API_KEY               (ya existe, se reutiliza)
// ================================================================

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 25 };

function getServiceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function sendInstagramText(accessToken: string, igsid: string, text: string) {
  const res = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { text }
    })
  });
  return res.ok;
}

async function sendInstagramImage(accessToken: string, igsid: string, imageUrl: string) {
  const res = await fetch(`https://graph.instagram.com/v21.0/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { id: igsid },
      message: { attachment: { type: 'image', payload: { url: imageUrl, is_reusable: true } } }
    })
  });
  return res.ok;
}

// Respuesta pública debajo del comentario original (la que "multiplica alcance"
// porque Instagram la lee como conversación orgánica).
async function sendInstagramCommentPublicReply(accessToken: string, commentId: string, text: string) {
  const res = await fetch(`https://graph.instagram.com/v21.0/${commentId}/replies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text })
  });
  return res.ok;
}

// DM privado al autor del comentario, usando la "private reply" de Meta:
// solo válida un tiempo limitado después del comentario y solo funciona a
// través de este endpoint (no es un mensaje directo común).
async function sendInstagramCommentPrivateReply(accessToken: string, commentId: string, text: string) {
  const res = await fetch(`https://graph.instagram.com/v21.0/${commentId}/private_replies`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text })
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

// Misma lógica que el webhook de WhatsApp: la IA responde grounded en
// el conocimiento real del negocio y su catálogo, nunca inventando.
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
  const systemPrompt = `Sos el asistente de Instagram Direct de "${params.businessName}". Respondé como si fueras un vendedor real de ese negocio: corto, cordial, en español rioplatense.

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
    console.error('instagram-webhook: fallo generando respuesta con IA', err);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // 1. Verificación del webhook (handshake de Meta al configurar la URL)
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];

    if (mode === 'subscribe' && token && token === process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN) {
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

  try {
    const supabase = getServiceClient();
    if (!supabase) {
      console.error('instagram-webhook: faltan SUPABASE_SERVICE_ROLE_KEY o VITE_SUPABASE_URL');
      res.status(200).json({ received: true });
      return;
    }

    const entries = req.body?.entry || [];
    for (const entry of entries) {
      const igAccountId = entry.id as string | undefined;
      const messagingEvents = entry.messaging || [];
      const commentChanges = (entry.changes || []).filter((c: any) => c.field === 'comments');
      if (!igAccountId || (messagingEvents.length === 0 && commentChanges.length === 0)) continue;

      const { data: business } = await supabase
        .from('intelligence_businesses')
        .select('id, instagram_access_token, name')
        .eq('instagram_account_id', igAccountId)
        .maybeSingle();

      if (!business) {
        console.warn('instagram-webhook: sin negocio para instagram_account_id', igAccountId);
        continue;
      }

      for (const event of messagingEvents) {
        // Ignoramos eco de nuestros propios mensajes enviados y eventos sin texto (likes, etc.)
        if (event.message?.is_echo) continue;
        const text = event.message?.text;
        const igsid = event.sender?.id as string | undefined;
        if (!text || !igsid) continue;
        const leadName = `Instagram ${igsid.slice(-6)}`;

        // 1. Lead: buscar o crear
        let { data: lead } = await supabase
          .from('intelligence_crm_leads')
          .select('id')
          .eq('business_id', business.id)
          .eq('instagram_scoped_id', igsid)
          .maybeSingle();

        if (!lead) {
          const { data: newLead } = await supabase
            .from('intelligence_crm_leads')
            .insert({
              business_id: business.id,
              name: leadName,
              instagram_scoped_id: igsid,
              channel: 'instagram_dm',
              source: { type: 'instagram_webhook' }
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
            .insert({ business_id: business.id, lead_id: lead.id, channel: 'instagram_dm' })
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

        // 4. Automatizaciones por palabra clave (mismas reglas que WhatsApp).
        // Las reglas creadas para comentarios (trigger_channel: 'comment', ver
        // más abajo) no deben disparar acá: están pensadas para responder
        // públicamente a un comentario, no para un DM directo.
        const { data: automations } = await supabase
          .from('intelligence_crm_automations')
          .select('*')
          .eq('business_id', business.id)
          .eq('trigger_event', 'keyword_match')
          .eq('is_active', true);

        const lowerText = text.toLowerCase();
        const matched = (automations || []).find((a: any) =>
          a.trigger_keyword &&
          a.action_payload?.trigger_channel !== 'comment' &&
          lowerText.includes(String(a.trigger_keyword).toLowerCase())
        );

        if (matched) {
          const replyText = matched.action_payload?.message_template;
          if (replyText && !matched.requires_human_approval && business.instagram_access_token) {
            const sent = await sendInstagramText(business.instagram_access_token, igsid, replyText);
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

        if (conversation.ai_mode === 'automatic' && business.instagram_access_token) {
          const sent = await sendInstagramText(business.instagram_access_token, igsid, aiResult.reply);
          let imageSent = false;
          if (matchedProduct?.image_url) {
            imageSent = await sendInstagramImage(business.instagram_access_token, igsid, matchedProduct.image_url);
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

      // 6. Comentarios en Reels/posts: reglas armadas desde el "Auto-DM Studio"
      // (action_payload.trigger_channel === 'comment'). Responden públicamente
      // rotando entre las frases configuradas y mandan un DM privado real vía
      // la "private reply" de Meta — no un mensaje directo común.
      for (const change of commentChanges) {
        const value = change.value || {};
        const commentId = value.id as string | undefined;
        const commentText = value.text as string | undefined;
        const commenterId = value.from?.id as string | undefined;
        const commenterUsername = value.from?.username as string | undefined;
        if (!commentId || !commentText || !commenterId) continue;
        // Nuestra propia respuesta pública también llega como evento de
        // "comments": sin este filtro el bot termina respondiéndose a sí mismo.
        if (commenterId === igAccountId) continue;

        const { data: commentAutomations } = await supabase
          .from('intelligence_crm_automations')
          .select('*')
          .eq('business_id', business.id)
          .eq('trigger_event', 'keyword_match')
          .eq('is_active', true);

        const lowerComment = commentText.toLowerCase();
        const matchedComment = (commentAutomations || []).find((a: any) =>
          a.trigger_keyword &&
          a.action_payload?.trigger_channel === 'comment' &&
          lowerComment.includes(String(a.trigger_keyword).toLowerCase())
        );
        if (!matchedComment || !business.instagram_access_token) continue;

        const privateMessage = matchedComment.action_payload?.message_template;
        if (!privateMessage) continue;

        const publicTemplates: string[] = matchedComment.action_payload?.public_reply_templates || [];
        const publicMessage = publicTemplates.length > 0
          ? publicTemplates[Math.floor(Math.random() * publicTemplates.length)]
          : null;

        const leadName = commenterUsername ? `@${commenterUsername}` : `Instagram ${commenterId.slice(-6)}`;

        // Mismo instagram_scoped_id que usaría un DM directo: si esta persona
        // después escribe por mensaje directo, cae en la misma conversación.
        let { data: lead } = await supabase
          .from('intelligence_crm_leads')
          .select('id')
          .eq('business_id', business.id)
          .eq('instagram_scoped_id', commenterId)
          .maybeSingle();

        if (!lead) {
          const { data: newLead } = await supabase
            .from('intelligence_crm_leads')
            .insert({
              business_id: business.id,
              name: leadName,
              instagram_username: commenterUsername || null,
              instagram_scoped_id: commenterId,
              channel: 'instagram_dm',
              source: {
                type: 'instagram_organic',
                keyword_triggered: matchedComment.trigger_keyword,
                attribution_confidence: 'alta'
              }
            })
            .select('id')
            .single();
          lead = newLead;
        }
        if (!lead) continue;

        let { data: commentConv } = await supabase
          .from('intelligence_crm_conversations')
          .select('id, unread_count')
          .eq('business_id', business.id)
          .eq('lead_id', lead.id)
          .maybeSingle();

        if (!commentConv) {
          const { data: newConv } = await supabase
            .from('intelligence_crm_conversations')
            .insert({ business_id: business.id, lead_id: lead.id, channel: 'instagram_dm' })
            .select('id, unread_count')
            .single();
          commentConv = newConv;
        }
        if (!commentConv) continue;

        await supabase.from('intelligence_crm_messages').insert({
          conversation_id: commentConv.id,
          sender_type: 'lead',
          sender_name: leadName,
          content: `Comentó "${commentText}" en un Reel`,
          status: 'received',
          message_type: 'incoming'
        });

        if (matchedComment.requires_human_approval) {
          // Modo sugerencia: nadie responde solo, queda registrado en el CRM
          // para que un humano lo vea y actúe manualmente desde Instagram.
          if (publicMessage) {
            await supabase.from('intelligence_crm_messages').insert({
              conversation_id: commentConv.id,
              sender_type: 'ai_suggested',
              sender_name: business.name,
              content: publicMessage,
              status: 'suggested',
              message_type: 'auto_reply',
              ai_metadata: { automation_id: matchedComment.id, reasoning: `Respuesta pública sugerida por comentario con palabra clave: "${matchedComment.trigger_keyword}"` }
            });
          }
          await supabase.from('intelligence_crm_messages').insert({
            conversation_id: commentConv.id,
            sender_type: 'ai_suggested',
            sender_name: business.name,
            content: privateMessage,
            status: 'suggested',
            message_type: 'auto_reply',
            ai_metadata: { automation_id: matchedComment.id, reasoning: `DM privado sugerido por comentario con palabra clave: "${matchedComment.trigger_keyword}"` }
          });
        } else {
          const publicSent = publicMessage
            ? await sendInstagramCommentPublicReply(business.instagram_access_token, commentId, publicMessage)
            : false;
          const privateSent = await sendInstagramCommentPrivateReply(business.instagram_access_token, commentId, privateMessage);

          if (publicMessage) {
            await supabase.from('intelligence_crm_messages').insert({
              conversation_id: commentConv.id,
              sender_type: 'ai_auto',
              sender_name: business.name,
              content: publicMessage,
              status: publicSent ? 'sent' : 'rejected',
              message_type: 'auto_reply',
              ai_metadata: { automation_id: matchedComment.id, reasoning: `Respuesta pública por comentario con palabra clave: "${matchedComment.trigger_keyword}"` }
            });
          }
          await supabase.from('intelligence_crm_messages').insert({
            conversation_id: commentConv.id,
            sender_type: 'ai_auto',
            sender_name: business.name,
            content: privateMessage,
            status: privateSent ? 'sent' : 'rejected',
            message_type: 'auto_reply',
            ai_metadata: { automation_id: matchedComment.id, reasoning: `DM privado disparado por comentario con palabra clave: "${matchedComment.trigger_keyword}"` }
          });
        }

        await supabase
          .from('intelligence_crm_conversations')
          .update({
            unread_count: (commentConv.unread_count || 0) + 1,
            last_interaction_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', commentConv.id);

        await supabase
          .from('intelligence_crm_leads')
          .update({ last_interaction_at: new Date().toISOString() })
          .eq('id', lead.id);
      }
    }

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('instagram-webhook error:', err);
    res.status(200).json({ received: true, error: err.message });
  }
}
