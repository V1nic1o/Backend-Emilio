-- Rubros de presupuesto por nombre + vínculo opcional en gastos
ALTER TABLE "presupuestos_personales" ADD COLUMN "nombre" TEXT;

UPDATE "presupuestos_personales" SET "nombre" = 'General' WHERE "nombre" IS NULL;

ALTER TABLE "presupuestos_personales" ALTER COLUMN "nombre" SET NOT NULL;

DROP INDEX IF EXISTS "presupuestos_personales_walletId_anio_mes_key";

CREATE UNIQUE INDEX "presupuestos_personales_walletId_anio_mes_nombre_key"
  ON "presupuestos_personales"("walletId", "anio", "mes", "nombre");

ALTER TABLE "gastos" ADD COLUMN "presupuestoPersonalId" INTEGER;

ALTER TABLE "gastos" ADD CONSTRAINT "gastos_presupuestoPersonalId_fkey"
  FOREIGN KEY ("presupuestoPersonalId") REFERENCES "presupuestos_personales"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
