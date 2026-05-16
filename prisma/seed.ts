import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(' Iniciando seed de la base de datos del BOT...');

  // 1) Crear empresa base (la de Nova) para este servidor de bots
  const empresa = await prisma.empresa.create({
    data: {
      nombre: 'EMPRESA BASE',
      slug: 'mi-empresa-base',
      activo: true,
    },
  });

  // 2) Crear bot por defecto para esa empresa
  const bot = await prisma.bot.create({
    data: {
      empresaId: empresa.id,
      nombre: 'BOT BASE',
      descripcion: 'Asistente de soporte al cliente',

      // Modelo de Fireworks
      model: 'gpt-5.5',

      // Prompt base (lo que hoy tienes hardcodeado en messages[0])
      systemPrompt: ``.trim(),

      // Parámetros de generación por defecto (los mismos que usas en el server ahora)
      temperature: 0.4,
      topP: 0.9,
      presencePenalty: 0.0,
      frequencyPenalty: 0.2,
      maxCompletionTokens: 500,
      slug: 'bot-base',

      status: 'ACTIVE',
    },
  });

  console.log(' Bot creado:', bot);
}

main()
  .catch((error) => {
    console.error(' Error en el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(' Conexión cerrada.');
  });
