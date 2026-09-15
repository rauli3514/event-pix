// ================================================================
// WhatsAppCloudService.ts
// Conector Oficial con Meta Cloud API para WhatsApp Business v19.0
// EventPix Intelligence — SaaS Platform
// ================================================================

const GRAPH_BASE = 'https://graph.facebook.com/v19.0';

export interface WhatsAppTestResult {
  success: boolean;
  displayPhoneNumber?: string;
  verifiedName?: string;
  qualityRating?: string;
  error?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class WhatsAppCloudService {
  /**
   * Prueba la validez del token y el ID del teléfono de WhatsApp Business
   */
  static async testConnection(
    accessToken: string,
    phoneNumberId: string
  ): Promise<WhatsAppTestResult> {
    if (!accessToken.trim() || !phoneNumberId.trim()) {
      return {
        success: false,
        error: 'Access Token y Phone Number ID son requeridos.'
      };
    }

    try {
      const url = `${GRAPH_BASE}/${phoneNumberId.trim()}?fields=id,display_phone_number,verified_name,quality_rating`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken.trim()}`
        }
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        return {
          success: false,
          error: data.error?.message || `Error de Meta API (${res.status})`
        };
      }

      return {
        success: true,
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Fallo de red al conectar con Meta Graph API.'
      };
    }
  }

  /**
   * Genera variantes del número para compatibilidad con la Cloud API de Meta
   * Particularmente para Argentina (+54), donde el sandbox suele registrar 54 + área + 15 + número
   * mientras que el formato internacional es 54 + 9 + área + número.
   */
  static getPhoneVariants(phone: string): string[] {
    const clean = phone.replace(/\D/g, '');
    const variants: string[] = [clean];

    // Si tiene 549... (ej: 5493624055257), generar variante con 15 (54362154055257)
    if (clean.startsWith('549')) {
      const withoutCountry = clean.slice(3); // ej: 3624055257
      if (withoutCountry.startsWith('11')) {
        variants.push(`541115${withoutCountry.slice(2)}`);
      } else {
        const area = withoutCountry.slice(0, 3);
        const rest = withoutCountry.slice(3);
        variants.push(`54${area}15${rest}`);
      }
    } 
    // Si tiene 54...15... (ej: 54362154055257), generar variante con 9 (5493624055257)
    else if (clean.startsWith('54') && clean.includes('15')) {
      const without15 = clean.replace('15', '');
      const area = without15.slice(2, 5);
      const rest = without15.slice(5);
      variants.push(`549${area}${rest}`);
    }

    return Array.from(new Set(variants));
  }

  /**
   * Envía un mensaje real a un número de WhatsApp a través de la Cloud API
   */
  static async sendMessage(
    accessToken: string,
    phoneNumberId: string,
    recipientPhoneNumber: string,
    messageBody: string
  ): Promise<WhatsAppSendResult> {
    if (!accessToken || !phoneNumberId) {
      return {
        success: false,
        error: 'Credenciales de WhatsApp Cloud API no configuradas.'
      };
    }

    const variants = this.getPhoneVariants(recipientPhoneNumber);
    let lastError = 'Número de destinatario inválido.';

    for (const cleanPhone of variants) {
      if (!cleanPhone) continue;

      try {
        const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: cleanPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: messageBody
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && !data.error) {
          const msgId = data.messages?.[0]?.id;
          return {
            success: true,
            messageId: msgId
          };
        }

        const errorMsg = data.error?.message || `Error (${res.status})`;
        lastError = errorMsg;

        // Si el error es que requiere plantilla (ventana de 24h cerrada)
        if (data.error?.code === 131047 || errorMsg.toLowerCase().includes('template') || errorMsg.toLowerCase().includes('24 hour')) {
          const tmplRes = await this.sendTemplateMessage(accessToken, phoneNumberId, cleanPhone);
          if (tmplRes.success) {
            return tmplRes;
          }
        }
      } catch (err: any) {
        lastError = err.message || 'Error de red al despachar mensaje.';
      }
    }

    return {
      success: false,
      error: lastError
    };
  }

  /**
   * Envía un mensaje de plantilla pre-aprobada de WhatsApp (como 'hello_world')
   * Indispensable para iniciar conversaciones fuera de la ventana de 24 horas en Meta
   */
  static async sendTemplateMessage(
    accessToken: string,
    phoneNumberId: string,
    recipientPhoneNumber: string,
    templateName = 'hello_world',
    languageCode = 'en_US'
  ): Promise<WhatsAppSendResult> {
    if (!accessToken || !phoneNumberId) {
      return {
        success: false,
        error: 'Credenciales de WhatsApp Cloud API no configuradas.'
      };
    }

    const variants = this.getPhoneVariants(recipientPhoneNumber);
    let lastError = 'Número de destinatario inválido.';

    for (const cleanPhone of variants) {
      if (!cleanPhone) continue;

      try {
        const url = `${GRAPH_BASE}/${phoneNumberId}/messages`;
        const payload = {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode
            }
          }
        };

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok && !data.error) {
          const msgId = data.messages?.[0]?.id;
          return {
            success: true,
            messageId: msgId
          };
        }

        lastError = data.error?.message || `Error al enviar plantilla (${res.status})`;
      } catch (err: any) {
        lastError = err.message || 'Error de red al despachar plantilla de WhatsApp.';
      }
    }

    return {
      success: false,
      error: lastError
    };
  }
}
