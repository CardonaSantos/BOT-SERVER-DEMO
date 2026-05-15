import { Prisma } from '@prisma/client';

export const selectedCliente = {
  id: true,
  creadoEn: true,
  actualizadoEn: true,
  nombre: true,
  empresa: true,
  telefono: true,
  uuid: true,
  crmUsuarioId: true,
  empresaId: true,
  botActivo: true,

  whatsappHistory: {
    take: 1,
    orderBy: {
      creadoEn: 'desc',
    },

    select: {
      body: true,
      direction: true,
      mediaMimeType: true,
      status: true,
      timestamp: true,
      type: true,
    },
  },

  _count: {
    select: {
      whatsappHistory: {
        where: {
          direction: 'INBOUND',
          status: {
            not: 'READ',
          },
        },
      },
    },
  },
} satisfies Prisma.ClienteSelect;

export type selecteCliente = Prisma.ClienteGetPayload<{
  select: typeof selectedCliente;
}>;

export type selectedClientes = selecteCliente[];
