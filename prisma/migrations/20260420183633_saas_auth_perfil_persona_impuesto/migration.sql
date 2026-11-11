-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN     "impuesto" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "personas" ADD COLUMN     "direccion" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "telefono" TEXT;

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "usuarioId" INTEGER;

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfiles_empresa" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "nombreEmpresa" TEXT,
    "logoBase64" TEXT,
    "direccion" TEXT,
    "email" TEXT,
    "telefono" TEXT,
    "nit" TEXT,

    CONSTRAINT "perfiles_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "perfiles_empresa_usuarioId_key" ON "perfiles_empresa"("usuarioId");

-- AddForeignKey
ALTER TABLE "perfiles_empresa" ADD CONSTRAINT "perfiles_empresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
