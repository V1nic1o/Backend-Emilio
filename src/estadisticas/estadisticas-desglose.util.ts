import { calcularResumenPedido, redondearMoneda } from '../comunes/utilidades/calculadora-pedido.util';
import { modoPedidoNegocio } from '../comunes/utilidades/modo-pedido.util';
import { fechaCaeEnMesCalendario } from './estadisticas-fecha.util';
import {
  impuestoDelPedido,
  metricasVentaEnMesPorModo,
  type PedidoConRelacionesEstadisticas,
} from './estadisticas-venta-por-modo.util';

/** Pedido con nombres opcionales para etiquetas (include en Prisma). */
export type PedidoParaDesglose = PedidoConRelacionesEstadisticas & {
  persona?: { nombre: string } | null;
  proveedor?: { nombre: string } | null;
};

export type CobroAsesoriaDesglose = {
  id: number;
  montoTotal: number;
  montoIva: number;
  fechaPago: Date | null;
  anio: number;
  mes: number;
  suscripcion: { persona: { nombre: string } };
};

export type GastoDesglose = {
  id: number;
  monto: number;
  descripcion: string;
  fecha: Date;
  categoria: string | null;
};

/** Línea de venta/compra reconocida en el mes (caja). */
export interface LineaDesglosePedido {
  tipo: 'venta' | 'compra';
  pedidoId: number;
  etiqueta: string;
  ingreso: number;
  costo: number;
  iva: number;
}

export interface LineaDesgloseAsesoria {
  cobroId: number;
  personaNombre: string;
  anio: number;
  mes: number;
  montoTotal: number;
  montoIva: number;
  fechaPago: string;
}

export interface LineaDesgloseGasto {
  gastoId: number;
  descripcion: string;
  categoria: string | null;
  monto: number;
  fecha: string;
}

export interface DesgloseMesDto {
  anio: number;
  mes: number;
  mesEtiqueta: string;
  totales: {
    ingresos: number;
    costoVentas: number;
    impuestosIva: number;
    gastos: number;
    gananciaNeta: number;
  };
  pedidos: LineaDesglosePedido[];
  asesorias: LineaDesgloseAsesoria[];
  gastos: LineaDesgloseGasto[];
}

function etiquetaPedido(p: PedidoParaDesglose): string {
  const ref = p.nombreReferencia?.trim();
  const cli = p.persona?.nombre?.trim();
  const prov = p.proveedor?.nombre?.trim();
  if (p.tipo === 'compra') {
    const provC = p.persona?.nombre?.trim();
    return ref ? `Compra #${p.id} · ${ref}` : `Compra #${p.id}${provC ? ` · ${provC}` : ''}`;
  }
  switch (modoPedidoNegocio(p)) {
    case 'venta_proveedor':
      if (p.esIntermediacion === true) {
        return ref ? `Venta #${p.id} · Venta proveedor · ${ref}` : `Venta #${p.id} · Venta proveedor`;
      }
      return ref ? `Venta #${p.id} · Sin cliente · ${ref}` : `Venta #${p.id} · Sin cliente`;
    default:
      return ref ? `Venta #${p.id} · ${cli ?? 'Cliente'} · ${ref}` : `Venta #${p.id} · ${cli ?? 'Cliente'}`;
  }
}

/**
 * Misma lógica que `ingresoCostoIvaVentasPorCobrosEnMes` + `costoComprasPorPagosEnMes`, pero devuelve líneas por pedido.
 */
