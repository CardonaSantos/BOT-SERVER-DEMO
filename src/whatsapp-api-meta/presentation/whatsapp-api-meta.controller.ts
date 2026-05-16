import { Get, Patch, Param, Delete, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatChannel, WazDirection, WazMediaType } from '@prisma/client';
import { ChatOrchestratorService } from 'src/chat-orchestrator/app/chat-orchestrator.service';
import { logWhatsAppWebhook } from 'src/Utils/wa-webhook-logger';

import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MediaData } from 'src/Utils/mediaData.interface';
import {
  extFromFilename,
  extFromMime,
  mapMetaTypeToWaz,
} from 'src/Utils/extractors';

@Controller('whatsapp-meta')
export class WhatsappApiMetaController {
  private readonly logger = new Logger(WhatsappApiMetaController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly orquestador: ChatOrchestratorService,
  ) {}

  /**
   * El modelo de IA cerebro responde, prueba
   * @param body
   * @returns
   */
  @Post('send-test')
  async sentTest(@Body() body: { to: string; message: string }) {
    // const reply = await this.fireworksIa.simpleReply(body.message);
    // await this.whatsappApiMetaService.sendText(body.to, reply);
    // return { ok: true };
  }

  /**
   * CONTROLADOR PARA VERIFICACION DE META -> WHATSAPP
   * @param mode
   * @param token
   * @param challenge
   * @param res
   * @returns
   */
  @Get('webhook')
  verifyWebhook(@Query() query: any, @Res() res: Response) {
    this.logger.log(' Query params recibidos:', JSON.stringify(query));

    // NestJS suele parsear "hub.mode" como query.hub.mode
    const mode = query['hub.mode'] || query?.hub?.mode;
    const token = query['hub.verify_token'] || query?.hub?.verify_token;
    const challenge = query['hub.challenge'] || query?.hub?.challenge;

    this.logger.log(
      `🔍 Interpretado: Mode=${mode}, Token=${token}, Challenge=${challenge}`,
    );

    const VERIFY_TOKEN = this.config.get<string>('WHATSAPP_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      this.logger.log('✅ ¡VERIFICADO! Respondiendo challenge...');
      // Meta espera el challenge plano (texto), no JSON
      return res.status(HttpStatus.OK).send(challenge.toString());
    }

    this.logger.warn(
      `⛔ Falló: Token recibido [${token}] vs Esperado [${VERIFY_TOKEN}]`,
    );
    return res.sendStatus(HttpStatus.FORBIDDEN);
  }

  @Post('webhook')
  async handleWebhook(@Body() body: any, @Req() req: Request) {
    try {
      this.logger.debug('Webhook recibido');

      if (body.object !== 'whatsapp_business_account') {
        return;
      }

      const entryList = body.entry ?? [];

      for (const entry of entryList) {
        for (const change of entry.changes ?? []) {
          const value = change.value;

          const incomingPhoneId = value?.metadata?.phone_number_id;
          const myPhoneId = this.config.get<string>('WHATSAPP_PHONE_ID');

          if (incomingPhoneId !== myPhoneId) {
            this.logger.warn(
              `Webhook ignorado. phone_number_id no coincide. Incoming=${incomingPhoneId} Expected=${myPhoneId}`,
            );
            continue;
          }

          //  CASO 1: STATUS UPDATE
          if (Array.isArray(value?.statuses)) {
            for (const status of value.statuses) {
              await this.orquestador.handleStatusUpdate(status);
            }
            continue;
          }

          //  CASO 2: MENSAJES ENTRANTES
          const messages = value?.messages;
          if (!Array.isArray(messages) || messages.length === 0) {
            continue;
          }

          logWhatsAppWebhook(this.logger, req, body);

          const profileName = value?.contacts?.[0]?.profile?.name;
          const toNumber =
            value?.metadata?.display_phone_number ??
            process.env.WHATSAPP_DISPLAY_NUMBER ??
            '';

          for (const message of messages) {
            let textoExtraido = '';
            let mediaData: MediaData | null = null;

            const wamid = String(message.id);
            const timestamp = BigInt(message.timestamp);
            const replyToWamid = message?.context?.id ?? null;

            const direction = WazDirection.INBOUND;
            const typeEnum = mapMetaTypeToWaz(message.type);

            switch (message.type) {
              case 'text':
                textoExtraido = message.text?.body ?? '';
                break;

              case 'image': {
                const mimeType = message.image?.mime_type ?? null;
                textoExtraido = message.image?.caption ?? '[Imagen]';
                mediaData = {
                  mediaId: message.image?.id,
                  kind: 'image',
                  mimeType,
                  filename: null,
                  extension: extFromMime(mimeType),
                  direction,
                };
                break;
              }

              case 'document': {
                const mimeType = message.document?.mime_type ?? null;
                const filename = message.document?.filename ?? null;
                textoExtraido =
                  message.document?.caption ??
                  `[Documento${filename ? `: ${filename}` : ''}]`;

                mediaData = {
                  mediaId: message.document?.id,
                  kind: 'document',
                  mimeType,
                  filename,
                  extension: extFromFilename(filename) ?? extFromMime(mimeType),
                  direction,
                };
                break;
              }

              case 'audio': {
                const mimeType = message.audio?.mime_type ?? null;
                textoExtraido = '[Audio]';
                mediaData = {
                  mediaId: message.audio?.id,
                  kind: 'audio',
                  mimeType,
                  filename: null,
                  extension: extFromMime(mimeType) ?? 'ogg',
                  direction,
                };
                break;
              }

              default:
                textoExtraido = `[${message.type}]`;
            }

            await this.orquestador.handleIncomingMessage({
              empresaSlug: 'nova-sistemas',
              empresaNombreFallback: 'Nova Sistemas',
              telefono: message.from,
              nombreClienteWhatsApp: profileName,
              canal: ChatChannel.WHATSAPP,

              wamid,
              timestamp,
              replyToWamid,

              direction,
              to: toNumber,

              type: typeEnum,
              texto: textoExtraido,
              media: mediaData,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error en webhook WhatsApp', error);
    }
  }

  // TESTEO LOCAL

  @Post('message')
  async sendMessage(@Body() body: { message: string }) {
    const telefono = '40017273';

    await this.orquestador.handleIncomingMessage({
      empresaSlug: 'nova-sistemas',
      empresaNombreFallback: 'Nova Sistemas',

      canal: ChatChannel.WHATSAPP,

      telefono,
      nombreClienteWhatsApp: 'Test User',

      wamid: `test-${Date.now()}`, // 🔥 IMPORTANTE: único
      timestamp: BigInt(Math.floor(Date.now() / 1000)),
      replyToWamid: null,

      direction: WazDirection.INBOUND,
      to: 'local-test',

      type: WazMediaType.TEXT,
      texto: body.message,

      media: null,
    });

    return {
      ok: true,
      message: 'Mensaje enviado al orquestador',
    };
  }
}
