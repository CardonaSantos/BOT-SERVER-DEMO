import { FindClientesMessagesQuery } from '../dto/dto-pagination';
import { ChatSidebarItem } from '../dto/responseType';
import { Cliente } from '../entities/cliente.entity';

// EMPRESA, ES LA ENTIDAD
export const CLIENTE_REPOSITORY = Symbol('CLIENTE_REPOSITORY');

export interface ClienteRepository {
  create(cliente: Cliente): Promise<Cliente>;
  update(id: number, data: Partial<Cliente>): Promise<Cliente>;
  findById(id: number): Promise<Cliente | null>;
  findByEmpresaAndTelefono(
    empresaId: number,
    telefono: string,
  ): Promise<Cliente | null>;
  upsertByEmpresaAndTelefono(
    empresaId: number,
    telefono: string,
    nombre?: string | null,
  ): Promise<Cliente>;
  findAllByEmpresa(empresaId: number): Promise<Cliente[]>;
  /** Nuevo método de consulta con paginación y filtros */
  findManyWithPagination(q: FindClientesMessagesQuery): Promise<{
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
  }>;

  updateUltimoMensaje(id: number): Promise<void>;
}
