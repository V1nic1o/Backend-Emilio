import { EstadoPedido } from './estado-pedido.tipo';

/**
 * Resumen financiero calculado de un pedido.
 * Contiene los totales derivados, nunca almacenados en BD.
 *
 * - Lado cliente (venta con persona): `totalVenta` = total a cobrar; `referenciaSaldoCliente` = `totalVenta`.
 * - Venta sin cliente + proveedor (intermediación): `referenciaSaldoCliente` = margen `max(0, totalVenta − totalCompra)`;
 *   los repartos (`Pago`) se comparan contra ese margen (no contra el bruto de venta).
 * - Lado cliente (compra): referencia de cobro = `totalCompra`; `totalVenta` / subtotales siguen reflejando precios de venta de ítems por compatibilidad.
 * - Lado proveedor: costo ítems, sin IVA de la venta al cliente.
 */
export interface ResumenPedido {
  // ─── Lado cliente ─────────────────────────────────────────────────────────
  totalCompra: number;
  /** Suma cantidad × precioVenta (sin IVA). */
  subtotalVenta: number;
  /** IVA u otro % sobre `subtotalVenta` solo en ventas con impuesto > 0. */
  montoImpuestoVenta: number;
  /** En venta: total a cobrar al cliente (subtotal + IVA si hay). En compra: igual que subtotalVenta. */
  totalVenta: number;
  totalPagado: number;
  /** Monto tope del lado «Pagos» del pedido (repartos o cobros al cliente) para saldo y estado. */
  referenciaSaldoCliente: number;
  saldoPendiente: number;
  estado: EstadoPedido;

  // ─── Lado proveedor (solo ventas con proveedor asociado) ──────────────────
  totalPagadoProveedor: number;
  saldoProveedor: number;
  estadoProveedor: EstadoPedido;
}
