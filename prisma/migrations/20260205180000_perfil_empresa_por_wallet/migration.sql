-- PerfilEmpresa pasa de 1 por usuario a 1 por wallet empresa (copia datos a cada workspace empresa).

ALTER TABLE "perfiles_empresa" ADD COLUMN "walletId" INTEGER;

-- Quitar unicidad de usuarioId antes de duplicar filas (un usuario puede tener varios wallets empresa).
DROP INDEX IF EXISTS "perfiles_empresa_usuarioId_key";

INSERT INTO "perfiles_empresa" ("usuarioId", "nombreEmpresa", "logoBase64", "logoUrl", "logoCloudinaryPublicId", "direccion", "email", "telefono", "nit", "walletId")
SELECT p."usuarioId", p."nombreEmpresa", p."logoBase64", p."logoUrl", p."logoCloudinaryPublicId", p."direccion", p."email", p."telefono", p."nit", w."id"
FROM "perfiles_empresa" p
INNER JOIN "wallets" w ON w."usuarioId" = p."usuarioId" AND w."tipo" = 'empresa'
WHERE p."walletId" IS NULL;

DELETE FROM "perfiles_empresa" WHERE "walletId" IS NULL;

ALTER TABLE "perfiles_empresa" DROP CONSTRAINT "perfiles_empresa_usuarioId_fkey";
ALTER TABLE "perfiles_empresa" DROP COLUMN "usuarioId";

ALTER TABLE "perfiles_empresa" ALTER COLUMN "walletId" SET NOT NULL;
CREATE UNIQUE INDEX "perfiles_empresa_walletId_key" ON "perfiles_empresa"("walletId");
ALTER TABLE "perfiles_empresa" ADD CONSTRAINT "perfiles_empresa_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
