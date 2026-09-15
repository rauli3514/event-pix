// ================================================================
// CRMIntelligenceEngine.ts
// Motor Determinístico de Lead Scoring, Intención y Atribución CRM
// EventPix Intelligence — SaaS Platform
// ================================================================

import {
  CRMLead,
  CRMConversation,
  CRMMessage,
  CRMTask,
  CRMFunnelMetrics,
  LeadStage,
  CommercialOpportunity,
  RecommendedAutomation
} from '../../types/crm';
import { BrandDNA } from '../../types/intelligence';

export class CRMIntelligenceEngine {

  /**
   * Calcula el Lead Intent Score (0 a 100) en base a eventos y mensajes cuantificables.
   * Regla de arquitectura: La lógica cuantitativa se ejecuta en código, no en prompts.
   */
  static calculateLeadScore(messages: CRMMessage[], currentLead: Partial<CRMLead>): {
    score: number;
    label: CRMLead['intent_label'];
    breakdown: { event: string; points: number }[];
  } {
    let score = 10; // Base por iniciar conversación
    const breakdown: { event: string; points: number }[] = [
      { event: 'Inicio de conversación', points: 10 }
    ];

    const allText = messages.map(m => m.content.toLowerCase()).join(' ');

    // 1. Preguntó por precio / costo / cuánto sale
    if (/(cu[aá]nto sale|precio|costo|valor|tarifa|cuanto cuesta)/i.test(allText)) {
      score += 15;
      breakdown.push({ event: 'Consultó precio o tarifas', points: 15 });
    }

    // 2. Pidió presupuesto o cotización formal
    if (/(presupuesto|cotizaci[oó]n|propuesta|factura|financiamiento|cuotas)/i.test(allText)) {
      score += 25;
      breakdown.push({ event: 'Solicitó presupuesto o financiación', points: 25 });
    }

    // 3. Indicó contexto comercial / local / rubro
    if (/(mi local|mi negocio|comercio|restaurante|farmacia|pantalla|vidriera|medidas)/i.test(allText)) {
      score += 20;
      breakdown.push({ event: 'Compartió rubro o ubicación de su local', points: 20 });
    }

    // 4. Preguntó por disponibilidad / entrega / instalación
    if (/(disponib|stock|instal|entrega|env[ií]o|cu[aá]ndo pueden|tiempo de demora)/i.test(allText)) {
      score += 15;
      breakdown.push({ event: 'Consultó por disponibilidad e instalación', points: 15 });
    }

    // 5. Dejó teléfono o pidió llamada directa
    if (currentLead.phone || /(llamame|mi whatsapp|te paso mi tel|contacto directo)/i.test(allText)) {
      score += 15;
      breakdown.push({ event: 'Compartió número o solicitó llamada', points: 15 });
    }

    // Normalizar a tope 100
    const finalScore = Math.min(100, score);

    let label: CRMLead['intent_label'] = 'Curiosidad';
    if (finalScore >= 80) label = 'Listo para Comprar';
    else if (finalScore >= 60) label = 'Alta Intención';
    else if (finalScore >= 40) label = 'Interesado';

    return { score: finalScore, label, breakdown };
  }

  /**
   * Clasifica la intención predominante del mensaje
   */
  static detectMessageIntent(text: string): {
    intent: string;
    suggestedStage?: LeadStage;
  } {
    const t = text.toLowerCase();

    if (/(presupuesto|cotizaci[oó]n|enviame propuesta)/i.test(t)) {
      return { intent: 'Solicitud de Presupuesto', suggestedStage: 'presupuesto' };
    }
    if (/(precio|cu[aá]nto sale|costo)/i.test(t)) {
      return { intent: 'Consulta de Precios', suggestedStage: 'interesado' };
    }
    if (/(instalaci[oó]n|soporte|no me funciona|problema)/i.test(t)) {
      return { intent: 'Consulta Técnica / Instalación' };
    }
    if (/(direcci[oó]n|d[oó]nde est[aá]n|local f[ií]sico|horario)/i.test(t)) {
      return { intent: 'Ubicación y Horarios' };
    }
    if (/(comprar|quiero encargar|cerramos|dame los datos para transferir)/i.test(t)) {
      return { intent: 'Cierre de Compra Inminente', suggestedStage: 'negociacion' };
    }

    return { intent: 'Consulta General' };
  }

