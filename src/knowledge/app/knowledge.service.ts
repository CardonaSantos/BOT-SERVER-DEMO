import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KnowledgeDocumentType } from '@prisma/client';
import {
  KNOWLEDGE_REPOSITORY,
  KnowledgeRepository,
} from '../domain/knowledge.repository';
import { CreateKnowledgeDocumentDto } from '../dto/create-knowledge-document.dto';
import { Knowledge } from '../entities/knowledge.entity';
import { UpdateKnowledgeDto } from '../dto/update-knowledge.dto';

export interface KnowledgeSearchResult {
  id: number;
  texto: string;
  documentId: number;
  indice: number;
  titulo: string;
  tipo: KnowledgeDocumentType;
  distance: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  constructor(
    @Inject(KNOWLEDGE_REPOSITORY)
    private readonly repo: KnowledgeRepository,
  ) {}
  // METODOS PARA CARGA DE DATOS Y ACTUALIZACIONES

  async createNewKnowledge(dto: CreateKnowledgeDocumentDto) {
    try {
      const data = Knowledge.create({
        empresaId: dto.empresaId,
        descripcion: dto.descripcion,
        titulo: dto.titulo,
        externoId: null,
        tipo: dto.tipo,
        origen: dto.origen,
        textoLargo: dto.textoLargo,
      });
      const newKnowledge = await this.repo.create(data);
      this.logger.log('El nuevo conocimiento es: ', newKnowledge);
    } catch (error) {
      this.logger.debug('Error ocurrido es:', error);
    }
  }

  // ----------------------------
  // OBTENER UNO
  // ----------------------------
  async findOne(id: number): Promise<Knowledge> {
    const result = await this.repo.findById(id);
    if (!result) {
      throw new NotFoundException('Documento de conocimiento no encontrado');
    }
    return result;
  }

  // ----------------------------
  // OBTENER TODOS POR EMPRESA
  // ----------------------------
  async findAllByEmpresa(empresaId: number): Promise<Knowledge[]> {
    return this.repo.findAllByEmpresa(empresaId);
  }

  // ----------------------------
  // ACTUALIZAR
  // ----------------------------
  async updateKnowledge(
    id: number,
    dto: UpdateKnowledgeDto,
  ): Promise<Knowledge> {
    // Si quieres re-generar embeddings al cambiar el texto, eso se haría
    // aquí (llamando al repo y rehaciendo chunks).
    // De momento solo actualizamos metadatos y descripción.
    const partial: Partial<Knowledge> = {
      titulo: dto.titulo,
      descripcion: dto.descripcion ?? dto.descripcion,
      tipo: dto.tipo,
      origen: dto.origen,
      textoLargo: dto.textoLargo,
      empresaId: dto.empresaId ?? 1,
      // idioma no está aún en la entidad, pero podrías agregarlo si lo necesitas
    };

    const updated = await this.repo.update(id, partial);
    if (!updated) {
      throw new NotFoundException('Documento de conocimiento no encontrado');
    }

    return updated;
  }

  // ----------------------------
  // ELIMINAR
  // ----------------------------
  async deleteKnowledge(id: number): Promise<Knowledge | null> {
    const deleted = await this.repo.deleteById(id);
    if (!deleted) {
      throw new NotFoundException('Documento de conocimiento no encontrado');
    }
    return deleted;
  }

  // ----------------------------
  // BÚSQUEDA VECTORIAL
  // ----------------------------

