// cliente.entity.ts

// 1. Ajustamos el tipo "Like" para que acepte la estructura que devuelve Prisma con _count
export type PrismaClienteWithCount = PrismaClienteLike & {
  _count?: {
    whatsappHistory: number;
  };
};

// Tu tipo base (sin el _count, opcionalmente puedes agregar mensajesSinVer directo si lo mapeas antes)
export type PrismaClienteLike = {
  id: number;
  empresaId: number;
  nombre: string | null;
  telefono: string;
  uuid: string | null;
  crmUsuarioId: number | null;
  botActivo: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
};

export class Cliente {
  constructor(
    public readonly id: number | null,
    public readonly empresaId: number,
    public nombre: string | null,
    public telefono: string,
    public uuid: string | null,
    public crmUsuarioId: number | null,
    public botActivo: boolean,

    // ✅ Nuevo campo (Unread Count)
    public mensajesSinVer: number,

    public readonly creadoEn?: Date,
    public readonly actualizadoEn?: Date,
  ) {}

  static create(props: {
    empresaId: number;
    nombre?: string | null;
    telefono: string;
    uuid?: string | null;
    crmUsuarioId?: number | null;
    botActivo?: boolean;
  }): Cliente {
    return new Cliente(
      null,
      props.empresaId,
      props.nombre ?? null,
      props.telefono,
      props.uuid ?? null,
      props.crmUsuarioId ?? null,
      props.botActivo ?? true,
      0, // ✅ Al crear uno nuevo, tiene 0 mensajes sin ver
      new Date(),
      new Date(),
    );
  }

  // ✅ Aquí está el truco del Mapeo
  static fromPrisma(row: PrismaClienteWithCount): Cliente {
    // Prisma devuelve el conteo dentro de un objeto _count
    const unreadCount = row._count?.whatsappHistory ?? 0;

    return new Cliente(
      row.id,
      row.empresaId,
      row.nombre ?? null,
      row.telefono,
      row.uuid ?? null,
      row.crmUsuarioId ?? null,
      row.botActivo,

      unreadCount,

      row.creadoEn,
      row.actualizadoEn,
    );
  }
}