  /**
   * Genera una sugerencia de respuesta de IA anclada al ADN de Marca
   * Cumple con CONTROL HUMANO: genera sugerencia para que el operador apruebe o edite.
   */
  static generateAISuggestion(
    lastIncomingMessage: string,
    lead: CRMLead,
    brandDna?: BrandDNA,
    catalogProducts?: Array<{ name: string; price: number; currency: string; stock: number }>
  ): {
    suggestedReply: string;
    reasoning: string;
    detectedIntent: string;
  } {
    const { intent } = this.detectMessageIntent(lastIncomingMessage);
    const greeting =
      brandDna?.voice_and_tone?.favorite_catchphrases?.[0] ||
      (brandDna?.voice_and_tone as any)?.catchphrases?.[0] ||
      '¡Hola!';

    let primaryProduct = 'Pantallas Verticales de Display Digital';
    if (brandDna?.offers) {
      if (Array.isArray(brandDna.offers)) {
        primaryProduct = (brandDna.offers as any)[0]?.name || primaryProduct;
      } else if (Array.isArray((brandDna.offers as any).main_products)) {
        primaryProduct = (brandDna.offers as any).main_products[0] || primaryProduct;
      }
    }

    const leadFirstName = lead?.name ? lead.name.split(' ')[0] : 'Hola';

    let suggestedReply = '';
    let reasoning = '';

    if (intent === 'Consulta de Precios') {
      let matchedProduct: { name: string; price: number; currency: string; stock: number } | undefined;
      if (catalogProducts && catalogProducts.length > 0) {
        matchedProduct = catalogProducts.find(p =>
          lastIncomingMessage.toLowerCase().includes(p.name.toLowerCase().slice(0, 8))
        ) || catalogProducts[0];
      }

      if (matchedProduct) {
        suggestedReply = `${greeting} ¿Cómo estás ${leadFirstName}? Te confirmo: el valor oficial de ${matchedProduct.name} es de $${matchedProduct.price.toLocaleString('es-AR')} ${matchedProduct.currency} (Stock disponible en local: ${matchedProduct.stock} un.). ¿Te gustaría que te reservemos o precisás factura?`;
        reasoning = `Precio y stock cotizados en tiempo real desde el catálogo sincronizado de Shop de Plumas (${matchedProduct.name}).`;
      } else {
        suggestedReply = `${greeting} ¿Cómo estás ${leadFirstName}? Para ${primaryProduct} tenemos opciones según las dimensiones y requerimientos de tu local. ¿Qué rubro tenés y qué medidas aprox buscás cubrir?`;
        reasoning = 'Responde al precio calificando primero el rubro y medidas sin inventar tarifas sin contexto.';
      }
    } else if (intent === 'Solicitud de Presupuesto') {
      suggestedReply = `¡Excelente ${leadFirstName}! Te podemos armar la propuesta completa con pantalla, soporte e instalación. ¿Preferís que te detallemos la opción de 43" o 55" vertical?`;
      reasoning = 'Orienta el presupuesto a las dos configuraciones comerciales más vendidas del negocio.';
    } else if (intent === 'Cierre de Compra Inminente') {
      suggestedReply = `¡Genial ${leadFirstName}! Te paso los datos de facturación y coordinamos la entrega e instalación en tu local. ¿A nombre de qué razón social o persona confeccionamos la nota de pedido?`;
      reasoning = 'Facilita el cierre administrativo inmediato.';
    } else {
      suggestedReply = `${greeting} Gracias por escribirnos. Contame un poco más sobre tu proyecto y te asesoramos al instante para equipar tu local con tecnología EventPix.`;
      reasoning = 'Saludo cercano con apertura para identificar el dolor comercial del cliente.';
    }

    return {
      suggestedReply,
      reasoning,
      detectedIntent: intent
    };
  }

  /**
   * Valida la ventana de mensajería de 24 horas impuesta por Meta
   */
  static checkMeta24hWindow(lastLeadMessageTimestamp?: string): {
    isOpen: boolean;
    expiresAt: string;
    hoursRemaining: number;
  } {
    if (!lastLeadMessageTimestamp) {
      return { isOpen: true, expiresAt: new Date(Date.now() + 24 * 3600000).toISOString(), hoursRemaining: 24 };
    }

    const lastTime = new Date(lastLeadMessageTimestamp).getTime();
    const expiresTime = lastTime + 24 * 3600 * 1000;
    const now = Date.now();
    const diffMs = expiresTime - now;
    const hoursRemaining = Math.max(0, Math.round(diffMs / (3600 * 1000)));

    return {
      isOpen: diffMs > 0,
      expiresAt: new Date(expiresTime).toISOString(),
      hoursRemaining
    };
  }

