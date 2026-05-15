import { ChatSidebarItem } from '../dto/responseType';
import { selecteCliente } from '../selects/select-cliente';

export function mappChatSidebarItem(
  items: selecteCliente[],
): ChatSidebarItem[] {
  if (!items.length) return [];

  return items.map((item): ChatSidebarItem => {
    const lastMessage = item.whatsappHistory?.[0];

    return {
      id: item.id,

      empresaId: item.empresaId,

      contacto: {
        nombre: item.nombre,
        telefono: item.telefono,

        avatarUrl: null,

        iniciales: item.nombre
          ?.split(' ')
          .slice(0, 2)
          .map((n) => n.charAt(0).toUpperCase())
          .join(''),

        crmUsuarioId: item.crmUsuarioId,

        uuid: item.uuid,

        botActivo: item.botActivo,
      },

      chat: {
        unreadCount: item._count.whatsappHistory,

        archived: false,

        pinned: false,

        muted: false,

        status: 'OPEN',

        canal: 'WHATSAPP',

        lastActivityAt: item.actualizadoEn.toISOString(),

        createdAt: item.creadoEn.toISOString(),
      },

      ultimoMensaje: lastMessage
        ? {
            id: 0,

            contenido: lastMessage.body,

            tipo: lastMessage.type,

            direccion: lastMessage.direction,

            estado: lastMessage.status,

            enviadoPorBot: lastMessage.direction === 'OUTBOUND',

            mediaUrl: null,

            timestamp: Number(lastMessage.timestamp),

            creadoEn: item.actualizadoEn.toISOString(),
          }
        : undefined,

      crm: {
        clienteRegistrado: !!item.crmUsuarioId,

        ticketAbierto: false,

        ultimoTicketCrmId: null,
      },

      sesion: undefined,
    };
  });
}
