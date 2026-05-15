import { Inject, Injectable } from '@nestjs/common';
import { CreateClienteDto } from '../dto/create-cliente.dto';
import { UpdateClienteDto } from '../dto/update-cliente.dto';
import {
  CLIENTE_REPOSITORY,
  ClienteRepository,
} from '../domain/cliente.repository';
import { Cliente } from '../entities/cliente.entity';
import { FindClientesMessagesQuery } from '../dto/dto-pagination';
import { ChatSidebarItem } from '../dto/responseType';

@Injectable()
export class ClienteService {
  constructor(
    @Inject(CLIENTE_REPOSITORY)
    private readonly repo: ClienteRepository,
  ) {}

  async create(dto: CreateClienteDto): Promise<Cliente> {
    const cliente = Cliente.create({
      empresaId: dto.empresaId,
      nombre: dto.nombre ?? null,
      telefono: dto.telefono,
      uuid: dto.uuid ?? null,
      crmUsuarioId: dto.crmUsuarioId ?? null,
    });
    return this.repo.create(cliente);
  }

  async update(id: number, dto: UpdateClienteDto): Promise<Cliente> {
    return this.repo.update(id, dto);
  }

  async findById(id: number): Promise<Cliente> {
    return this.repo.findById(id);
  }

  async getAllClientes(q: FindClientesMessagesQuery): Promise<{
    data: ChatSidebarItem[];
    meta: {
      total: number;
      take: number;
      skip: number;
      page: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    return this.repo.findManyWithPagination(q);
  }

  async findByEmpresaAndTelefono(
    empresaId: number,
    telefono: string,
  ): Promise<Cliente | null> {
    return this.repo.findByEmpresaAndTelefono(empresaId, telefono);
  }

  async ensureByEmpresaAndTelefono(
    empresaId: number,
    telefono: string,
    nombre?: string | null,
  ): Promise<Cliente> {
    return this.repo.upsertByEmpresaAndTelefono(empresaId, telefono, nombre);
  }

  async updateUltimoMensaje(id: number) {
    return await this.repo.updateUltimoMensaje(id);
  }
}
