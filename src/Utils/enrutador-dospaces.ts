import { WazDirection } from '@prisma/client';
import { WaMediaType } from './mediaData.interface';
import { dayjs } from 'src/Utils/dayjs.config';

function sanitizeExt(ext: string) {
  const clean = ext.replace('.', '').toLowerCase();
  return clean ? `.${clean}` : '';
}

export function generarKeyWhatsapp(params: {
  empresaId: number;
  clienteId: number;
  sessionId: number;
  wamid: string; // message.id de WhatsApp
  tipo: WaMediaType;
  direction: WazDirection;
  extension: string; // "pdf" | "jpg" | etc (sin punto o con punto)
  basePrefix?: string; // default: "crm"
  timestampUnixSeconds?: number; // si quieres usar el timestamp del mensaje
}) {
  const base = params.basePrefix ?? 'crm';

  const dt = params.timestampUnixSeconds
    ? dayjs.unix(params.timestampUnixSeconds)
    : dayjs();

  const y = dt.format('YYYY');
  const m = dt.format('MM');
  const d = dt.format('DD');

  const ext = sanitizeExt(params.extension);

  return `${base}/whatsapp/empresas/${params.empresaId}/clientes/${params.clienteId}/sesiones/${params.sessionId}/${y}/${m}/${d}/${params.direction}/${params.tipo}/${params.wamid}${ext}`;
}
