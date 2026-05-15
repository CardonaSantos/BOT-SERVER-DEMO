import { WazMediaType } from '@prisma/client';

export interface ChatSidebarItem {
  id: number;

  empresaId: number;

  // CONTACTO
  contacto: {
    nombre: string | null;
    telefono: string;

    avatarUrl?: string | null;

    iniciales?: string;

    crmUsuarioId?: number | null;

    uuid?: string | null;

    botActivo: boolean;
  };

  // CHAT STATE
  chat: {
    unreadCount: number;

    archived: boolean;

    pinned: boolean;

    muted?: boolean;

    status: 'OPEN' | 'CLOSED' | 'ARCHIVED';

    canal: 'WHATSAPP' | 'WEB' | 'TELEGRAM';

    lastActivityAt: string;

    createdAt: string;
  };

  // ÚLTIMO MENSAJE
  ultimoMensaje?: {
    id: number;

    contenido: string | null;

    tipo: WazMediaType;

    direccion: 'INBOUND' | 'OUTBOUND';

    estado: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

    enviadoPorBot: boolean;

    mediaUrl?: string | null;

    timestamp: number;

    creadoEn: string;
  };

  // CRM
  crm?: {
    ultimoTicketCrmId?: string | null;

    ticketAbierto?: boolean;

    clienteRegistrado?: boolean;
  };

  // SESIÓN
  sesion?: {
    id: number;

    botId?: number | null;

    botNombre?: string | null;
  };
}
