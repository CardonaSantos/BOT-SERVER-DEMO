import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappApiMetaController } from './presentation/whatsapp-api-meta.controller';
import { ChatOrchestratorModule } from 'src/chat-orchestrator/chat-orchestrator.module';
import { WhatsappApiClientModule } from './whatsapp-api-client.module';

@Module({
  imports: [
    ConfigModule,
    ChatOrchestratorModule,
    WhatsappApiClientModule, // ✅ para send-test si lo ocupas aquí también
  ],
  controllers: [WhatsappApiMetaController],
})
export class WhatsappApiMetaModule {}
