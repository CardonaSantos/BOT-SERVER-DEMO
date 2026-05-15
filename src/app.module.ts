import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModuleModule } from './prisma/prisma-module/prisma-module.module';
import { PrismaService } from './prisma/prisma-service/prisma-service.service';
import { WhatsappApiMetaModule } from './whatsapp-api-meta/whatsapp-api-meta.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { ConfigModule } from '@nestjs/config';
import { EmpresaModule } from './empresa/empresa.module';
import { ChatModule } from './chat/chat.module';
import { ClienteModule } from './cliente/cliente.module';
import { ChatOrchestratorModule } from './chat-orchestrator/chat-orchestrator.module';
import { BotModule } from './bot/bot.module';
import { CloudStorageDoSpacesModule } from './cloud-storage-dospaces/cloud-storage-dospaces.module';
import { WhatsappMessageModule } from './whatsapp/chat/chat.module';
import { CrmModule } from './crm/crm.module';
import { PosFunctionsModule } from './pos-functions/pos-functions.module';
import { OpenAiModule } from './open-ia/open-ia.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que el ConfigService esté disponible globalmente
      // envFilePath: '.env', // Es opcional, ya que por defecto busca .env en la raíz
    }),
    PrismaModuleModule,
    WhatsappApiMetaModule,
    KnowledgeModule,
    EmbeddingsModule,
    EmpresaModule,
    ChatModule,
    WhatsappMessageModule,
    ClienteModule,
    ChatOrchestratorModule,
    BotModule,
    CloudStorageDoSpacesModule,
    CrmModule,
    PosFunctionsModule,
    OpenAiModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
