import { Injectable, Logger } from '@nestjs/common';
import { EmpresaRepository } from '../domain/empresa.repository';
import { Empresa } from '../entities/empresa.entity';
import { PrismaService } from 'src/prisma/prisma-service/prisma-service.service';
import { throwFatalError } from 'src/Utils/CommonFatalError';

@Injectable()
export class PrismaEmpresaRepository implements EmpresaRepository {
  private readonly logger = new Logger(PrismaEmpresaRepository.name);
  constructor(private readonly prisma: PrismaService) {}

  private toDomain(row: any): Empresa {
    if (!row) return null;
    return new Empresa(
      row.id,
      row.nombre,
      row.slug,
      row.activo,
      row.creadoEn,
      row.actualizadoEn,
    );
  }

  /**
   * POST CREATE
   * @param empresa
   * @returns
   */
  async create(empresa: Empresa): Promise<Empresa> {
    try {
      const row = await this.prisma.empresa.create({
        data: {
          nombre: empresa.nombre,
          slug: empresa.slug,
          activo: empresa.activo,
        },
      });
      return this.toDomain(row);
    } catch (error) {
      throwFatalError(error, this.logger, 'PrismaEmpresa -Repositori.Create');
    }
  }

  async update(id: number, data: Partial<Empresa>): Promise<Empresa> {
    const row = await this.prisma.empresa.update({
      where: { id },
      data: {
        nombre: data.nombre,
        slug: data.slug,
        activo: data.activo,
      },
    });
    return this.toDomain(row);
  }

  async findById(id: number): Promise<Empresa | null> {
    const row = await this.prisma.empresa.findUnique({ where: { id } });
    return this.toDomain(row);
  }

  async findBySlug(slug: string): Promise<Empresa | null> {
    const row = await this.prisma.empresa.findUnique({ where: { slug } });
    return this.toDomain(row);
  }

  async upsertBySlug() // slug: string, nombre: string

  : Promise<Empresa> {
    const row = await this.prisma.empresa.findFirst({
      // update: { nombre },
      // create: { slug, nombre },
    });
    return this.toDomain(row);
  }

  async findAll(): Promise<Empresa[]> {
    const rows = await this.prisma.empresa.findMany({
      orderBy: { creadoEn: 'asc' },
    });
    return rows.map((r) => this.toDomain(r));
  }
}
