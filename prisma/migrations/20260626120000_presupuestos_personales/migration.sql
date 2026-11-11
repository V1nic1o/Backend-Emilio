-- CreateTable
CREATE TABLE "presupuestos_personales" (
    "id" SERIAL NOT NULL,
    "walletId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "montoLimite" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presupuestos_personales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_personales_walletId_anio_mes_key" ON "presupuestos_personales"("walletId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "presupuestos_personales" ADD CONSTRAINT "presupuestos_personales_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
