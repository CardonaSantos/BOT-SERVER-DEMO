/**
 * prisma/seed-migrate.ts
 * ──────────────────────────────────────────────────────────────
 * Migra datos de la DB vectorial antigua → DB nueva (Postgres normal).
 * Omite KnowledgeDocument y KnowledgeChunk.
 *
 * Corre con:
 *   npx ts-node prisma/seed-migrate.ts
 * ──────────────────────────────────────────────────────────────
 */

import { Pool, PoolClient } from 'pg';

// ── Credenciales ─────────────────────────────────────────────
const OLD_DB =
  'postgresql://postgres:65jje933j8g3xt9w853dpbnp0s70z6w1@tramway.proxy.rlwy.net:33678/railway';
const NEW_DB =
  'postgresql://postgres:upRtamUwriabfpGTProxjAZsLDDGzwSV@yamanote.proxy.rlwy.net:29501/railway';

const BATCH = 150;

// ── Pools ────────────────────────────────────────────────────
const oldPool = new Pool({ connectionString: OLD_DB, ssl: false });
const newPool = new Pool({ connectionString: NEW_DB, ssl: false });

// ── Helpers de log ───────────────────────────────────────────
const pad = (s: string) => s.padEnd(20);
const log = (label: string, n: number) =>
  process.stdout.write(`\r  [${pad(label)}] ${n} procesados...   `);
const ok = (label: string, n: number) =>
  console.log(`\n   ${pad(label)} → ${n} registros`);
const sep = (t: string) => console.log(`\n${'─'.repeat(52)}\n  ${t}`);

/** Lee la tabla origen en batches */
async function* readBatches(
  table: string,
): AsyncGenerator<Record<string, any>[]> {
  let offset = 0;
  while (true) {
    const { rows } = await oldPool.query(
      `SELECT * FROM "${table}" ORDER BY id LIMIT $1 OFFSET $2`,
      [BATCH, offset],
    );
    if (rows.length === 0) break;
    yield rows;
    if (rows.length < BATCH) break;
    offset += rows.length;
  }
}

