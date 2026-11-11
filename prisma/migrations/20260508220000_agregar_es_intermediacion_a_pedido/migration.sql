-- AlterTable
ALTER TABLE "pedidos" ADD COLUMN "esIntermediacion" BOOLEAN NOT NULL DEFAULT false;

-- Actualizar pedidos existentes que tienen pagos de tipo ingreso_cliente_a_proveedor
-- Estos son ventas de intermediación (venta proveedor + cliente o sin cliente)
UPDATE "pedidos"
SET "esIntermediacion" = true
WHERE "tipo" = 'venta'
  AND "proveedorId" IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM "pagos_proveedor" 
    WHERE "pagos_proveedor"."pedidoId" = "pedidos"."id" 
      AND "pagos_proveedor"."tipo" = 'ingreso_cliente_a_proveedor'
  );
