-- CreateEnum
CREATE TYPE "EstadoAsesoriaCobro" AS ENUM ('pendiente', 'pagada');

-- CreateTable
CREATE TABLE "asesorias_suscripcion" (
    "id" SERIAL NOT NULL,
    "personaId" INTEGER NOT NULL,
    "montoMensual" DOUBLE PRECISION NOT NULL,
    "impuestoPct" DOUBLE PRECISION,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asesorias_suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asesorias_cobro" (
    "id" SERIAL NOT NULL,
    "suscripcionId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "montoBase" DOUBLE PRECISION NOT NULL,
    "montoIva" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoTotal" DOUBLE PRECISION NOT NULL,
    "estado" "EstadoAsesoriaCobro" NOT NULL DEFAULT 'pendiente',
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPago" TIMESTAMP(3),

    CONSTRAINT "asesorias_cobro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asesorias_suscripcion_personaId_key" ON "asesorias_suscripcion"("personaId");

CREATE UNIQUE INDEX "asesorias_cobro_suscripcionId_anio_mes_key" ON "asesorias_cobro"("suscripcionId", "anio", "mes");

-- AddForeignKey
ALTER TABLE "asesorias_suscripcion" ADD CONSTRAINT "asesorias_suscripcion_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asesorias_cobro" ADD CONSTRAINT "asesorias_cobro_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "asesorias_suscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
