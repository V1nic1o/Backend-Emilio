import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed: crea el wallet "Principal" y migra todos los registros
 * existentes (personas y gastos sin walletId) a ese wallet.
 *
 * Es idempotente: puede ejecutarse múltiples veces sin duplicar datos.
 */
async function main() {
  // 1. Crear wallet "Principal" si no existe ninguno
  const total = await prisma.wallet.count();

  let walletId: number;

  if (total === 0) {
    const wallet = await prisma.wallet.create({
      data: {
        nombre: 'Principal',
        descripcion: 'Wallet inicial',
        color: '#2563EB',
      },
    });
    walletId = wallet.id;
    console.log(`Wallet "Principal" creado (id=${walletId})`);
  } else {
    const primer = await prisma.wallet.findFirst({ orderBy: { id: 'asc' } });
    walletId = primer!.id;
    console.log(`Wallet principal existente (id=${walletId})`);
  }

  // 2. Migrar personas sin walletId
  const personasSinWallet = await prisma.persona.updateMany({
    where: { walletId: null },
    data: { walletId },
  });
  console.log(`Personas migradas: ${personasSinWallet.count}`);

  // 3. Migrar gastos sin walletId
  const gastosSinWallet = await prisma.gasto.updateMany({
    where: { walletId: null },
    data: { walletId },
  });
  console.log(`Gastos migrados: ${gastosSinWallet.count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
