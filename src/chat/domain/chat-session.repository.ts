// src/chat/domain/chat-session.repository.ts
import { ChatChannel } from '@prisma/client';
import { ChatSession } from '../entities/chat.entity';

export const CHAT_SESSION_REPOSITORY = Symbol('CHAT_SESSION_REPOSITORY');

export interface ChatSessionRepository {
  create(session: ChatSession): Promise<ChatSession>;
  update(id: number, data: Partial<ChatSession>): Promise<ChatSession>;
  findById(id: number): Promise<ChatSession | null>;
  findOpenByEmpresaTelefonoCanal(
    empresaId: number,
    telefono: string,
    canal: ChatChannel,
  ): Promise<ChatSession | null>;
  closeSession(id: number): Promise<ChatSession>;
  updateOpenAIResponseId(id: number, responseId: string): Promise<ChatSession>;

  findLastSession(id: number): Promise<ChatSession | null>;
}
