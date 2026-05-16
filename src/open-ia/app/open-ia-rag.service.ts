import { Inject, Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from '../infraestructure/open-ia.client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma-service/prisma-service.service';
import { CrmService } from 'src/crm/app/crm.service';
import { PosFunctionsService } from 'src/pos-functions/app/pos-functions.service';

export const OPENAI_TOOLS: OpenAI.Responses.Tool[] = [
  {
    type: 'function',
    name: 'crear_ticket_soporte',
    description: 'Crea un ticket de soporte técnico en el CRM',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        titulo: {
          type: 'string',
          description: 'Título corto del problema',
        },
        descripcion: {
          type: 'string',
          description: 'Descripción detallada del problema',
        },
      },
      required: ['titulo', 'descripcion'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'buscar_producto_en_pos',
    description:
      'Consulta el inventario del POS usando un término principal y categorías cortas relacionadas.',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        producto: {
          type: 'string',
          description:
            'Término principal de búsqueda. Debe ser corto y concreto. Ej: "iphone", "samsung", "laptop", "teclado".',
        },
        categorias: {
          type: 'array',
          description:
            'Etiquetas cortas relacionadas. Máximo 5 elementos. Ej: ["telefono", "celular", "smartphone", "apple"].',
          items: {
            type: 'string',
          },
          maxItems: 5,
        },
      },
      required: ['producto'],
      additionalProperties: false,
    },
  },
];

type ReplyParams = {
  empresaNombre: string;
  question: string;
  manual: string;
  imageUrls?: string[];
  previousResponseId?: string | null;
};

export type ReplyResult = {
  reply: string;
  responseId: string | null;
};

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

  private buildInstructions(
    empresaNombre: string,
    manual: string,
    systemPrompt?: string | null,
  ) {
    return [
      manual?.trim(),
      `ERES EL ASISTENTE DE: ${empresaNombre}`,
      systemPrompt?.trim(),
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildUserInput(
    question: string,
    imageUrls?: string[],
  ): OpenAI.Responses.ResponseInput {
    const content = [];

    if (question?.trim()) {
      content.push({
        type: 'input_text',
        text: question.trim(),
      });
    } else {
      content.push({
        type: 'input_text',
        text: 'Hola',
      });
    }

    for (const url of imageUrls ?? []) {
      content.push({
        type: 'input_image',
        image_url: url,
        detail: 'auto',
      });
    }

    return [
      {
        role: 'user',
        content,
      },
    ];
  }

  async replyWithContext(params: ReplyParams): Promise<ReplyResult> {
    const { empresaNombre, imageUrls, question, manual, previousResponseId } =
      params;

    const VECTOR_STORE_ID = this.config.get<string>('VECTOR_STORE_ID') ?? '';

    this.logger.log(
      `PARAMETROS en el builder :\n${JSON.stringify(params, null, 2)}`,
    );

    const botParams = await this.prisma.bot.findUnique({
      where: { id: 1 },
      select: {
        systemPrompt: true,
        temperature: true,
        maxCompletionTokens: true,
        topP: true,
      },
    });

    if (!botParams) {
      this.logger.error('Configuración del bot no encontrada en BD');
      return {
        reply: 'Configuración del asistente no disponible en este momento.',
        responseId: null,
      };
    }

    const model = this.config.get<string>('OPENAI_MODEL') ?? 'gpt-5.5';
    const maxTokens = botParams.maxCompletionTokens ?? 1200;
    // const temperature = botParams.temperature ?? 0.3;
    // const topP = botParams.topP ?? 1.0;

    const instructions = this.buildInstructions(
      empresaNombre,
      manual,
      botParams.systemPrompt,
    );

    const baseRequest: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
      model,
      instructions,
      tools: [
        {
          type: 'file_search',
          vector_store_ids: [VECTOR_STORE_ID],
        },
        ...OPENAI_TOOLS,
      ],
      tool_choice: 'auto',
      store: true,
      max_output_tokens: maxTokens,
      input: this.buildUserInput(question, imageUrls),
    };

    // ingreso la response id anterior
    if (previousResponseId) {
      baseRequest.previous_response_id = previousResponseId;
    }

    try {
      const firstResponse = await this.openai.responses.create(baseRequest);

      this.logger.log(
        `First Response es:\n${JSON.stringify(firstResponse, null, 2)}`,
      );

      let response = firstResponse;

      for (let depth = 0; depth < 3; depth++) {
        const functionCalls = (response.output ?? []).filter(
          (item: any) => item.type === 'function_call',
        );

        if (!functionCalls.length) {
          return {
            reply: response.output_text ?? '',
            responseId: response.id ?? null,
          };
        }

        const toolOutputs: any[] = [];

        for (const toolCall of functionCalls as any[]) {
          let args: any = {};
          try {
            args = JSON.parse(toolCall.arguments ?? '{}');
          } catch (err) {
            this.logger.error(
              `Error parseando argumentos de tool ${toolCall.name}`,
              err,
            );
          }

          if (toolCall.name === 'crear_ticket_soporte') {
            try {
              const ticket = await this.crmService.create({
                titulo: args.titulo,
                descripcion: args.descripcion,
              });

              toolOutputs.push({
                type: 'function_call_output',
                call_id: toolCall.call_id,
                output: JSON.stringify({
                  status: 'success',
                  ticket_id: ticket.id,
                }),
              });
            } catch (err) {
              this.logger.error('Error creando ticket CRM', err);
              toolOutputs.push({
                type: 'function_call_output',
                call_id: toolCall.call_id,
                output: JSON.stringify({
                  status: 'error',
                }),
              });
            }
          }

          if (toolCall.name === 'buscar_producto_en_pos') {
            const dto = {
              producto: args.producto,
              categorias: Array.isArray(args.categorias) ? args.categorias : [],
            };

            let productos: any[] = [];
            try {
              const raw = await this.pos_erp_Service.search(dto);
              if (Array.isArray(raw)) {
                productos = raw;
              }
            } catch (err) {
              this.logger.error('Error llamando POS ERP', err);
            }

            toolOutputs.push({
              type: 'function_call_output',
              call_id: toolCall.call_id,
              output: JSON.stringify(productos),
            });
          }
        }

        response = await this.openai.responses.create({
          model,
          instructions,
          input: toolOutputs,
          previous_response_id: response.id,
          tools: OPENAI_TOOLS,
          tool_choice: 'auto',
          store: true,
          max_output_tokens: maxTokens,
          // temperature,
          // top_p: topP,
        });
      }

      return {
        reply: 'No pude completar la respuesta en este momento.',
        responseId: null,
      };
    } catch (error) {
      this.logger.error('Error general OpenAiIaService', error);

      if (error instanceof OpenAI.APIError) {
        this.logger.error(`OpenAI APIError: ${JSON.stringify(error.error)}`);
      }

      return {
        reply: 'Lo siento, tuve un error interno procesando tu solicitud.',
        responseId: null,
      };
    }
  }
}
