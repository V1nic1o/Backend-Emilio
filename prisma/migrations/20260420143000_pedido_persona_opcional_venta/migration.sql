-- Venta sin cliente conocido: personaId puede ser null si el pedido queda anclado al proveedor (proveedorId).
ALTER TABLE "pedidos" ALTER COLUMN "personaId" DROP NOT NULL;
