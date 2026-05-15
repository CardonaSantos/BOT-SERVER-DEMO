import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeRepository } from '../domain/knowledge.repository';
import { Knowledge } from '../entities/knowledge.entity';
import { throwFatalError } from 'src/Utils/CommonFatalError';
import { PrismaService } from 'src/prisma/prisma-service/prisma-service.service';
import { KnowledgeDocument, KnowledgeDocumentType } from '@prisma/client';

@Injectable()
export class PrismaKnowledgeRepository implements KnowledgeRepository {
  private readonly logger = new Logger(PrismaKnowledgeRepository.name);

  constructor(
    private readonly prisma: PrismaService,

    // private readonly fireworksIa: FireworksIaService,
  ) {}

  // Mapea fila de Prisma -> Entidad de dominio
  private toDomain(row: KnowledgeDocument | null): Knowledge | null {
    if (!row) return null;

    return new Knowledge(
      row.id,
      row.empresaId,
      row.tipo,
      row.externoId, // string | null
      row.origen,
      row.titulo,
      row.descripcion ?? undefined,
      row.textoLargo ?? undefined,
      row.creadoEn,
      row.actualizadoEn,
    );
  }

  async create(knowledge: Knowledge): Promise<Knowledge> {
    try {
      if (!knowledge.textoLargo || !knowledge.textoLargo.trim()) {
        throw new Error(
          'El texto largo del documento de conocimiento no puede estar vacío',
        );
      }

      // 1) Chunks a partir de textoLargo
      // const chunks = splitText(knowledge.textoLargo);

      // 2) Embeddings (modelo transformador)
      // const embeddings = await this.fireworksIa.embedMany(chunks);

      // 3) Crear KnowledgeDocument (guardamos resumen + textoLargo completo)
      const row = await this.prisma.knowledgeDocument.create({
        data: {
          empresaId: knowledge.empresaId,
          tipo: knowledge.tipo,
          externoId: knowledge.externoId,
          origen: knowledge.origen,
          titulo: knowledge.titulo,
          descripcion: knowledge.descripcion,
          textoLargo: knowledge.textoLargo,
        },
      });

      // 4) Insertar chunks + embeddings
      // await this.insertChunks(row.id, chunks, embeddings);

      const domain = this.toDomain(row);
      if (!domain) {
        throw new Error('Error al crear KnowledgeDocument: resultado vacío');
      }

      return domain;
    } catch (error) {
      throwFatalError(error, this.logger, 'PrismaKnowledgeRepository - create');
    }
  }

  async deleteById(id: number): Promise<Knowledge | null> {
    try {
      const rowDeleted = await this.prisma.knowledgeDocument.delete({
        where: {
          id,
        },
      });

      return this.toDomain(rowDeleted);
    } catch (error) {
      throwFatalError(error, this.logger, 'PrismaKnowledgeRepository - delete');
    }
  }

  async findAllByEmpresa(empresaId: number): Promise<Knowledge[]> {
    try {
      const id = empresaId ? empresaId : 1;
      const rows = await this.prisma.knowledgeDocument.findMany({
        where: {
          id: id,
        },
      });

      const rowsFormatted = rows.map((r) => this.toDomain(r));
      return rowsFormatted;
    } catch (error) {
      throwFatalError(error, this.logger, 'PrismaKnowledgeRepository - delete');
    }
  }

