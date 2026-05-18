import { Injectable, Logger } from '@nestjs/common';
import { EmpresaService } from 'src/empresa/app/empresa.service';
import { ClienteService } from 'src/cliente/app/cliente.service';
import { ChatService } from 'src/chat/app/chat.service';
import {
  ChatChannel,
  ChatRole,
  WazDirection,
  WazMediaType,
  WazStatus,
} from '@prisma/client';
import { KnowledgeService } from 'src/knowledge/app/knowledge.service';
import { generarKeyWhatsapp } from 'src/Utils/enrutador-dospaces';
import { WhatsAppMessageService } from 'src/whatsapp/chat/app/whatsapp-chat.service';
import { MetaWhatsAppMediaService } from 'src/whatsapp/chat/app/meta-media.service';
import { CloudStorageService } from 'src/cloud-storage-dospaces/app/cloud-storage-dospaces.service';
import { extFromMime } from 'src/Utils/extractors';
import { WhatsappApiMetaService } from 'src/whatsapp-api-meta/app/whatsapp-api-meta.service';
import { BroadCastMessageService } from './broadcast-message.service';
import { dayjs } from 'src/Utils/dayjs.config';
import { TZGT } from 'src/Utils/TZGT';
import {
  OpenAiIaService,
  ReplyResult,
} from 'src/open-ia/app/open-ia-rag.service';
import { ChatCompletionMessageParam } from 'openai/resources/index';

export interface IncomingMessageDto {
  // empresaSlug: string;
  // empresaNombreFallback: string;
  canal: ChatChannel;

  telefono: string;
  nombreClienteWhatsApp?: string | null;

  wamid: string;
  timestamp: bigint;
  replyToWamid?: string | null;

  direction: WazDirection;
  to: string;

  type: WazMediaType;
  texto: string;

  media?: MediaData | null;
}

export interface MediaData {
  mediaId: string; // message.image.id / message.document.id / ...
  kind: 'image' | 'document' | 'audio' | 'video' | 'sticker' | 'other';
  mimeType?: string | null; // del webhook (puede venir) o lo completarás con meta.getMediaUrl()
  filename?: string | null; // solo documentos
  extension?: string | null; // inferida por ti
}

@Injectable()
export class ChatOrchestratorService {
  private readonly logger = new Logger(ChatOrchestratorService.name);
  constructor(
    private readonly empresaService: EmpresaService, // EMPRESA DATOS -> ORQUESTADOR
    private readonly clienteService: ClienteService, // CLIENTES -> ORQUESTADOR
    private readonly chatService: ChatService, // SESIONES CHAT BOT -> ORQUESTADOR
    private readonly knowledgeService: KnowledgeService, // CONOCIMIENTO RAG
    // private readonly fireworksIa: FireworksIaService, // FIREWORKS-IA CEREBRO
    private readonly whatsappMessage: WhatsAppMessageService, // WHATSAPP MESSAGE SERVICE -> ORQUESTADOR DE MENSAJES
    private readonly metaWhatsappMedia: MetaWhatsAppMediaService, // DESCARGADOR DE MEDIA
    private readonly cloudStorageDoSpaces: CloudStorageService, // ALMACENAMIENTO BUCKET DO3
    private readonly whatsappApiMetaService: WhatsappApiMetaService, // SERVICION ADICIONAL PARA EVITAR ENROLLAMIENTO DE MODULOS
    private readonly broadcast: BroadCastMessageService, // SERVICION ADICIONAL PARA EVITAR ENROLLAMIENTO DE MODULOS
    private readonly openIA: OpenAiIaService, // SERVICION ADICIONAL PARA EVITAR ENROLLAMIENTO DE MODULOS
  ) {}

