import { Empresa } from '../entities/empresa.entity';
// EMPRESA, ES LA ENTIDAD
export const EMPRESA_REPOSITORY = Symbol('EMPRESA_REPOSITORY');

export interface EmpresaRepository {
  create(empresa: Empresa): Promise<Empresa>;
  update(id: number, data: Partial<Empresa>): Promise<Empresa>;
  findById(id: number): Promise<Empresa | null>;
  findBySlug(slug: string): Promise<Empresa | null>;
  upsertBySlug(): Promise<Empresa>;
  findAll(): Promise<Empresa[]>;
}
