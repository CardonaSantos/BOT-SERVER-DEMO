import {
  Body,
  Controller,
  Post,
  Logger,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PrismaService } from 'src/prisma/prisma-service/prisma-service.service';
import { SendHumanTextService } from '../app/send-human-text.service';

@Controller('agent/chat')
export class AgentChatController {
  private readonly logger = new Logger(AgentChatController.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly humanResponse: SendHumanTextService,
  ) {}

  @Post('send')
  @UseInterceptors(FileInterceptor('file')) // 👈 Habilita recibir archivos
  async sendMessage(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { clienteId: string; text: string }, // Llegan como string por FormData
  ) {
    const clienteId = Number(body.clienteId); // Convertir string a numero
    const text = body.text || '';

    await this.humanResponse.sendHumanResponse(clienteId, text, file);
    return { ok: true };
  }

  @Post('toggle-bot')
  async toggleBot(@Body() body: { clienteId: number; active: boolean }) {
    await this.prisma.cliente.update({
      where: { id: body.clienteId },
      data: { botActivo: body.active },
    });
    return { ok: true };
  }
}
