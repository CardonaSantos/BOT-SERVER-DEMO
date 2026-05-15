import { Module } from '@nestjs/common';
import { KnowledgeController } from './presentation/knowledge.controller';
import { KnowledgeService } from './app/knowledge.service';
import { PrismaModuleModule } from 'src/prisma/prisma-module/prisma-module.module';
import { KNOWLEDGE_REPOSITORY } from './domain/knowledge.repository';
import { PrismaKnowledgeRepository } from './infraestructure/prisma-knowledge.repository';

@Module({
  imports: [PrismaModuleModule],
  controllers: [KnowledgeController],
  providers: [
    KnowledgeService,
    {
      provide: KNOWLEDGE_REPOSITORY,
      useClass: PrismaKnowledgeRepository,
    },
  ],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
