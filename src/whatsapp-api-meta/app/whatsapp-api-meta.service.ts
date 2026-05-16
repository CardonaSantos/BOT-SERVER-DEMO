import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { throwFatalError } from 'src/Utils/CommonFatalError';
type MetaSendMessageResponse = {
  messaging_product: 'whatsapp';
  contacts?: { input: string; wa_id: string }[];
  messages?: { id: string }[];
};

@Injectable()
export class WhatsappApiMetaService {
  private readonly logger = new Logger(WhatsappApiMetaService.name);
  constructor(private readonly http: HttpService) {}

  async sendText(to: string, text: string): Promise<{ wamid: string | null }> {
    const bodyText = sanitizeWhatsAppText(text);

    this.logger.debug('📤 Enviando a Meta:', {
      to,
      length: bodyText.length,
      preview: bodyText.slice(0, 200),
    });

    try {
      const response = await this.http.axiosRef.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: bodyText },
      });

      const wamid = response?.data?.messages?.[0]?.id ?? null;

      return { wamid };
    } catch (error) {
      this.logger.error('Meta sendText failed', error);
      return { wamid: null }; // 🔑 NUNCA lanzar
    }
  }

  async sendHumanText(
    to: string,
    text: string,
  ): Promise<MetaSendMessageResponse> {
    try {
      let safeText = text;

      // 🛡️ Blindaje contra respuestas vacías del LLM
      if (!safeText || safeText.trim().length === 0) {
        this.logger.warn(`Texto vacío detectado. Enviando fallback a ${to}`);
        safeText =
          '✅ Tu ticket fue creado correctamente. Un técnico se pondrá en contacto contigo.';
      }

      const response = await this.http.axiosRef.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: safeText },
      });

      this.logger.log(`Mensaje enviado a ${to}. Status: ${response.status}`);
      this.logger.debug(JSON.stringify(response.data));

      return response.data as MetaSendMessageResponse;
    } catch (error) {
      throwFatalError(error, this.logger, 'WhatsappApiMetaService - sendText');
    }
  }

  async sendMedia(
    to: string,
    type: string,
    url: string,
    caption?: string,
    filename?: string,
  ): Promise<any> {
    try {
      const body: any = {
        messaging_product: 'whatsapp',
        to,
        type: type,
        [type]: {
          link: url,
        },
      };

      if (
        caption &&
        (type === 'image' || type === 'document' || type === 'video')
      ) {
        body[type].caption = caption;
      }

      if (type === 'document' && filename) {
        body[type].filename = filename;
      }

      // Usamos el mismo this.http que usa sendText
      const response = await this.http.axiosRef.post('/messages', body);

      this.logger.log(
        `Media (${type}) enviado a ${to}. Status: ${response.status}`,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error enviando media a Meta', error);
      throw error; // O usa tu throwFatalError
    }
  }
}

function sanitizeWhatsAppText(text: string): string {
  if (!text) return '✅ Ticket creado correctamente.';
  return text
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, 4000); // WhatsApp safe
}
