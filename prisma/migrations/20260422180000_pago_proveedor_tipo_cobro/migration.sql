-- CreateEnum
CREATE TYPE "TipoPagoProveedor" AS ENUM ('pago', 'cobro');

-- AlterTable
ALTER TABLE "pagos_proveedor" ADD COLUMN "tipo" "TipoPagoProveedor" NOT NULL DEFAULT 'pago';