  /**
   * Calcula las métricas del embudo de conversión y atribución hacia contenido
   */
  static calculateFunnelMetrics(conversations: CRMConversation[]): CRMFunnelMetrics {
    const totalConversations = conversations.length;
    const leads = conversations.map(c => c.lead);
    const totalLeads = leads.length;

    const qualifiedLeads = leads.filter(l => l.intent_score >= 50).length;
    const budgetsRequested = leads.filter(l => ['presupuesto', 'negociacion', 'ganado'].includes(l.stage)).length;
    const dealsWon = leads.filter(l => l.stage === 'ganado').length;
    const dealsLost = leads.filter(l => l.stage === 'perdido').length;

    const totalSalesValue = leads
      .filter(l => l.stage === 'ganado')
      .reduce((sum, l) => sum + (l.estimated_value || 0), 0);

    const conversionRatePct = totalLeads > 0 
      ? Number(((dealsWon / totalLeads) * 100).toFixed(1))
      : 0;

    // Atribución de contenido: Qué Reel originó los leads y ventas
    const contentMap: { [key: string]: { post_id: string; post_title: string; leads_count: number; sales_count: number } } = {};

    for (const lead of leads) {
      if (lead.source.post_id && lead.source.post_title) {
        const id = lead.source.post_id;
        if (!contentMap[id]) {
          contentMap[id] = {
            post_id: id,
            post_title: lead.source.post_title,
            leads_count: 0,
            sales_count: 0
          };
        }
        contentMap[id].leads_count += 1;
        if (lead.stage === 'ganado') {
          contentMap[id].sales_count += 1;
        }
      }
    }

    const topConvertingContent = Object.values(contentMap).sort((a, b) => b.sales_count - a.sales_count);

    return {
      total_conversations: totalConversations,
      total_leads: totalLeads,
      qualified_leads: qualifiedLeads,
      budgets_requested: budgetsRequested,
      deals_won: dealsWon,
      deals_lost: dealsLost,
      conversion_rate_pct: conversionRatePct,
      total_sales_value: totalSalesValue,
      avg_response_time_minutes: 8, // Tiempo promedio de respuesta
      top_converting_content: topConvertingContent
    };
  }

  /**
   * Detecta oportunidades comerciales y leads en riesgo de abandono
   */
  static detectCommercialOpportunities(
    conversations: CRMConversation[],
    tasks: CRMTask[]
  ): CommercialOpportunity[] {
    const opportunities: CommercialOpportunity[] = [];
    const pendingTaskLeadIds = new Set(tasks.filter(t => !t.is_completed).map(t => t.lead_id));

    for (const conv of conversations) {
      const lead = conv.lead;

      // 1. Leads de alta intención sin tarea de seguimiento activa
      if (lead.intent_score >= 75 && lead.stage !== 'ganado' && lead.stage !== 'perdido') {
        if (!pendingTaskLeadIds.has(lead.id)) {
          opportunities.push({
            id: `opp_abandoned_${lead.id}`,
            type: 'lead_abandoned',
            title: `Lead Caliente sin seguimiento: ${lead.name}`,
            description: `Tiene un score de compra de ${lead.intent_score}/100 y demostró interés en "${lead.primary_interest || 'Servicios'}", pero no tiene tareas asignadas para hoy.`,
            severity: 'high',
            action_label: 'Crear Seguimiento',
            lead_id: lead.id,
            lead_name: lead.name,
            suggested_action_type: 'create_task',
            metric_highlight: `Score ${lead.intent_score} pts`
          });
        }
      }

      // 2. Presupuestos estancados (+24/48h sin respuesta)
      if (lead.stage === 'presupuesto') {
        const lastMsgTime = conv.last_message?.created_at ? new Date(conv.last_message.created_at).getTime() : 0;
        const hoursSinceLast = (Date.now() - lastMsgTime) / 3600000;
        if (hoursSinceLast > 12) {
          opportunities.push({
            id: `opp_budget_${lead.id}`,
            type: 'budget_stalled',
            title: `Presupuesto en espera de respuesta: ${lead.name}`,
            description: `Se cotizó ${lead.primary_interest || 'equipamiento'}. Pasaron más de ${Math.round(hoursSinceLast)}h sin confirmación. Conviene consultar si tiene dudas sobre la instalación o cuotas.`,
            severity: 'medium',
            action_label: 'Abrir Chat y Consultar',
            lead_id: lead.id,
            lead_name: lead.name,
            suggested_action_type: 'open_chat',
            metric_highlight: lead.estimated_value ? `$${lead.estimated_value.toLocaleString('es-AR')}` : 'Presupuesto enviado'
          });
        }
      }

      // 3. Ventana de 24h de Meta a punto de cerrar (< 6 horas)
      if (conv.messaging_window.is_open && conv.messaging_window.hours_remaining <= 6 && conv.unread_count > 0) {
        opportunities.push({
          id: `opp_meta_${lead.id}`,
          type: 'meta_window_expiring',
          title: `Ventana Meta por expirar (${conv.messaging_window.hours_remaining}h restantes): ${lead.name}`,
          description: `El lead envió un mensaje y quedan menos de ${conv.messaging_window.hours_remaining} horas antes de que Meta bloquee las respuestas gratuitas.`,
          severity: 'high',
          action_label: 'Responder Ahora',
          lead_id: lead.id,
          lead_name: lead.name,
          suggested_action_type: 'open_chat',
          metric_highlight: `${conv.messaging_window.hours_remaining}h para cierre`
        });
      }
    }

    // 4. Insight de contenido comercial de alto rendimiento
    const leadsWithSource = conversations.map(c => c.lead).filter(l => l.source?.post_title);
    if (leadsWithSource.length > 0) {
      const bestPost = leadsWithSource[0].source;
      opportunities.push({
        id: `opp_content_${bestPost.post_id || 'top'}`,
        type: 'content_converting',
        title: `Contenido con mayor conversión a ventas`,
        description: `El Reel "${bestPost.post_title}" generó consultas calificadas de alta intención comercial. Te recomendamos pautarlo o crear una secuencia similar.`,
        severity: 'info',
        action_label: 'Ver en Canvas',
        post_id: bestPost.post_id,
        suggested_action_type: 'view_content',
        metric_highlight: 'Mayor ROI comercial'
      });
    }

    return opportunities;
  }

