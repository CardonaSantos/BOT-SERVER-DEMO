import { ChatChannel, ChatSessionStatus } from '@prisma/client';

export class ChatSession {
  constructor(
    public readonly id: number | null, //es opcional al princio, luego lo actualizo con el primer response

    public openaiLastResponseId: string | null,

    public readonly empresaId: number,
    public readonly clienteId: number | null,
    public telefono: string,
    public canal: ChatChannel,
    public estado: ChatSessionStatus,
    public ultimoTicketCrmId: string | null,
    public ultimoTicketCreadoEn: Date | null,
    public readonly iniciadoEn?: Date,
    public cerradoEn?: Date | null,
    public readonly creadoEn?: Date,
    public readonly actualizadoEn?: Date,
  ) {}

  static create(props: {
    empresaId: number;
    clienteId?: number | null;

    telefono: string;
    canal: ChatChannel;
  }): ChatSession {
    return new ChatSession(
      null,
      null,
      props.empresaId,
      props.clienteId ?? null,
      props.telefono,
      props.canal,
      ChatSessionStatus.OPEN,
      null,
      null,
      new Date(),
      null,
      new Date(),
      new Date(),
    );
  }

  setOpenAIResponseId(responseId: string | null) {
    this.openaiLastResponseId = responseId;
  }
}
