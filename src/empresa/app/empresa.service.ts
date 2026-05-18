import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateEmpresaDto } from '../dto/create-empresa.dto';
import { UpdateEmpresaDto } from '../dto/update-empresa.dto';
import {
  EMPRESA_REPOSITORY,
  EmpresaRepository,
} from '../domain/empresa.repository';
import { Empresa } from '../entities/empresa.entity';

@Injectable()
export class EmpresaService {
  private readonly logger = new Logger(EmpresaService.name);

  constructor(
    @Inject(EMPRESA_REPOSITORY)
    private readonly repo: EmpresaRepository,
  ) {}

  async create(dto: CreateEmpresaDto): Promise<Empresa> {
    this.logger.log(`DTO recibido:\n${JSON.stringify(dto, null, 2)}`);
    const empresa = Empresa.create({
      nombre: dto.nombre,
      slug: dto.slug,
    });
    if (dto.activo === false) {
      empresa.activo = false;
    }
    return this.repo.create(empresa);
  }

  async findAll(): Promise<Empresa[]> {
    return this.repo.findAll();
  }

  async findOne(id: number): Promise<Empresa> {
    const empresa = await this.repo.findById(id);
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  async findBySlug(slug: string): Promise<Empresa> {
    const empresa = await this.repo.findBySlug(slug);
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  // útil para el bot: si no existe, la crea
  async ensureBySlug(): Promise<Empresa> {
    return this.repo.upsertBySlug();
  }

  async update(id: number, dto: UpdateEmpresaDto): Promise<Empresa> {
    await this.findOne(id); // lanza NotFound si no existe
    return this.repo.update(id, dto);
  }
}