  /**
   *
   * @param params DATOS: E
   * @returns
   */
  async handleIncomingMessage(params: IncomingMessageDto) {
    const {
      // empresaSlug,
      // empresaNombreFallback,
      telefono,
      texto,
      canal,
      nombreClienteWhatsApp,
      wamid,
      media,
    } = params;

    if (params.direction !== WazDirection.INBOUND) {
      this.logger.warn('Mensaje no entrante ignorado por IA');
      return;
    }

    //  Empresa
    const empresa = await this.empresaService.ensureBySlug();

    //  Cliente
    let cliente = await this.clienteService.findByEmpresaAndTelefono(
      empresa.id,
      telefono,
    );

    if (!cliente) {
      const nombre =
        nombreClienteWhatsApp && nombreClienteWhatsApp.trim().length > 0
          ? nombreClienteWhatsApp.trim()
          : `Usuario ${telefono}`;

      cliente = await this.clienteService.create({
        empresaId: empresa.id,
        telefono,
        nombre,
      } as any);
    }

    const isDesactivated = !cliente.botActivo;

    // nuevo
    const session = await this.chatService.ensureOpenSession({
      empresaId: empresa.id,
      clienteId: cliente.id,
      telefono,
      canal,
    });

    //  Guardar mensaje del usuario (INBOUND)
    const userMessage = await this.chatService.addMessage({
      sessionId: session.id!,
      rol: ChatRole.USER,
      contenido: texto,
    });

    // STORAGE MEDIA & MESSAGE WHATSAPP
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaSha256: string | null = null;
    const mediaUrls: string[] = [];

    if (media?.mediaId) {
      try {
        const { buffer, meta } = await this.metaWhatsappMedia.fetchMedia(
          media.mediaId,
        );

        mediaMimeType =
          meta.mime_type ?? media.mimeType ?? 'application/octet-stream';
        mediaSha256 = meta.sha256 ?? null;

        const ext = media.extension ?? extFromMime(mediaMimeType) ?? 'bin';

        const key = generarKeyWhatsapp({
          empresaId: empresa.id,
          clienteId: cliente.id,
          sessionId: session.id!,
          wamid,
          tipo: media.kind,
          direction: params.direction,
          extension: ext,
          basePrefix: 'crm',
        });

        const uploaded = await this.cloudStorageDoSpaces.uploadBuffer({
          buffer,
          contentType: mediaMimeType,
          key,
          publicRead: true,
        });

        mediaUrl = uploaded.url ?? null;
        await this.chatService.addMediaUrlToMessage(userMessage.id, mediaUrl);
      } catch (error) {
        this.logger.error('Error procesando imagen (S3/Fetch)', error);
        mediaUrl = null;
      }
    }

    if (mediaUrl) {
      mediaUrls.push(mediaUrl);
    }

    const textWithMedia = texto;

    // ENTRADA DEL CLIENTE
    const isboundMsg = await this.whatsappMessage.upsertByWamid({
      wamid,
      chatSessionId: session.id!,
      clienteId: cliente.id,

      direction: params.direction,
      from: telefono,
      to: params.to,

      type: params.type, // WazMediaType
      body: texto ?? null,

      mediaUrl,
      mediaMimeType: mediaMimeType,
      mediaSha256,

      status:
        params.direction === WazDirection.INBOUND
          ? WazStatus.DELIVERED
          : WazStatus.SENT,
      replyToWamid: params.replyToWamid ?? null,
      timestamp: params.timestamp,
    });

    await this.clienteService.updateUltimoMensaje(cliente.id);

    this.broadcast.notifyCrmUI('nuvia:new-message', {
      wamid: isboundMsg.id,
      status: isboundMsg.status,
    });

    // PREPARAR TODO

    if (isDesactivated) {
      this.logger.log(
        `Bot desactivado para ${telefono}. Mensaje guardado, pero sin respuesta automática.`,
      );
      return { status: 'saved_silent', userMessage };
    }

    let reply: ReplyResult = { reply: '', responseId: '' };
    const manual = await this.knowledgeService.getManuals();
    this.logger.log(
      `LOS MANUALES RECUPERADOS SON:\n${JSON.stringify(manual, null, 2)}`,
    );
    try {
      // LLAMADA AL SERVICIO ACTUALIZADA
      reply = await this.openIA.replyWithContext({
        empresaNombre: empresa.nombre,
        manual,
        question: textWithMedia,
        imageUrls: mediaUrls,
        previousResponseId: session.openaiLastResponseId ?? null,
      });

      await this.chatService.updateSessionOpenAIResponseId(
        session.id!,
        reply.responseId,
      );
    } catch (e) {
      this.logger.error('Error OpenAI', e);
      reply = {
        reply: 'Errror procesando la solicitud: Catcheo',
        responseId: 'responseId',
      };
    }

    const botMessage = await this.chatService.addMessage({
      sessionId: session.id!,
      rol: ChatRole.ASSISTANT,
      contenido: reply.reply,
    });

    const { wamid: outWamid } = await this.whatsappApiMetaService.sendText(
      telefono,
      reply.reply,
    );

    const outMsg = await this.whatsappMessage.upsertByWamid({
      wamid: outWamid ?? `local-${crypto.randomUUID()}`,
      chatSessionId: session.id!,
      clienteId: cliente.id,

      direction: WazDirection.OUTBOUND,
      from: params.to,
      to: telefono,

      type: WazMediaType.TEXT,
      body: reply.reply,

      status: outWamid ? WazStatus.SENT : WazStatus.FAILED,
      replyToWamid: wamid,

      timestamp: BigInt(dayjs().tz(TZGT).unix()),

      mediaUrl: null,
      mediaMimeType: null,
      mediaSha256: null,
    });

    // NOTIFICAR UI (esto tampoco debe romper nada)
    this.broadcast.notifyCrmUI('nuvia:new-message', {
      wamid: outMsg.id,
      status: outMsg.status,
    });

    return { status: 'replied', userMessage, botMessage, reply };
  }