/** INSERT idempotente — si el id ya existe no hace nada */
async function upsertRow(
  client: PoolClient,
  table: string,
  columns: string[],
  values: any[],
): Promise<boolean> {
  const cols = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  try {
    await client.query(
      `INSERT INTO "${table}" (${cols}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
      values,
    );
    return true;
  } catch (e: any) {
    process.stderr.write(`\n  Fila omitida en ${table}: ${e.message}\n`);
    return false;
  }
}

/** Resetea el sequence para que autoincrement no colisione con IDs importados */
async function resetSeq(client: PoolClient, table: string) {
  await client.query(`
    SELECT setval(
      pg_get_serial_sequence('"${table}"', 'id'),
      COALESCE((SELECT MAX(id) FROM "${table}"), 1)
    )
  `);
}

// ════════════════════════════════════════════════════════════
//  TABLAS
// ════════════════════════════════════════════════════════════

async function migrateEmpresas(c: PoolClient) {
  sep('1/6  Empresa');
  let total = 0;
  const cols = ['id', 'nombre', 'slug', 'activo', 'creadoEn', 'actualizadoEn'];
  for await (const batch of readBatches('Empresa')) {
    for (const r of batch) {
      const ok2 = await upsertRow(c, 'Empresa', cols, [
        r.id,
        r.nombre,
        r.slug,
        r.activo ?? true,
        r.creadoEn,
        r.actualizadoEn,
      ]);
      if (ok2) total++;
      log('Empresa', total);
    }
  }
  await resetSeq(c, 'Empresa');
  ok('Empresa', total);
}

async function migrateBots(c: PoolClient) {
  sep('2/6  Bot');
  let total = 0;
  const cols = [
    'id',
    'empresaId',
    'nombre',
    'slug',
    'descripcion',
    'provider',
    'model',
    'systemPrompt',
    'contextPrompt',
    'historyPrompt',
    'outputStyle',
    'maxCompletionTokens',
    'temperature',
    'topP',
    'frequencyPenalty',
    'presencePenalty',
    'maxHistoryMessages',
    'status',
    'creadoEn',
    'actualizadoEn',
  ];
  for await (const batch of readBatches('Bot')) {
    for (const r of batch) {
      const ok2 = await upsertRow(c, 'Bot', cols, [
        r.id,
        r.empresaId,
        r.nombre,
        r.slug,
        r.descripcion ?? null,
        r.provider ?? 'fireworks',
        r.model ?? 'accounts/fireworks/models/gpt-oss-120b',
        r.systemPrompt ?? '',
        r.contextPrompt ?? null,
        r.historyPrompt ?? null,
        r.outputStyle ?? null,
        r.maxCompletionTokens ?? 500,
        parseFloat(r.temperature ?? '0.7'),
        r.topP != null ? parseFloat(r.topP) : 0.9,
        r.frequencyPenalty != null ? parseFloat(r.frequencyPenalty) : 0.2,
        r.presencePenalty != null ? parseFloat(r.presencePenalty) : 0.0,
        r.maxHistoryMessages ?? 15,
        r.status ?? 'ACTIVE',
        r.creadoEn,
        r.actualizadoEn,
      ]);
      if (ok2) total++;
      log('Bot', total);
    }
  }
  await resetSeq(c, 'Bot');
  ok('Bot', total);
}

async function migrateClientes(c: PoolClient) {
  sep('3/6  Cliente');
  let total = 0;
  const cols = [
    'id',
    'empresaId',
    'nombre',
    'telefono',
    'uuid',
    'crmUsuarioId',
    'botActivo',
    'ultimoMensajeFecha',
    'creadoEn',
    'actualizadoEn',
  ];
  for await (const batch of readBatches('Cliente')) {
    for (const r of batch) {
      const ok2 = await upsertRow(c, 'Cliente', cols, [
        r.id,
        r.empresaId,
        r.nombre ?? null,
        r.telefono,
        r.uuid ?? null,
        r.crmUsuarioId ?? null,
        r.botActivo ?? true,
        r.ultimoMensajeFecha ?? new Date(),
        r.creadoEn,
        r.actualizadoEn,
      ]);
      if (ok2) total++;
      log('Cliente', total);
    }
  }
  await resetSeq(c, 'Cliente');
  ok('Cliente', total);
}

async function migrateChatSessions(c: PoolClient) {
  sep('4/6  ChatSession');
  let total = 0;
  const cols = [
    'id',
    'empresaId',
    'botId',
    'clienteId',
    'telefono',
    'canal',
    'estado',
    'ultimoTicketCrmId',
    'ultimoTicketCreadoEn',
    'iniciadoEn',
    'cerradoEn',
    'flowIntent',
    'flowStep',
    'flowContext',
    'openaiLastResponseId',
    'creadoEn',
    'actualizadoEn',
  ];
  for await (const batch of readBatches('ChatSession')) {
    for (const r of batch) {
      const ok2 = await upsertRow(c, 'ChatSession', cols, [
        r.id,
        r.empresaId,
        r.botId ?? null,
        r.clienteId ?? null,
        r.telefono,
        r.canal,
        r.estado ?? 'OPEN',
        r.ultimoTicketCrmId ?? null,
        r.ultimoTicketCreadoEn ?? null,
        r.iniciadoEn,
        r.cerradoEn ?? null,
        r.flowIntent ?? 'NONE',
        r.flowStep ?? 'NONE',
        // flowContext → pg lo trae ya parseado como objeto
        r.flowContext != null ? JSON.stringify(r.flowContext) : null,
        r.openaiLastResponseId ?? null,
        r.creadoEn,
        r.actualizadoEn,
      ]);
      if (ok2) total++;
      log('ChatSession', total);
    }
  }
  await resetSeq(c, 'ChatSession');
  ok('ChatSession', total);
}

async function migrateChatMessages(c: PoolClient) {
  sep('5/6  ChatMessage');
  let total = 0;
  const cols = [
    'id',
    'sessionId',
    'rol',
    'contenido',
    'tokens',
    'mediaUrl',
    'creadoEn',
    'actualizadoEn',
  ];
  for await (const batch of readBatches('ChatMessage')) {
    for (const r of batch) {
      const ok2 = await upsertRow(c, 'ChatMessage', cols, [
        r.id,
        r.sessionId,
        r.rol,
        r.contenido,
        r.tokens ?? null,
        r.mediaUrl ?? null,
        r.creadoEn,
        r.actualizadoEn,
      ]);
      if (ok2) total++;
      log('ChatMessage', total);
    }
  }
  await resetSeq(c, 'ChatMessage');
  ok('ChatMessage', total);
}

async function migrateWhatsappMessages(c: PoolClient) {
  sep('6/6  WhatsappMessage');
  let total = 0;
  // "from" y "to" son palabras reservadas SQL — van entre comillas en la query,
  // pero aquí en el array de columnas los pasamos igual (upsertRow los quotea)
  const cols = [
    'id',
    'wamid',
    'chatSessionId',
    'clienteId',
    'direction',
    'from',
    'to',
    'type',
    'body',
    'mediaUrl',
    'mediaMimeType',
    'mediaSha256',
    'status',
    'errorCode',
    'errorMessage',
    'replyToWamid',
    'timestamp',
    'creadoEn',
    'actualizadoEn',
  ];
  for await (const batch of readBatches('WhatsappMessage')) {
    for (const r of batch) {
      // ⚠️ timestamp es BigInt en Prisma — pg lo trae como string desde la DB vieja
      // Lo pasamos como string para evitar overflow en JS Number
      const ts: string = r.timestamp != null ? r.timestamp.toString() : '0';

      const ok2 = await upsertRow(c, 'WhatsappMessage', cols, [
        r.id,
        r.wamid,
        r.chatSessionId ?? null,
        r.clienteId ?? null,
        r.direction,
        r.from,
        r.to,
        r.type,
        r.body ?? null,
        r.mediaUrl ?? null,
        r.mediaMimeType ?? null,
        r.mediaSha256 ?? null,
        r.status ?? 'SENT',
        r.errorCode ?? null,
        r.errorMessage ?? null,
        r.replyToWamid ?? null,
        ts, // string — Postgres lo castea a bigint sin problema
        r.creadoEn,
        r.actualizadoEn,
      ]);
      if (ok2) total++;
      log('WhatsappMessage', total);
    }
  }
  await resetSeq(c, 'WhatsappMessage');
  ok('WhatsappMessage', total);
}

// ════════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════════

async function main() {
  console.log('\n  MIGRACIÓN INICIANDO');
  console.log('─'.repeat(52));
  console.log('  Origen  → tramway.proxy.rlwy.net:33678');
  console.log('  Destino → yamanote.proxy.rlwy.net:29501');
  console.log('  Batch   →', BATCH, 'filas por lote');

  // Verificar conexiones antes de empezar
  console.log('\n  Verificando conexiones...');
  await oldPool.query('SELECT 1');
  console.log('   DB antigua OK');
  await newPool.query('SELECT 1');
  console.log('   DB nueva OK');

  const client = await newPool.connect();
  const t0 = Date.now();

  try {
    await migrateEmpresas(client);
    await migrateBots(client);
    await migrateClientes(client);
    await migrateChatSessions(client);
    await migrateChatMessages(client);
    await migrateWhatsappMessages(client);

    const s = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n${'═'.repeat(52)}`);
    console.log(`  MIGRACIÓN COMPLETA en ${s}s`);
    console.log(`${'═'.repeat(52)}\n`);
  } catch (err) {
    console.error('\n Error fatal:', err);
    process.exit(1);
  } finally {
    client.release();
    await oldPool.end();
    await newPool.end();
  }
}

main();
