-- CreateEnum
CREATE TYPE "TipoWallet" AS ENUM ('empresa', 'personal');

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN "tipo" "TipoWallet" NOT NULL DEFAULT 'empresa';

-- CreateTable
CREATE TABLE "ingresos_personales" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ingresos_personales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "deudas_personales" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "montoOriginal" DOUBLE PRECISION NOT NULL,
    "montoPagado" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    CONSTRAINT "deudas_personales_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ahorros_personales" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "metaMonto" DOUBLE PRECISION,
    "montoActual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ahorros_personales_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ingresos_personales" ADD CONSTRAINT "ingresos_personales_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deudas_personales" ADD CONSTRAINT "deudas_personales_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ahorros_personales" ADD CONSTRAINT "ahorros_personales_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
