import { Prisma } from '@prisma/client';

/**
 * Misma condición que `pedidos.listar`: pedidos cuyo cliente o, si no hay cliente, el
 * proveedor asociado pertenecen al wallet de empresa.
 */
export function wherePedidoPerteneceAWalletEmpresa(walletId: number): Prisma.PedidoWhereInput {
  return {
    OR: [{ persona: { walletId } }, { personaId: null, proveedor: { walletId } }],
  };
}
