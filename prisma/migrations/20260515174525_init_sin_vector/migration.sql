-- CreateEnum
CREATE TYPE "KnowledgeDocumentType" AS ENUM ('FAQ', 'DOCUMENTO', 'CONTRATO', 'PLAN', 'TICKET', 'COBRO', 'PROTOCOLO', 'FUNCION', 'OTRO');

-- CreateEnum
CREATE TYPE "ChatRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('WHATSAPP', 'WEB', 'TELEGRAM', 'SMS', 'OTHER');

-- CreateEnum
CREATE TYPE "ChatSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChatFlowIntent" AS ENUM ('NONE', 'SOPORTE', 'VENTAS', 'FACTURACION', 'TIENDA', 'INFORMACION');

-- CreateEnum
CREATE TYPE "ChatFlowStep" AS ENUM ('NONE', 'IDENTIFICACION', 'DIAGNOSTICO', 'CONFIRMACION', 'ACCION', 'CIERRE');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "WazDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WazStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "WazMediaType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'STICKER', 'LOCATION', 'TEMPLATE', 'INTERACTIVE', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Empresa" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "descripcion" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'fireworks',
    "model" TEXT NOT NULL DEFAULT 'accounts/fireworks/models/gpt-oss-120b',
    "systemPrompt" TEXT NOT NULL,
    "contextPrompt" TEXT,
    "historyPrompt" TEXT,
    "outputStyle" TEXT,
    "maxCompletionTokens" INTEGER DEFAULT 500,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "topP" DOUBLE PRECISION DEFAULT 0.9,
    "frequencyPenalty" DOUBLE PRECISION DEFAULT 0.2,
    "presencePenalty" DOUBLE PRECISION DEFAULT 0.0,
    "maxHistoryMessages" INTEGER DEFAULT 15,
    "status" "BotStatus" NOT NULL DEFAULT 'ACTIVE',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT NOT NULL,
    "uuid" TEXT,
    "crmUsuarioId" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "botActivo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoMensajeFecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSession" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "botId" INTEGER,
    "clienteId" INTEGER,
    "telefono" TEXT NOT NULL,
    "canal" "ChatChannel" NOT NULL,
    "estado" "ChatSessionStatus" NOT NULL DEFAULT 'OPEN',
    "ultimoTicketCrmId" TEXT,
    "ultimoTicketCreadoEn" TIMESTAMP(3),
    "iniciadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerradoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "flowIntent" "ChatFlowIntent" NOT NULL DEFAULT 'NONE',
    "flowStep" "ChatFlowStep" NOT NULL DEFAULT 'NONE',
    "flowContext" JSONB,
    "openaiLastResponseId" VARCHAR(255),

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "rol" "ChatRole" NOT NULL,
    "contenido" TEXT NOT NULL,
    "tokens" INTEGER,
    "mediaUrl" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "tipo" "KnowledgeDocumentType" NOT NULL,
    "externoId" INTEGER,
    "origen" TEXT,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "textoLargo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" SERIAL NOT NULL,
    "documentId" INTEGER NOT NULL,
    "indice" INTEGER NOT NULL,
    "texto" TEXT NOT NULL,
    "embedding" TEXT,
    "tokens" INTEGER,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" SERIAL NOT NULL,
    "wamid" TEXT NOT NULL,
    "chatSessionId" INTEGER,
    "clienteId" INTEGER,
    "direction" "WazDirection" NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "type" "WazMediaType" NOT NULL,
    "body" TEXT,
    "mediaUrl" TEXT,
    "mediaMimeType" TEXT,
    "mediaSha256" TEXT,
    "status" "WazStatus" NOT NULL DEFAULT 'SENT',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "replyToWamid" TEXT,
    "timestamp" BIGINT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_slug_key" ON "Empresa"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_slug_key" ON "Bot"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_uuid_key" ON "Cliente"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_empresaId_telefono_key" ON "Cliente"("empresaId", "telefono");

-- CreateIndex
CREATE INDEX "ChatSession_empresaId_telefono_canal_estado_idx" ON "ChatSession"("empresaId", "telefono", "canal", "estado");

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_creadoEn_idx" ON "ChatMessage"("sessionId", "creadoEn");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_empresaId_tipo_idx" ON "KnowledgeDocument"("empresaId", "tipo");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_documentId_indice_idx" ON "KnowledgeChunk"("documentId", "indice");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappMessage_wamid_key" ON "WhatsappMessage"("wamid");

-- CreateIndex
CREATE INDEX "WhatsappMessage_wamid_idx" ON "WhatsappMessage"("wamid");

-- CreateIndex
CREATE INDEX "WhatsappMessage_clienteId_idx" ON "WhatsappMessage"("clienteId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_status_idx" ON "WhatsappMessage"("status");

-- AddForeignKey
ALTER TABLE "Bot" ADD CONSTRAINT "Bot_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_botId_fkey" FOREIGN KEY ("botId") REFERENCES "Bot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_chatSessionId_fkey" FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;