  /**
   * Procesa la actualización de estado (Sent, Delivered, Read, Failed)
   * que envía Meta Webhook.
   */
  async handleStatusUpdate(statusPayload: any) {
    const wamid = statusPayload.id;
    const rawStatus = statusPayload.status;

    // Log para depuración
    this.logger.debug(
      `Actualización de estado recibida para ${wamid}: ${rawStatus}`,
    );

    let newStatus: WazStatus | null = null;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    // Mapear estado de string (Meta) a Enum
    switch (rawStatus) {
      case 'sent':
        newStatus = WazStatus.SENT;
        break;
      case 'delivered':
        newStatus = WazStatus.DELIVERED;
        break;
      case 'read':
        newStatus = WazStatus.READ;
        break;
      case 'failed':
        newStatus = WazStatus.FAILED;
        // Meta suele enviar errores dentro de un array 'errors'
        if (statusPayload.errors && statusPayload.errors.length > 0) {
          const err = statusPayload.errors[0];
          errorCode = String(err.code);
          errorMessage = err.title || err.message;
        }
        break;
      default:
        this.logger.warn(`Estado desconocido recibido de Meta: ${rawStatus}`);
        return; // No hacemos nada si no conocemos el estado
    }

    if (newStatus && wamid) {
      try {
        const dataUpdate = {
          wamid,
          newStatus,
          errorCode,
          errorMessage,
        };
        await this.whatsappMessage.upsertByWamidStatus(dataUpdate);
        //  cambió el estado
        this.broadcast.notifyCrmUI('nuvia:new-message', {
          wamid: wamid,
          status: newStatus,
        });
      } catch (error) {
        // Nota: A veces el evento 'sent' llega tan rápido que la DB aún está
        // guardando el mensaje original (Race Condition).
        this.logger.warn(
          `No se pudo actualizar estado ${newStatus} para ${wamid}.`,
          error,
        );
      }
    }
  }
}
