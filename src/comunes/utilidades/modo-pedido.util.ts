import { TipoPedido } from '@prisma/client';

/**
 * Solo dos modos de venta activos. Compras (`tipo === compra`) no tienen modo de venta → `null`.
 * Pedidos viejos sin `personaId` y con proveedor se tratan como **venta_proveedor** (canal proveedor).
 */
export type ModoPedidoNegocio = 'venta_cliente' | 'venta_proveedor';

export type PedidoParaModo = {
  tipo: TipoPedido;
  esIntermediacion?: boolean | null;
  personaId?: number | null;
  proveedorId?: number | null;
};

/** Resuelve el modo de negocio para ventas. Compras → `null`. */
export function modoPedidoNegocio(p: PedidoParaModo): ModoPedidoNegocio | null {
  if (p.tipo !== 'venta') return null;
  const sinPersonaCliente = p.personaId == null || p.personaId === undefined;
  if (p.esIntermediacion === true || (sinPersonaCliente && p.proveedorId != null)) {
    return 'venta_proveedor';
  }
  return 'venta_cliente';
}

export function esVentaClienteModo(modo: ModoPedidoNegocio | null): boolean {
  return modo === 'venta_cliente';
}

export function esVentaProveedorModo(modo: ModoPedidoNegocio | null): boolean {
  return modo === 'venta_proveedor';
}

/** Venta cliente con proveedor de costo vinculado (subcaso de venta_cliente). */
export function ventaClienteTieneProveedorCosto(p: PedidoParaModo): boolean {
  return modoPedidoNegocio(p) === 'venta_cliente' && p.proveedorId != null;
}
