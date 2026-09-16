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
// ================================================================

import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 20 };

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
