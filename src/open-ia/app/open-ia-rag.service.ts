import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from '../infraestructure/open-ia.client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma-service/prisma-service.service';
import { ChatCompletionMessageParam } from 'openai/resources/index';
import {
  ChatCompletionContentPart,
  ChatCompletionTool,
} from 'openai/resources/chat/completions';
import { CrmService } from 'src/crm/app/crm.service';
import { PosFunctionsService } from 'src/pos-functions/app/pos-functions.service';

export const OPENAI_TOOLS: ChatCompletionTool[] = [
  // CREACION DE TICKET DE SOPORTE TECNICO
  {
    type: 'function',
    function: {
      name: 'crear_ticket_soporte',
      description: 'Crea un ticket de soporte técnico en el CRM',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título corto del problema' },
          descripcion: {
            type: 'string',
            description: 'Descripción detallada del problema',
          },
        },
        required: ['titulo', 'descripcion'],
        additionalProperties: false,
      },
    },
  },
  // FUNCION PLACEHOLDER
  {
    type: 'function',
    function: {
      name: 'buscar_producto_en_pos',
      description:
        'Consulta el inventario del POS en tiempo real. Úsala cuando el cliente pregunte por precios, stock o disponibilidad de un producto. Retorna coincidencias con stock desglosado por sucursal. Informa al cliente explícitamente en qué sucursal hay unidades disponibles.',
      parameters: {
        type: 'object',
        properties: {
          producto: {
            type: 'string',
            description:
              'Término de búsqueda principal (nombre del producto). Convertir a minúsculas. Ej: "galaxy s24", "funda", "cargador".',
          },
          categorias: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Lista de marcas o categorías mencionadas. Ej: Si busca "Teléfonos Samsung", aqui va ["samsung"].',
          },
        },
        required: ['producto'],
        additionalProperties: false,
      },
    },
  },
];

@Injectable()
export class OpenAiIaService {
  private readonly logger = new Logger(OpenAiIaService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crmService: CrmService,
    private readonly pos_erp_Service: PosFunctionsService,

    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
  ) {}

  async replyWithContext(params: {
    empresaNombre: string;
    history: ChatCompletionMessageParam[];
    question: string;
    manual: string;
    imageUrls?: string[];
  }): Promise<string> {
    const { empresaNombre, imageUrls, history, question, manual } = params;

    // ========================
    // 1. CARGAR CONFIGURACIÓN
    // ========================
    const botParams = await this.prisma.bot.findUnique({
      where: { id: 1 },
      select: {
        systemPrompt: true,
        temperature: true,
        maxCompletionTokens: true,
        frequencyPenalty: true,
        presencePenalty: true,
        topP: true,
      },
    });

    if (!botParams) {
      this.logger.error('Configuración del bot no encontrada en BD');
      return 'Configuración del asistente no disponible en este momento.';
    }

    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5.5';

    const temperature = botParams.temperature ?? 0.3;
    const maxTokens = botParams.maxCompletionTokens ?? 512;
    const topP = botParams.topP ?? 1.0;
    const frequencyPenalty = botParams.frequencyPenalty ?? 0;
    const presencePenalty = botParams.presencePenalty ?? 0;

    // ========================
    // 2. SYSTEM PROMPT FINAL
    // ========================
    const finalSystemPrompt = `
${manual || ''}
ERES EL ASISTENTE DE: ${empresaNombre}
${botParams.systemPrompt ?? ''}
`.trim();

    // ========================
    // 3. CONTENIDO DEL USUARIO
    // ========================
    const userContent: ChatCompletionContentPart[] = [];

    if (question?.trim()) {
      userContent.push({ type: 'text', text: question });
    } else if (!imageUrls?.length) {
      userContent.push({ type: 'text', text: 'Hola' });
    }

    if (imageUrls?.length) {
      for (const url of imageUrls) {
        userContent.push({
          type: 'image_url',
          image_url: { url, detail: 'auto' },
        });
      }
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: finalSystemPrompt },
      ...history,
      { role: 'user', content: userContent },
    ];

    try {
      // ========================
      // 4. PRIMERA LLAMADA (LLM)
      // ========================
      const firstResponse = await this.openai.chat.completions.create({
        model,
        messages,
        tools: OPENAI_TOOLS,
        tool_choice: 'auto',
        temperature,
        max_tokens: maxTokens,
        presence_penalty: presencePenalty,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
      });

      const assistantMessage = firstResponse.choices[0]?.message;

      if (!assistantMessage) {
        this.logger.error('OpenAI no retornó mensaje en primera llamada');
        return 'No pude procesar tu solicitud en este momento.';
      }

      // ========================
      // 5. SIN TOOLS → RESPUESTA DIRECTA
      // ========================
      if (!assistantMessage.tool_calls?.length) {
        return assistantMessage.content ?? '';
      }

      this.logger.log(
        `🛠 Ejecutando ${assistantMessage.tool_calls.length} herramienta(s)`,
      );

      messages.push(assistantMessage);

      // ========================
      // 6. EJECUCIÓN DE TOOLS
      // ========================
      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== 'function') continue;

        let args: any;
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (err) {
          this.logger.error(
            `❌ Error parseando argumentos de tool ${toolCall.function.name}`,
            err,
          );
          continue;
        }

        // ========================
        // 6.1 CREAR TICKET
        // ========================
        if (toolCall.function.name === 'crear_ticket_soporte') {
          try {
            const ticket = await this.crmService.create({
              titulo: args.titulo,
              descripcion: args.descripcion,
            });

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                status: 'success',
                ticket_id: ticket.id,
              }),
            });
          } catch (err) {
            this.logger.error('❌ Error creando ticket CRM', err);

            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify([]),
            });
          }
        }

        // ========================
        // 6.2 BUSCAR PRODUCTOS POS
        // ========================
        if (toolCall.function.name === 'buscar_producto_en_pos') {
          const dto = {
            producto: args.producto,
            categorias: Array.isArray(args.categorias) ? args.categorias : [],
          };

          this.logger.log(
            `➡️ POS | DTO enviado:\n${JSON.stringify(dto, null, 2)}`,
          );

          let productos: any[] = [];

          try {
            const raw = await this.pos_erp_Service.search(dto);

            if (Array.isArray(raw)) {
              productos = raw;
            } else {
              this.logger.warn(
                `⚠️ POS respondió formato inválido: ${typeof raw}`,
              );
            }
          } catch (err) {
            this.logger.error('❌ Error llamando POS ERP', err);
          }

          this.logger.log(`⬅️ POS | Productos retornados: ${productos.length}`);

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(productos),
          });
        }
      }

      // ========================
      // 7. SEGUNDA LLAMADA (RESPUESTA FINAL)
      // ========================
      const finalResponse = await this.openai.chat.completions.create({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        presence_penalty: presencePenalty,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
      });

      return finalResponse.choices[0]?.message?.content ?? '';
    } catch (error) {
      this.logger.error('❌ Error general OpenAiIaService', error);

      if (error instanceof OpenAI.APIError) {
        this.logger.error(`OpenAI APIError: ${JSON.stringify(error.error)}`);
      }

      return 'Lo siento, tuve un error interno procesando tu solicitud.';
    }
  }
}
