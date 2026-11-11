import { ItemPedido, Pago, PagoProveedor, TipoPedido } from '@prisma/client';
import { EstadoPedido } from '../tipos/estado-pedido.tipo';
import { ResumenPedido } from '../tipos/resumen-pedido.tipo';

/** Redondeo a 2 decimales (GTQ). */
export function redondearMoneda(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calcularTotalCompra(items: ItemPedido[]): number {
  return redondearMoneda(items.reduce((acc, item) => acc + item.cantidad * item.precioCompra, 0));
}

export function calcularTotalVenta(items: ItemPedido[]): number {
  return redondearMoneda(items.reduce((acc, item) => acc + item.cantidad * item.precioVenta, 0));
}

export function calcularTotalPagado(pagos: Pago[]): number {
  return redondearMoneda(pagos.reduce((acc, pago) => acc + pago.monto, 0));
}

/**
 * Suma de movimientos que liquidan el costo (`pago` + `cobro`).
 * No incluye `ingreso_cliente_a_proveedor` (cobro de terceros al proveedor, sin efecto en saldo de costo).
 */
export function calcularTotalPagadoProveedor(pagos: PagoProveedor[]): number {
  return redondearMoneda(
    pagos.reduce((acc, pago) => {
      if (pago.tipo === 'ingreso_cliente_a_proveedor') return acc;
      return acc + pago.monto;
    }, 0),
  );
}

export function calcularSaldo(totalReferencia: number, totalPagado: number): number {
  return Math.max(0, redondearMoneda(totalReferencia - totalPagado));
}

export function calcularEstado(totalReferencia: number, totalPagado: number): EstadoPedido {
  if (totalReferencia <= 0) return 'pagado'; // pedido sin costo (ítems en $0) = no hay deuda
  if (totalPagado <= 0) return 'pendiente';
  if (totalPagado >= totalReferencia) return 'pagado';
  return 'parcial';
}

/**
 * Suma de precio venta × cantidad (sin IVA). Útil para estadísticas cuando se necesita el subtotal explícito.
 */
export function calcularSubtotalVentaItems(items: ItemPedido[]): number {
  return calcularTotalVenta(items);
}

/**
 * Total que debe cobrarse al cliente en una venta: subtotal ítems + IVA si `impuesto` > 0.
 * En compras u otros tipos devuelve el mismo subtotal (el resumen usa totalCompra como referencia de cliente).
 */
export function calcularTotalVentaClienteCobro(
  items: ItemPedido[],
  tipoPedido: TipoPedido,
  impuesto: number | null | undefined,
): number {
  const sub = calcularTotalVenta(items);
  if (tipoPedido !== 'venta' || impuesto == null || impuesto <= 0) {
    return sub;
  }
  const montoIva = redondearMoneda(sub * (impuesto / 100));
  return redondearMoneda(sub + montoIva);
}

/**
 * Venta sin cliente en la app pero con proveedor asociado: el intermediario te reparte
 * hasta el margen `totalVenta − totalCompra`, no el bruto de venta.
 */
export function esVentaIntermediacionProveedor(
  tipoPedido: TipoPedido,
  personaId: number | null | undefined,
  proveedorId: number | null | undefined,
): boolean {
  return (
    tipoPedido === 'venta' &&
    (personaId == null || personaId === undefined) &&
    proveedorId != null
  );
}

/**
 * Genera el resumen financiero completo de un pedido.
 *
 * - `subtotalVenta`, `montoImpuestoVenta`, `totalVenta`: igual que antes (bruto de venta con IVA si aplica).
 * - `referenciaSaldoCliente` + `saldoPendiente` + `estado`: lado «Pagos» del pedido (cliente o reparto).
 * - Lado proveedor: costo ítems, sin IVA de la venta al cliente.
 */
export function calcularResumenPedido(
  items: ItemPedido[],
  pagos: Pago[],
  tipoPedido: TipoPedido,
  pagosProveedor: PagoProveedor[] = [],
  impuesto: number | null | undefined = null,
  personaId: number | null | undefined = undefined,
  proveedorId: number | null | undefined = undefined,
): ResumenPedido {
  const totalCompra = calcularTotalCompra(items);
  const subtotalVenta = calcularTotalVenta(items);

  let montoImpuestoVenta = 0;
  let totalVenta: number;
  if (tipoPedido === 'venta' && impuesto != null && impuesto > 0) {
    montoImpuestoVenta = redondearMoneda(subtotalVenta * (impuesto / 100));
    totalVenta = redondearMoneda(subtotalVenta + montoImpuestoVenta);
  } else {
    totalVenta = subtotalVenta;
  }

  const totalPagado = calcularTotalPagado(pagos);

  let referenciaSaldoCliente: number;
  if (tipoPedido === 'venta') {
    if (esVentaIntermediacionProveedor(tipoPedido, personaId, proveedorId)) {
      referenciaSaldoCliente = Math.max(0, redondearMoneda(totalVenta - totalCompra));
    } else {
      referenciaSaldoCliente = totalVenta;
    }
  } else {
    referenciaSaldoCliente = totalCompra;
  }

  const saldoPendiente = calcularSaldo(referenciaSaldoCliente, totalPagado);
  const estado = calcularEstado(referenciaSaldoCliente, totalPagado);

  const totalPagadoProveedor = calcularTotalPagadoProveedor(pagosProveedor);
  const saldoProveedor = calcularSaldo(totalCompra, totalPagadoProveedor);
  const estadoProveedor = calcularEstado(totalCompra, totalPagadoProveedor);

  return {
    totalCompra,
    subtotalVenta,
    montoImpuestoVenta,
    totalVenta,
    totalPagado,
    referenciaSaldoCliente,
    saldoPendiente,
    estado,
    totalPagadoProveedor,
    saldoProveedor,
    estadoProveedor,
  };
}
