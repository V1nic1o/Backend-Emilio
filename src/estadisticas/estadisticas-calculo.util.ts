import { calcularResumenPedido, redondearMoneda } from '../comunes/utilidades/calculadora-pedido.util';
import { ventaClienteTieneProveedorCosto } from '../comunes/utilidades/modo-pedido.util';
import { fechaCaeEnMesCalendario } from './estadisticas-fecha.util';
import {
  impuestoDelPedido,
  metricasVentaEnMesPorModo,
  type PedidoConRelacionesEstadisticas,
} from './estadisticas-venta-por-modo.util';

export type { PedidoConRelacionesEstadisticas } from './estadisticas-venta-por-modo.util';
export { impuestoDelPedido, costoProveedorLiquidadoEnMes } from './estadisticas-venta-por-modo.util';

/** @deprecated Usar `ventaClienteTieneProveedorCosto` desde `modo-pedido.util`. */
export function esVentaClienteConProveedorCosto(p: PedidoConRelacionesEstadisticas): boolean {
  return ventaClienteTieneProveedorCosto(p);
}

/**
 * Costo de **compras** imputado al mes por pagos registrados en el pedido (caja).
 */
export function costoComprasPorPagosEnMes(
  compras: PedidoConRelacionesEstadisticas[],
  anio: number,
  mes: number,
  timeZone: string,
): number {
  let costo = 0;
  for (const p of compras) {
    if (p.tipo !== 'compra') continue;
    const imp = impuestoDelPedido(p);
    const r = calcularResumenPedido(p.items, p.pagos, p.tipo, [], imp, p.personaId, p.proveedorId);
    const ref = r.referenciaSaldoCliente;
    const sumaPagosMes = p.pagos.reduce((acc, pg) => {
      if (fechaCaeEnMesCalendario(pg.fecha, anio, mes, timeZone)) return acc + pg.monto;
      return acc;
    }, 0);
    if (sumaPagosMes <= 0.0001) continue;
    if (ref > 0.0001) {
      costo += r.totalCompra * Math.min(1, sumaPagosMes / ref);
    }
  }
  return redondearMoneda(costo);
}

/**
 * Métricas de ventas por cobros reales en el mes (calendario `timeZone`).
 * Cada modo de venta tiene su propia función en `estadisticas-venta-por-modo.util`.
 */
export function ingresoCostoIvaVentasPorCobrosEnMes(
  ventas: PedidoConRelacionesEstadisticas[],
  anio: number,
  mes: number,
  timeZone: string,
): { ingresos: number; costo: number; iva: number } {
  let ingresos = 0;
  let costo = 0;
  let iva = 0;

  for (const p of ventas) {
    if (p.tipo !== 'venta') continue;
    const m = metricasVentaEnMesPorModo(p, anio, mes, timeZone);
    ingresos += m.ingresos;
    costo += m.costo;
    iva += m.iva;
  }

  return {
    ingresos: redondearMoneda(ingresos),
    costo: redondearMoneda(costo),
    iva: redondearMoneda(iva),
  };
}
