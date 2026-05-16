// src/chat/infrastructure/prisma-chat-session.repository.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma-service/prisma-service.service';
import { ChatSessionRepository } from '../domain/chat-session.repository';
import { ChatChannel, ChatSessionStatus } from '@prisma/client';
import { throwFatalError } from 'src/Utils/CommonFatalError';
import { ChatSession } from '../entities/chat.entity';

@Injectable()
export class PrismaChatSessionRepository implements ChatSessionRepository {
  private readonly logger = new Logger(PrismaChatSessionRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: any): ChatSession | null {
    if (!row) return null;

    return new ChatSession(
      row.id,
      row.openaiLastResponseId ?? null,
      row.empresaId,
      row.clienteId ?? null,
      row.telefono,
      row.canal,
      row.estado,
      row.ultimoTicketCrmId ?? null,
      row.ultimoTicketCreadoEn ?? null,
      row.iniciadoEn ?? undefined,
      row.cerradoEn ?? null,
      row.creadoEn ?? undefined,
      row.actualizadoEn ?? undefined,
    );
  }

  async create(session: ChatSession): Promise<ChatSession> {
    try {
      const row = await this.prisma.chatSession.create({
        data: {
          empresaId: session.empresaId,
          clienteId: session.clienteId ?? undefined,
          telefono: session.telefono,
          canal: session.canal,
          estado: session.estado ?? ChatSessionStatus.OPEN,
          ultimoTicketCrmId: session.ultimoTicketCrmId ?? undefined,
          ultimoTicketCreadoEn: session.ultimoTicketCreadoEn ?? undefined,
          iniciadoEn: session.iniciadoEn ?? undefined,
          cerradoEn: session.cerradoEn ?? undefined,
          botId: 1,
        },
      });

      return this.toDomain(row)!;
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'Chat - PrismaChatSessionRepository.create',
      );
    }
  }

  async update(id: number, data: Partial<ChatSession>): Promise<ChatSession> {
    try {
      const row = await this.prisma.chatSession.update({
        where: { id },
        data: {
          empresaId: data.empresaId,
          clienteId: data.clienteId,
          telefono: data.telefono,
          canal: data.canal as ChatChannel,
          estado: data.estado as ChatSessionStatus,
          ultimoTicketCrmId: data.ultimoTicketCrmId,
          ultimoTicketCreadoEn: data.ultimoTicketCreadoEn,
          iniciadoEn: data.iniciadoEn,
          cerradoEn: data.cerradoEn,
          botId: 1,
        },
      });

      return this.toDomain(row)!;
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'Chat - PrismaChatSessionRepository.update',
      );
    }
  }

  async findById(id: number): Promise<ChatSession | null> {
    try {
      const row = await this.prisma.chatSession.findUnique({
        where: { id },
      });

      return this.toDomain(row);
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'Chat - PrismaChatSessionRepository.findById',
      );
    }
  }

  async findOpenByEmpresaTelefonoCanal(
    empresaId: number,
    telefono: string,
    canal: ChatChannel,
  ): Promise<ChatSession | null> {
    try {
      const row = await this.prisma.chatSession.findFirst({
        where: {
          empresaId,
          telefono,
          canal,
          estado: ChatSessionStatus.OPEN,
        },
        orderBy: { iniciadoEn: 'desc' },
      });

      return this.toDomain(row);
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'Chat - PrismaChatSessionRepository.findOpenByEmpresaTelefonoCanal',
      );
    }
  }

  async closeSession(id: number): Promise<ChatSession> {
    try {
      const row = await this.prisma.chatSession.update({
        where: { id },
        data: {
          estado: ChatSessionStatus.CLOSED,
          cerradoEn: new Date(),
          botId: 1,
        },
      });

      return this.toDomain(row)!;
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'Chat - PrismaChatSessionRepository.closeSession',
      );
    }
  }

  async findLastSession(clienteId: number): Promise<ChatSession | null> {
    try {
      const row = await this.prisma.chatSession.findFirst({
        where: {
          clienteId: clienteId,
        },
        orderBy: {
          creadoEn: 'desc',
        },
      });

      return row ? this.toDomain(row) : null;
    } catch (error) {
      throwFatalError(error, this.logger, 'Chat - findLastSession');
    }
  }

  /**
   * NUEVO ACTUALIZAR OPENIA ID R.
   * @param id
   * @param responseId
   * @returns
   */
  async updateOpenAIResponseId(
    id: number,
    responseId: string | null,
  ): Promise<ChatSession> {
    const row = await this.prisma.chatSession.update({
      where: { id },
      data: {
        openaiLastResponseId: responseId,
      },
    });

    return this.toDomain(row)!;
  }
}