export function calcularDesgloseMes(
  ventas: PedidoParaDesglose[],
  compras: PedidoParaDesglose[],
  gastos: GastoDesglose[],
  cobrosAsesoria: CobroAsesoriaDesglose[],
  anio: number,
  monthIndex: number,
  timeZone: string,
  mesEtiqueta: string,
): DesgloseMesDto {
  const tz = timeZone;
  const lineasPedido: LineaDesglosePedido[] = [];

  for (const p of ventas) {
    if (p.tipo !== 'venta') continue;
    const { ingresos: ingreso, costo, iva } = metricasVentaEnMesPorModo(p, anio, monthIndex, tz);

    if (ingreso > 0.0001 || costo > 0.0001 || iva > 0.0001) {
      lineasPedido.push({
        tipo: 'venta',
        pedidoId: p.id,
        etiqueta: etiquetaPedido(p),
        ingreso: redondearMoneda(ingreso),
        costo: redondearMoneda(costo),
        iva: redondearMoneda(iva),
      });
    }
  }

  for (const p of compras) {
    if (p.tipo !== 'compra') continue;
    const imp = impuestoDelPedido(p);
    const r = calcularResumenPedido(p.items, p.pagos, p.tipo, [], imp, p.personaId, p.proveedorId);
    const ref = r.referenciaSaldoCliente;
    const sumaPagosMes = p.pagos.reduce((acc, pg) => {
      if (fechaCaeEnMesCalendario(pg.fecha, anio, monthIndex, tz)) return acc + pg.monto;
      return acc;
    }, 0);
    if (sumaPagosMes <= 0.0001) continue;
    if (ref <= 0.0001) continue;
    const costoC = redondearMoneda(r.totalCompra * Math.min(1, sumaPagosMes / ref));
    lineasPedido.push({
      tipo: 'compra',
      pedidoId: p.id,
      etiqueta: etiquetaPedido(p),
      ingreso: 0,
      costo: costoC,
      iva: 0,
    });
  }

  const lineasAsesoria: LineaDesgloseAsesoria[] = [];
  for (const c of cobrosAsesoria) {
    if (!c.fechaPago) continue;
    if (!fechaCaeEnMesCalendario(c.fechaPago, anio, monthIndex, tz)) continue;
    lineasAsesoria.push({
      cobroId: c.id,
      personaNombre: c.suscripcion.persona.nombre,
      anio: c.anio,
      mes: c.mes,
      montoTotal: redondearMoneda(c.montoTotal),
      montoIva: redondearMoneda(c.montoIva),
      fechaPago: c.fechaPago.toISOString(),
    });
  }

  const lineasGasto: LineaDesgloseGasto[] = [];
  let sumaGastos = 0;
  for (const g of gastos) {
    if (!fechaCaeEnMesCalendario(g.fecha, anio, monthIndex, tz)) continue;
    sumaGastos += g.monto;
    lineasGasto.push({
      gastoId: g.id,
      descripcion: g.descripcion,
      categoria: g.categoria,
      monto: redondearMoneda(g.monto),
      fecha: g.fecha instanceof Date ? g.fecha.toISOString() : String(g.fecha),
    });
  }

  const ingresoVentas = redondearMoneda(lineasPedido.filter((l) => l.tipo === 'venta').reduce((a, l) => a + l.ingreso, 0));
  const costoVentasSolo = redondearMoneda(
    lineasPedido.filter((l) => l.tipo === 'venta').reduce((a, l) => a + l.costo, 0) +
      lineasPedido.filter((l) => l.tipo === 'compra').reduce((a, l) => a + l.costo, 0),
  );
  const ivaVentas = redondearMoneda(lineasPedido.filter((l) => l.tipo === 'venta').reduce((a, l) => a + l.iva, 0));

  const ingresoAsesorias = redondearMoneda(lineasAsesoria.reduce((a, l) => a + l.montoTotal, 0));
  const ivaAsesorias = redondearMoneda(lineasAsesoria.reduce((a, l) => a + l.montoIva, 0));

  const ingresos = redondearMoneda(ingresoVentas + ingresoAsesorias);
  const impuestosIva = redondearMoneda(ivaVentas + ivaAsesorias);
  const costoVentas = redondearMoneda(costoVentasSolo);
  const gastosTotal = redondearMoneda(sumaGastos);
  const ganancia = redondearMoneda(ingresos - costoVentas);
  const gananciaNeta = redondearMoneda(ganancia - gastosTotal);

  return {
    anio,
    mes: monthIndex + 1,
    mesEtiqueta,
    totales: {
      ingresos,
      costoVentas,
      impuestosIva,
      gastos: gastosTotal,
      gananciaNeta,
    },
    pedidos: lineasPedido,
    asesorias: lineasAsesoria,
    gastos: lineasGasto,
  };
}
