// src/chat/app/chat.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatChannel, ChatRole } from '@prisma/client';
import {
  CHAT_SESSION_REPOSITORY,
  ChatSessionRepository,
} from '../domain/chat-session.repository';
import {
  CHAT_MESSAGE_REPOSITORY,
  ChatMessageRepository,
} from '../domain/chat-message.repository';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatSession } from '../entities/chat.entity';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  constructor(
    @Inject(CHAT_SESSION_REPOSITORY)
    private readonly sessionRepo: ChatSessionRepository,
    @Inject(CHAT_MESSAGE_REPOSITORY)
    private readonly messageRepo: ChatMessageRepository,
  ) {}

  async createSession(dto: {
    empresaId: number;
    clienteId?: number | null;
    telefono: string;
    canal: ChatChannel;
  }): Promise<ChatSession> {
    const session = ChatSession.create({
      empresaId: dto.empresaId,
      clienteId: dto.clienteId ?? null,
      telefono: dto.telefono,
      canal: dto.canal,
    });

    return this.sessionRepo.create(session);
  }

  async ensureOpenSession(opts: {
    empresaId: number;
    clienteId?: number | null;
    telefono: string;
    canal: ChatChannel;
  }): Promise<ChatSession> {
    const existing = await this.sessionRepo.findOpenByEmpresaTelefonoCanal(
      opts.empresaId,
      opts.telefono,
      opts.canal,
    );

    if (existing) return existing;

    return this.createSession(opts);
  }

  async closeSession(sessionId: number): Promise<ChatSession> {
    return this.sessionRepo.closeSession(sessionId);
  }

  async attachTicketToSession(
    sessionId: number,
    ticketId: string,
  ): Promise<ChatSession> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) return null;

    session.ultimoTicketCrmId = ticketId;
    session.ultimoTicketCreadoEn = new Date();

    return this.sessionRepo.update(sessionId, session);
  }

  async addMessage(opts: {
    sessionId: number;
    rol: ChatRole;
    contenido: string;
    tokens?: number | null;
  }): Promise<ChatMessage> {
    const message = ChatMessage.create({
      sessionId: opts.sessionId,
      rol: opts.rol,
      contenido: opts.contenido,
      tokens: opts.tokens ?? null,
    });

    return this.messageRepo.create(message);
  }

  /**
   * NUEVO METODO DE ACTUALIZACION
   * @param sessionId
   * @param responseId
   */
  async updateSessionOpenAIResponseId(
    sessionId: number,
    responseId: string | null,
  ): Promise<void> {
    await this.sessionRepo.updateOpenAIResponseId(sessionId, responseId);
  }

  async addMediaUrlToMessage(messageId: number, mediaUrl: string) {
    return await this.messageRepo.addMediaUrlToMessage(messageId, mediaUrl);
  }

  async getMessages(sessionId: number): Promise<ChatMessage[]> {
    return this.messageRepo.findBySession(sessionId);
  }

  async getLastMessages(sessionId: number): Promise<ChatMessage[]> {
    return this.messageRepo.findLastBySession(sessionId);
  }

  async findLastSession(clienteId: number): Promise<ChatSession> {
    return this.sessionRepo.findLastSession(clienteId);
  }

  async markChatAsRead(clienteId: number) {
    return this.messageRepo.markChatAsRead(clienteId);
  }

  async removeChatsAndSesions(clienteId: number) {
    return await this.removeChatsAndSesions(clienteId);
  }

  // MIGRACOIN MASIVA
}