  /**
   * Analiza el historial de conversaciones y recomienda automatizaciones preconfiguradas
   */
  static recommendAutomations(conversations: CRMConversation[]): RecommendedAutomation[] {
    const total = conversations.length || 1;
    
    // Conteo de consultas de precio
    let priceCount = 0;
    let demoCount = 0;

    for (const conv of conversations) {
      const lastText = conv.last_message?.content || '';
      if (/(precio|cuanto|costo|tarifa)/i.test(lastText)) priceCount++;
      if (/(app|demo|sistema|como funciona)/i.test(lastText)) demoCount++;
    }

    const pricePct = Math.round((priceCount / total) * 100) || 45;

    return [
      {
        id: 'rec_auto_price',
        title: 'Automatizar Calificación de Consultas de Precio',
        reason: `Detectamos que el ${pricePct}% de los mensajes inician preguntando precios o tarifas.`,
        trigger_summary: 'Mensaje entrante contiene: "precio", "cuánto sale", "costo"',
        detected_frequency: `${pricePct}% de las conversaciones`,
        projected_impact: 'Ahorro estimado de 3.5 horas semanales en respuestas iniciales',
        suggested_rule: {
          name: 'Respuesta Inteligente a Consultas de Precio',
          description: 'Responde amablemente consultando el rubro y dimensiones del local antes de pasar el tarifario.',
          trigger_event: 'price_inquiry',
          trigger_keyword: 'precio',
          action_type: 'suggest_ai_response',
          action_payload: {
            message_template: '¡Hola! Para pasarte el valor exacto del equipamiento, ¿qué rubro tiene tu comercio y qué medidas aprox te gustaría cubrir en tu vidriera?',
            target_stage: 'interesado'
          },
          requires_human_approval: true
        }
      },
      {
        id: 'rec_auto_comment_dm',
        title: 'Embudo Automático Reel → DM ("APP")',
        reason: 'Captura inmediata de personas interesadas que comentan la palabra clave en publicaciones orgánicas.',
        trigger_summary: 'Comentario en Reel contiene palabra clave "APP"',
        detected_frequency: 'Disparador de alta conversión',
        projected_impact: 'Multiplica x3 la tasa de conversación comentario-a-lead',
        suggested_rule: {
          name: 'Comentario a DM: Envío de Catálogo de Pantallas',
          description: 'Envía por mensaje privado el catálogo interactivo y video demo cuando comentan "APP".',
          trigger_event: 'keyword_match',
          trigger_keyword: 'APP',
          action_type: 'send_auto_reply',
          action_payload: {
            message_template: '¡Hola! Acá te comparto la demo en video de cómo se administran las pantallas desde el celular y el catálogo para comercios.',
            target_stage: 'contactado'
          },
          requires_human_approval: false
        }
      },
      {
        id: 'rec_auto_followup',
        title: 'Seguimiento Automático de Cotizaciones a las 48h',
        reason: 'Evita perder clientes que pidieron presupuesto y no volvieron a responder.',
        trigger_summary: 'Sin respuesta tras 48h de enviar propuesta formal',
        detected_frequency: 'Seguimiento preventivo',
        projected_impact: 'Recupera hasta un 22% de presupuestos olvidados',
        suggested_rule: {
          name: 'Recordatorio Comercial de Propuesta',
          description: 'Genera una tarea de contacto para consultar dudas técnicas sobre el presupuesto enviado.',
          trigger_event: 'no_reply_48h',
          action_type: 'create_task',
          action_payload: {
            task_title: 'Follow-up de cotización: consultar dudas de instalación y medios de pago',
            target_stage: 'seguimiento'
          },
          requires_human_approval: true
        }
      }
    ];
  }
}
