import { Prisma } from '@prisma/client';
import { calcularResumenPedido, redondearMoneda } from '../comunes/utilidades/calculadora-pedido.util';
import { modoPedidoNegocio, type ModoPedidoNegocio } from '../comunes/utilidades/modo-pedido.util';
import { fechaCaeEnMesCalendario } from './estadisticas-fecha.util';

export type PedidoConRelacionesEstadisticas = Prisma.PedidoGetPayload<{
  include: { items: true; pagos: true; pagosProveedor: true };
}>;

export function impuestoDelPedido(p: PedidoConRelacionesEstadisticas): number | null | undefined {
  return (p as { impuesto?: number | null }).impuesto;
}

/** Egresos al proveedor en el mes (`pago` − `cobro`). No incluye `ingreso_cliente_a_proveedor`. */
export function costoProveedorLiquidadoEnMes(
  pagosProveedor: PedidoConRelacionesEstadisticas['pagosProveedor'],
  anio: number,
  mes: number,
  timeZone: string,
): number {
  let neto = 0;
  for (const pg of pagosProveedor ?? []) {
    if (pg.tipo === 'ingreso_cliente_a_proveedor') continue;
    if (!fechaCaeEnMesCalendario(pg.fecha, anio, mes, timeZone)) continue;
    if (pg.tipo === 'pago') neto += pg.monto;
    else if (pg.tipo === 'cobro') neto -= pg.monto;
  }
  return Math.max(0, redondearMoneda(neto));
}

export type MetricasVentaMes = { ingresos: number; costo: number; iva: number };

function sumaPagosClienteEnMes(
  pagos: PedidoConRelacionesEstadisticas['pagos'],
  anio: number,
  mes: number,
  tz: string,
): number {
  return pagos.reduce((acc, pg) => {
    if (fechaCaeEnMesCalendario(pg.fecha, anio, mes, tz)) return acc + pg.monto;
    return acc;
  }, 0);
}

function sumaRepartoProveedorEmpresaEnMes(
  pagosProveedor: PedidoConRelacionesEstadisticas['pagosProveedor'],
  anio: number,
  mes: number,
  tz: string,
): number {
  let suma = 0;
  for (const pg of pagosProveedor ?? []) {
    if (pg.tipo === 'ingreso_cliente_a_proveedor') continue;
    if (fechaCaeEnMesCalendario(pg.fecha, anio, mes, tz)) suma += pg.monto;
  }
  return suma;
}

function sumaIngresoClienteAProveedorEnMes(
  pagosProveedor: PedidoConRelacionesEstadisticas['pagosProveedor'],
  anio: number,
  mes: number,
  tz: string,
): number {
  let suma = 0;
  for (const pg of pagosProveedor ?? []) {
    if (pg.tipo !== 'ingreso_cliente_a_proveedor') continue;
    if (fechaCaeEnMesCalendario(pg.fecha, anio, mes, tz)) suma += pg.monto;
  }
  return suma;
}

/** Venta cliente: cobros del cliente; costo = pagos al proveedor en el mes o prorrateo de catálogo si no hay proveedor. */
export function metricasVentaClienteEnMes(
  p: PedidoConRelacionesEstadisticas,
  anio: number,
  mes: number,
  tz: string,
): MetricasVentaMes {
  const imp = impuestoDelPedido(p);
  const r = calcularResumenPedido(p.items, p.pagos, p.tipo, [], imp, p.personaId, p.proveedorId);
  const ref = r.referenciaSaldoCliente;
  const sumaPagosMes = sumaPagosClienteEnMes(p.pagos, anio, mes, tz);

  let ingresos = 0;
  let costo = 0;
  let iva = 0;

  if (sumaPagosMes > 0.0001) {
    ingresos += sumaPagosMes;
    if (ref > 0.0001) {
      const ratio = Math.min(1, sumaPagosMes / ref);
      if (p.proveedorId != null) {
        costo += costoProveedorLiquidadoEnMes(p.pagosProveedor, anio, mes, tz);
      } else {
        costo += r.totalCompra * ratio;
      }
      iva += r.montoImpuestoVenta * ratio;
    }
  } else if (p.proveedorId != null) {
    costo += costoProveedorLiquidadoEnMes(p.pagosProveedor, anio, mes, tz);
  }

  return {
    ingresos: redondearMoneda(ingresos),
    costo: redondearMoneda(costo),
    iva: redondearMoneda(iva),
  };
}

/** Venta proveedor: solo reparto proveedor→empresa en el mes; sin costo de catálogo ni `pedido.pagos`. */
export function metricasVentaProveedorEnMes(
  p: PedidoConRelacionesEstadisticas,
  anio: number,
  mes: number,
  tz: string,
): MetricasVentaMes {
  const sumaProveedorMes = sumaRepartoProveedorEmpresaEnMes(p.pagosProveedor, anio, mes, tz);
  return {
    ingresos: redondearMoneda(sumaProveedorMes > 0.0001 ? sumaProveedorMes : 0),
    costo: 0,
    iva: 0,
  };
}

/** Pedidos viejos sin cliente en app: ingreso vía `ingreso_cliente_a_proveedor`. */
export function metricasVentaSinClienteLegacyEnMes(
  p: PedidoConRelacionesEstadisticas,
  anio: number,
  mes: number,
  tz: string,
): MetricasVentaMes {
  const imp = impuestoDelPedido(p);
  const r = calcularResumenPedido(p.items, p.pagos, p.tipo, [], imp, p.personaId, p.proveedorId);
  const ref = r.referenciaSaldoCliente;
  const sumaIngresoCp = sumaIngresoClienteAProveedorEnMes(p.pagosProveedor, anio, mes, tz);

  let ingresos = 0;
  let iva = 0;
  if (sumaIngresoCp > 0.0001 && ref > 0.0001) {
    ingresos += sumaIngresoCp;
    const ratio = Math.min(1, sumaIngresoCp / ref);
    iva += r.montoImpuestoVenta * ratio;
  }

  return {
    ingresos: redondearMoneda(ingresos),
    costo: 0,
    iva: redondearMoneda(iva),
  };
}

/** Despacha métricas mensuales según modo de negocio (no mezclar ramas en un solo `if`). */
export function metricasVentaEnMesPorModo(
  p: PedidoConRelacionesEstadisticas,
  anio: number,
  mes: number,
  tz: string,
): MetricasVentaMes {
  const modo = modoPedidoNegocio(p);
  if (modo == null) {
    return { ingresos: 0, costo: 0, iva: 0 };
  }
  switch (modo) {
    case 'venta_cliente':
      return metricasVentaClienteEnMes(p, anio, mes, tz);
    case 'venta_proveedor':
      // Intermediación explícita: solo reparto; legado sin cliente en app: ingreso_cliente_a_proveedor
      if (p.esIntermediacion === true) {
        return metricasVentaProveedorEnMes(p, anio, mes, tz);
      }
      return metricasVentaSinClienteLegacyEnMes(p, anio, mes, tz);
    default:
      return { ingresos: 0, costo: 0, iva: 0 };
  }
}