  async findById(id: number): Promise<Knowledge | null> {
    try {
      const rowFound = await this.prisma.knowledgeDocument.findUnique({
        where: {
          id,
        },
      });

      return this.toDomain(rowFound);
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'PrismaKnowledgeRepository - findById',
      );
    }
  }

  async update(id: number, data: Partial<Knowledge>): Promise<Knowledge> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.knowledgeDocument.findUnique({
          where: { id },
        });

        if (!existing) {
          throw new Error(`KnowledgeDocument ${id} no encontrado`);
        }

        // const textoCambio =
        //   typeof data.textoLargo === 'string' &&
        //   data.textoLargo.trim() !== existing.textoLargo?.trim();

        const updated = await tx.knowledgeDocument.update({
          where: { id },
          data: {
            titulo: data.titulo,
            descripcion: data.descripcion,
            tipo: data.tipo,
            origen: data.origen,
            empresaId: data.empresaId,
            externoId: data.externoId,
            textoLargo: data.textoLargo,
          },
        });

        // if (textoCambio) {
        //   await tx.knowledgeChunk.deleteMany({
        //     where: { documentId: id },
        //   });

        //   const chunks = splitTextRag(data.textoLargo!);

        //   this.logger.log(
        //     `Reindexando knowledge ${id} con ${chunks.length} chunks`,
        //   );

        //   if (chunks.length === 0) {
        //     throw new Error('No se generaron chunks válidos al actualizar');
        //   }

        //   const embeddings: number[][] = [];
        //   for (let i = 0; i < chunks.length; i += 8) {
        //     const batch = chunks.slice(i, i + 8);
        //     const batchEmbeddings = await this.fireworksIa.embedMany(batch);
        //     embeddings.push(...batchEmbeddings);
        //   }

        //   if (chunks.length !== embeddings.length) {
        //     throw new Error(
        //       `Mismatch chunks (${chunks.length}) vs embeddings (${embeddings.length})`,
        //     );
        //   }

        //   for (let i = 0; i < chunks.length; i++) {
        //     const texto = chunks[i];
        //     const embedding = embeddings[i];
        //     const tokensApprox = Math.round(texto.length / 4);

        //     await tx.$executeRaw`
        //     INSERT INTO "KnowledgeChunk"
        //       ("documentId", "indice", "texto", "embedding", "tokens", "creadoEn", "actualizadoEn")
        //     VALUES
        //       (
        //         ${id},
        //         ${i},
        //         ${texto},
        //         ${JSON.stringify(embedding)}::vector,
        //         ${tokensApprox},
        //         NOW(),
        //         NOW()
        //       )
        //   `;
        //   }
        // }

        return this.toDomain(updated)!;
      });
    } catch (error) {
      throwFatalError(error, this.logger, 'PrismaKnowledgeRepository - update');
    }
  }

  //CONOCIMIENTOS PARA CRM
  async findAll(): Promise<Knowledge[]> {
    try {
      const rows = await this.prisma.knowledgeDocument.findMany({});

      const rowsFormatted = rows.map((r) => this.toDomain(r));

      return rowsFormatted;
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'PrismaKnowledgeRepository - findAllCrm',
      );
    }
  }

  private async insertChunks(
    documentId: number,
    chunks: string[],
    embeddings: number[][],
  ): Promise<void> {
    try {
      for (let i = 0; i < chunks.length; i++) {
        const texto = chunks[i];
        const embedding = embeddings[i];

        if (!embedding) {
          throw new Error(
            `No se encontró embedding para el chunk con índice ${i}`,
          );
        }

        const embeddingJson = JSON.stringify(embedding);
        const tokensApprox = Math.round(texto.length / 4);

        await this.prisma.$executeRaw`
        INSERT INTO "KnowledgeChunk"
          ("documentId", "indice", "texto", "embedding", "tokens", "creadoEn", "actualizadoEn")
        VALUES
          (${documentId}, ${i}, ${texto}, ${embeddingJson}::vector, ${tokensApprox}, NOW(), NOW());
      `;
      }
    } catch (error) {
      throwFatalError(
        error,
        this.logger,
        'PrismaKnowledgeRepository - insertChunks',
      );
    }
  }

  // En tu knowledge.service.ts

  async getAllKnowledge(): Promise<string> {
    const KNOWLEDGE_TYPE_ORDER: Record<KnowledgeDocumentType, number> = {
      FAQ: 1,
      PROTOCOLO: 2,
      PLAN: 3,
      FUNCION: 4,
      DOCUMENTO: 5,
      CONTRATO: 6,
      COBRO: 7,
      TICKET: 8,
      OTRO: 99,
    };

    try {
      const docs = await this.prisma.knowledgeDocument.findMany({
        where: {
          activo: true,
        },
        select: {
          titulo: true,
          descripcion: true,
          textoLargo: true,
          tipo: true,
        },
        orderBy: {
          actualizadoEn: 'desc',
        },
      });

      if (docs.length === 0) return '';

      return [
        '## 📚 BASE DE CONOCIMIENTO',
        '',
        ...docs
          .sort(
            (a, b) =>
              KNOWLEDGE_TYPE_ORDER[a.tipo] - KNOWLEDGE_TYPE_ORDER[b.tipo],
          )
          .map((doc) =>
            `
### 📌 TIPO: ${doc.tipo}
#### TEMA: ${doc.titulo}

**DESCRIPCIÓN**
${doc.descripcion || 'Sin descripción.'}

**CONTENIDO**
${doc.textoLargo || 'Sin contenido.'}
`.trim(),
          ),
      ].join('\n\n---\n\n');
    } catch (error) {
      this.logger.error('Error obteniendo knowledge base', error);
      return '';
    }
  }
}