  async search(
    empresaId: number,
    query: string,
    limit = 7,
  ): Promise<KnowledgeSearchResult[]> {
    if (!query || query.trim().length < 3) {
      return [];
    }

    // try {
    //   const embedding = await this.fireworksIa.getEmbedding(query);
    //   const vectorLiteral = JSON.stringify(embedding);

    //   const rawLimit = limit * 3; // overfetch

    //   const rows = await this.prisma.$queryRawUnsafe<KnowledgeSearchResult[]>(
    //     `
    //   SELECT
    //     kc."id",
    //     kc."texto",
    //     kc."documentId",
    //     kc."indice",
    //     kd."titulo",
    //     kd."tipo",
    //     kc."embedding" <-> $2::vector AS "distance"
    //   FROM "KnowledgeChunk" kc
    //   JOIN "KnowledgeDocument" kd ON kc."documentId" = kd."id"
    //   WHERE kd."empresaId" = $1
    //   ORDER BY "distance" ASC
    //   LIMIT $3
    //   `,
    //     empresaId,
    //     vectorLiteral,
    //     rawLimit,
    //   );

    //   const MAX_DISTANCE = 0.45;

    //   const filtered = rows
    //     .filter((r) => r.distance !== null && r.distance <= MAX_DISTANCE)
    //     .sort((a, b) => a.distance - b.distance)
    //     .slice(0, limit);

    //   return filtered;
    // } catch (error) {
    //   this.logger.error(
    //     `Error RAG search empresa=${empresaId} query="${query.slice(0, 50)}"`,
    //     error,
    //   );
    //   return [];
    // }
  }

  async getManuals(): Promise<any> {
    return await this.repo.getAllKnowledge();
  }

  async findAllKnowledge() {
    return this.repo.findAll();
  }

  // METODOS PARA CARGA DE DATOS Y ACTUALIZACIONES

  /**
   * Parte un texto largo en chunks (~maxLen chars),
   * intentando respetar párrafos y oraciones.
   *
   * - Separa por párrafos (doble salto de línea).
   * - Si un párrafo es muy largo, lo corta por oraciones.
   * - Evita chunks vacíos.
   * - Intenta no dejar el último chunk demasiado pequeño.
   */
  private chunkText(text: string, maxLen = 800, minLen = 200): string[] {
    // Normalizar saltos de línea y espacios en blanco
    const clean = text.replace(/\r\n/g, '\n').trim();
    if (!clean) return [];

    const paragraphs = clean.split(/\n{2,}/); // separa por párrafos (2+ saltos)
    const chunks: string[] = [];
    let current = '';

    const pushCurrent = () => {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        chunks.push(trimmed);
      }
      current = '';
    };

    for (const raw of paragraphs) {
      const paragraph = raw.trim();
      if (!paragraph) continue;

      // Si el párrafo es MUY largo, lo partimos por oraciones
      if (paragraph.length > maxLen) {
        const sentences = paragraph.split(/(?<=[.!?¡¿])\s+/); // corta en ., ?, !

        for (const sentenceRaw of sentences) {
          const sentence = sentenceRaw.trim();
          if (!sentence) continue;

          let candidate = current ? `${current} ${sentence}` : sentence;

          // Si al agregar esta oración nos pasamos de maxLen...
          if (candidate.length > maxLen) {
            // Si lo que llevamos ya es razonable, lo empujamos
            if (current.trim().length >= minLen) {
              pushCurrent();
              current = sentence;
              candidate = current;
            } else if (!current) {
              // Oración individual demasiado larga: la partimos a lo bruto
              for (let i = 0; i < sentence.length; i += maxLen) {
                const part = sentence.slice(i, i + maxLen).trim();
                if (part) chunks.push(part);
              }
              current = '';
              continue;
            } else {
              // teníamos algo pequeño + oración larga: cerramos y empezamos nuevo
              pushCurrent();
              current = sentence;
              candidate = current;
            }
          }

          current = candidate;
        }

        // Cerramos chunk si quedó algo tras procesar el párrafo largo
        if (current.trim().length >= minLen) {
          pushCurrent();
        }

        continue;
      }

      // Párrafo "normal": intentamos unirlo al chunk actual
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length > maxLen) {
        // Si al unirlo nos pasamos, cerramos el chunk actual y empezamos uno nuevo
        if (current.trim().length > 0) {
          pushCurrent();
        }
        current = paragraph;
      } else {
        current = candidate;
      }
    }

    // Push final si quedó algo
    if (current.trim().length > 0) {
      pushCurrent();
    }

    // Si el último chunk quedó muy pequeñito, lo unimos con el anterior
    if (chunks.length > 1) {
      const last = chunks[chunks.length - 1];
      if (last.length < minLen) {
        chunks[chunks.length - 2] =
          `${chunks[chunks.length - 2]}\n\n${last}`.trim();
        chunks.pop();
      }
    }

    return chunks;
  }
}
