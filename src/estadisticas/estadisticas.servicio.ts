import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoAsesoriaCobro, Gasto, Prisma, TipoWallet } from '@prisma/client';
import { PrismaServicio } from '../prisma/prisma.servicio';
import { wherePedidoPerteneceAWalletEmpresa } from '../comunes/utilidades/where-pedido-wallet.util';
import { assertWalletUsuarioYTipo } from '../wallets/wallet-aut.util';
import {
  ESTADISTICAS_ZONA,
  addCalendarMonths,
  fechaCaeEnMesCalendario,
  parseIsoDateYm,
  todayYearMonthInZone,
  yearMonthInZone,
} from './estadisticas-fecha.util';

import {
  type PedidoConRelacionesEstadisticas as PedidoConRelaciones,
  costoComprasPorPagosEnMes,
  ingresoCostoIvaVentasPorCobrosEnMes,
} from './estadisticas-calculo.util';
import {
  calcularDesgloseMes,
  type CobroAsesoriaDesglose,
  type DesgloseMesDto,
  type GastoDesglose,
} from './estadisticas-desglose.util';

type AsesoriaCobroWhereInput = Prisma.AsesoriaCobroWhereInput;
import {
  calcularResumenPedido,
  redondearMoneda,
} from '../comunes/utilidades/calculadora-pedido.util';

export interface EstadisticasResumen {
  /** Suma histórica de ingresos **cobrados** (ventas en caja + asesorías pagadas), misma lógica que `porMes`. */
  totalIngresos: number;
  /** IVA asociado a cobros del periodo (ventas prorrateadas + asesorías pagadas). */
  totalImpuestosIva: number;
  /** Costo de ventas **reconocido con caja** + pagos a proveedor en compras (misma lógica mensual acumulada). */
  totalCostoVentas: number;
  gananciaBruta: number;
  totalGastos: number;
  gananciaNeta: number;
  cantidadVentas: number;
  cantidadCompras: number;
  porMes: MesEstadistica[];
}

/** Etiquetas cortas de mes (debe coincidir con `calcularUnMesEstadistica`). */
const MESES_ETQ = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
] as const;

export interface TotalesRangoEstadisticas {
  ingresosCobrados: number;
  gastosOperativos: number;
  gananciaNeta: number;
  impuestosIva: number;
  mesesEnPeriodo: number;
  promedioMensualGananciaNeta: number;
  margenSobreIngresosPct: number | null;
}

export interface EstadisticasRangoRespuesta {
  porMes: MesEstadistica[];
  totales: TotalesRangoEstadisticas;
}

/** Resumen por mes contable (lista para «Totales acumulados» → detalle). */
export interface HistorialMesContableItemDto {
  anio: number;
  /** 1–12 */
  mes: number;
  mesEtiqueta: string;
  ingresos: number;
  gastos: number;
  gananciaNeta: number;
}

export interface MesEstadistica {
  mes: string;
  anio: number;
  ingresos: number;
  /** IVA prorrateado por cobros de ventas en el mes + IVA de asesorías pagadas en el mes. */
  impuestosIva: number;
  /** Costo de ventas a caja + pagos a proveedor en compras (mismo mes, zona {@link ESTADISTICAS_ZONA}). */
  costoVentas: number;
  ganancia: number;
  gastos: number;
  gananciaNeta: number;
  /** Cobrado en ventas del mes (sin asesorías). */
  ingresosPedidos: number;
  /** Cobros de asesoría marcados pagados en el mes. */
  ingresosAsesorias: number;
  /**
   * Parte estimada de la ganancia neta atribuida a pedidos (gastos del mes prorrateados
   * según el margen bruto pedidos vs. margen asesorías).
   */
  gananciaNetaPedidos: number;
  /** Parte estimada de la ganancia neta atribuida a asesorías (mismo criterio). */
  gananciaNetaAsesorias: number;
}

@Injectable()
export class EstadisticasServicio {
  constructor(private readonly prisma: PrismaServicio) {}

  /**
   * Retorna el resumen financiero del wallet de empresa indicado.
   */
  async obtenerResumen(walletId: number, usuarioId: number): Promise<EstadisticasResumen> {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    const whereGasto = { walletId };
    const wherePedido = wherePedidoPerteneceAWalletEmpresa(walletId);
    const whereCobroAsesoria: AsesoriaCobroWhereInput = {
      estado: EstadoAsesoriaCobro.pagada,
      fechaPago: { not: null },
      suscripcion: { persona: { walletId } },
    };

    const [pedidos, gastos, cobrosAsesoriaPagados] = await Promise.all([
      this.prisma.pedido.findMany({
        where: wherePedido,
        include: { items: true, pagos: true, pagosProveedor: true },
      }),
      this.prisma.gasto.findMany({ where: whereGasto }),
      this.prisma.asesoriaCobro.findMany({ where: whereCobroAsesoria }),
    ]);

    const ventas = pedidos.filter((p) => p.tipo === 'venta');
    const compras = pedidos.filter((p) => p.tipo === 'compra');

    const porMes = this.calcularUltimosSeisMeses(pedidos, gastos, cobrosAsesoriaPagados);
    const acum = this.acumularHistorialCaja(pedidos, gastos, cobrosAsesoriaPagados);

    return {
      totalIngresos: acum.totalIngresos,
      totalImpuestosIva: acum.totalImpuestosIva,
      totalCostoVentas: acum.totalCostoVentas,
      gananciaBruta: acum.gananciaBruta,
      totalGastos: acum.totalGastos,
      gananciaNeta: acum.gananciaNeta,
      cantidadVentas: ventas.length,
      cantidadCompras: compras.length,
      porMes,
    };
  }

  /**
   * Resumen mensual entre dos fechas (primer día del mes «desde», último del mes «hasta»).
   * Máximo 36 meses por petición.
   */
  async obtenerResumenRango(
    walletId: number,
    usuarioId: number,
    desdeStr: string,
    hastaStr: string,
  ): Promise<EstadisticasRangoRespuesta> {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);

    const da = parseIsoDateYm(desdeStr);
    const db = parseIsoDateYm(hastaStr);
    if (!da || !db) {
      throw new BadRequestException('Las fechas desde/hasta deben ser YYYY-MM-DD.');
    }
    const t0 = da.year * 12 + da.monthIndex;
    const t1 = db.year * 12 + db.monthIndex;
    if (t0 > t1) {
      throw new BadRequestException('La fecha inicial no puede ser posterior a la final.');
    }

    const whereGasto = { walletId };
    const wherePedido = wherePedidoPerteneceAWalletEmpresa(walletId);
    const whereCobroAsesoria: AsesoriaCobroWhereInput = {
      estado: EstadoAsesoriaCobro.pagada,
      fechaPago: { not: null },
      suscripcion: { persona: { walletId } },
    };

    const [pedidos, gastos, cobrosAsesoriaPagados] = await Promise.all([
      this.prisma.pedido.findMany({
        where: wherePedido,
        include: { items: true, pagos: true, pagosProveedor: true },
      }),
      this.prisma.gasto.findMany({ where: whereGasto }),
      this.prisma.asesoriaCobro.findMany({ where: whereCobroAsesoria }),
    ]);

    const porMes = this.calcularPorMesEnRangoYm(
      da.year,
      da.monthIndex,
      db.year,
      db.monthIndex,
      pedidos,
      gastos,
      cobrosAsesoriaPagados,
    );
    const totales = this.agruparTotalesRango(porMes);

    return { porMes, totales };
  }

  /**
   * Líneas trazables del mes (pedidos, asesorías pagadas, gastos) con la misma zona y criterios que el resumen mensual.
   * `mes` es calendario 1–12.
   */
  async obtenerDesgloseMes(
    walletId: number,
    usuarioId: number,
    anio: number,
    mesCalendario: number,
  ): Promise<DesgloseMesDto> {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    if (mesCalendario < 1 || mesCalendario > 12) {
      throw new BadRequestException('El parámetro mes debe estar entre 1 y 12.');
    }
    if (anio < 2000 || anio > 2100) {
      throw new BadRequestException('El parámetro anio no es válido.');
    }
    const monthIndex = mesCalendario - 1;
    const mesEtiqueta = MESES_ETQ[monthIndex] ?? String(mesCalendario);

    const whereGasto = { walletId };
    const wherePedido = wherePedidoPerteneceAWalletEmpresa(walletId);
    const whereCobroAsesoria: AsesoriaCobroWhereInput = {
      estado: EstadoAsesoriaCobro.pagada,
      fechaPago: { not: null },
      suscripcion: { persona: { walletId } },
    };

    const [pedidos, gastos, cobrosRaw] = await Promise.all([
      this.prisma.pedido.findMany({
        where: wherePedido,
        include: {
          items: true,
          pagos: true,
          pagosProveedor: true,
          persona: { select: { nombre: true } },
          proveedor: { select: { nombre: true } },
        },
      }),
      this.prisma.gasto.findMany({ where: whereGasto }),
      this.prisma.asesoriaCobro.findMany({
        where: whereCobroAsesoria,
        include: { suscripcion: { include: { persona: { select: { nombre: true } } } } },
      }),
    ]);

    const ventas = pedidos.filter((p) => p.tipo === 'venta');
    const compras = pedidos.filter((p) => p.tipo === 'compra');

    const cobrosAsesoria: CobroAsesoriaDesglose[] = cobrosRaw.map((c) => ({
      id: c.id,
      montoTotal: c.montoTotal,
      montoIva: c.montoIva,
      fechaPago: c.fechaPago,
      anio: c.anio,
      mes: c.mes,
      suscripcion: { persona: { nombre: c.suscripcion.persona.nombre } },
    }));

    const gastosDesg: GastoDesglose[] = gastos.map((g) => ({
      id: g.id,
      monto: g.monto,
      descripcion: g.descripcion,
      fecha: g.fecha,
      categoria: g.categoria,
    }));

    return calcularDesgloseMes(
      ventas,
      compras,
      gastosDesg,
      cobrosAsesoria,
      anio,
      monthIndex,
      ESTADISTICAS_ZONA,
      mesEtiqueta,
    );
  }

  /**
   * Meses con movimiento entre el primer y último mes contable (misma ventana que los totales acumulados).
   */
  async obtenerHistorialMesesContables(
    walletId: number,
    usuarioId: number,
  ): Promise<{ meses: HistorialMesContableItemDto[] }> {
    await assertWalletUsuarioYTipo(this.prisma, walletId, usuarioId, TipoWallet.empresa);
    const whereGasto = { walletId };
    const wherePedido = wherePedidoPerteneceAWalletEmpresa(walletId);
    const whereCobroAsesoria: AsesoriaCobroWhereInput = {
      estado: EstadoAsesoriaCobro.pagada,
      fechaPago: { not: null },
      suscripcion: { persona: { walletId } },
    };

    const [pedidos, gastos, cobrosAsesoriaPagados] = await Promise.all([
      this.prisma.pedido.findMany({
        where: wherePedido,
        include: { items: true, pagos: true, pagosProveedor: true },
      }),
      this.prisma.gasto.findMany({ where: whereGasto }),
      this.prisma.asesoriaCobro.findMany({ where: whereCobroAsesoria }),
    ]);

    const ext = this.extremosMesesContables(pedidos, gastos, cobrosAsesoriaPagados);
    const meses: HistorialMesContableItemDto[] = [];
    let y = ext.yMin;
    let m = ext.m0Min;
    let guard = 0;
    while (guard < 600) {
      const stats = this.calcularUnMesEstadistica(y, m, pedidos, gastos, cobrosAsesoriaPagados);
      const tieneMovimiento =
        stats.ingresos > 0.005 ||
        stats.gastos > 0.005 ||
        Math.abs(stats.gananciaNeta) > 0.005 ||
        stats.costoVentas > 0.005;
      if (tieneMovimiento) {
        meses.push({
          anio: y,
          mes: m + 1,
          mesEtiqueta: stats.mes,
          ingresos: stats.ingresos,
          gastos: stats.gastos,
          gananciaNeta: stats.gananciaNeta,
        });
      }
      if (y === ext.yMax && m === ext.m0Max) break;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      guard += 1;
    }
    return { meses };
  }

  private agruparTotalesRango(porMes: MesEstadistica[]): TotalesRangoEstadisticas {
    let ingresosCobrados = 0;
    let gastosOperativos = 0;
    let gananciaNeta = 0;
    let impuestosIva = 0;
    const n = porMes.length;
    for (const m of porMes) {
      ingresosCobrados += m.ingresos;
      gastosOperativos += m.gastos;
      gananciaNeta += m.gananciaNeta;
      impuestosIva += m.impuestosIva;
    }
    ingresosCobrados = redondearMoneda(ingresosCobrados);
    gastosOperativos = redondearMoneda(gastosOperativos);
    gananciaNeta = redondearMoneda(gananciaNeta);
    impuestosIva = redondearMoneda(impuestosIva);
    const promedioMensualGananciaNeta =
      n > 0 ? redondearMoneda(gananciaNeta / n) : 0;
    const margenSobreIngresosPct =
      ingresosCobrados > 0.005
        ? redondearMoneda((gananciaNeta / ingresosCobrados) * 100)
        : null;

    return {
      ingresosCobrados,
      gastosOperativos,
      gananciaNeta,
      impuestosIva,
      mesesEnPeriodo: n,
      promedioMensualGananciaNeta,
      margenSobreIngresosPct,
    };
  }

  private calcularUltimosSeisMeses(
    pedidos: PedidoConRelaciones[],
    gastos: Gasto[],
    cobrosAsesoriaPagados: { montoTotal: number; montoIva: number; fechaPago: Date | null }[],
  ): MesEstadistica[] {
    const tz = ESTADISTICAS_ZONA;
    const hoy = todayYearMonthInZone(tz);
    const meses: MesEstadistica[] = [];
    for (let i = 5; i >= 0; i--) {
      const { year, monthIndex } = addCalendarMonths(hoy.year, hoy.monthIndex, -i);
      meses.push(
        this.calcularUnMesEstadistica(year, monthIndex, pedidos, gastos, cobrosAsesoriaPagados),
      );
    }
    return meses;
  }

  /** Cada mes calendario desde (yStart,mStart) hasta (yEnd,mEnd) inclusive (máx. 36 meses). */
  private calcularPorMesEnRangoYm(
    yStart: number,
    mStart: number,
    yEnd: number,
    mEnd: number,
    pedidos: PedidoConRelaciones[],
    gastos: Gasto[],
    cobrosAsesoriaPagados: { montoTotal: number; montoIva: number; fechaPago: Date | null }[],
  ): MesEstadistica[] {
    const meses: MesEstadistica[] = [];
    let y = yStart;
    let m = mStart;
    let count = 0;
    while ((y < yEnd || (y === yEnd && m <= mEnd)) && count < 36) {
      meses.push(this.calcularUnMesEstadistica(y, m, pedidos, gastos, cobrosAsesoriaPagados));
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      count += 1;
    }
    return meses;
  }

  /** Primer y último mes (zona negocio) donde hay datos; si no hay, solo el mes actual. */
  private extremosMesesContables(
    pedidos: PedidoConRelaciones[],
    gastos: Gasto[],
    cobrosAsesoriaPagados: { fechaPago: Date | null }[],
  ): { yMin: number; m0Min: number; yMax: number; m0Max: number } {
    const tz = ESTADISTICAS_ZONA;
    let tMin = Number.POSITIVE_INFINITY;
    let tMax = Number.NEGATIVE_INFINITY;
    const bump = (d: Date | string | null | undefined) => {
      if (d == null) return;
      const dt = typeof d === 'string' ? new Date(d) : d;
      if (Number.isNaN(dt.getTime())) return;
      const { year, monthIndex } = yearMonthInZone(dt, tz);
      const t = year * 12 + monthIndex;
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    };
    for (const p of pedidos) {
      bump(p.fecha);
      for (const pg of p.pagos) bump(pg.fecha);
      for (const pg of p.pagosProveedor ?? []) bump(pg.fecha);
    }
    for (const g of gastos) bump(g.fecha);
    for (const c of cobrosAsesoriaPagados) bump(c.fechaPago);

    const hoy = todayYearMonthInZone(tz);
    const tHoy = hoy.year * 12 + hoy.monthIndex;
    if (tMin === Number.POSITIVE_INFINITY) {
      return { yMin: hoy.year, m0Min: hoy.monthIndex, yMax: hoy.year, m0Max: hoy.monthIndex };
    }
    if (tMax < tHoy) tMax = tHoy;
    const ym = (t: number) => {
      const y = Math.floor(t / 12);
      const m0 = t - y * 12;
      return { y, m0 };
    };
    const a = ym(tMin);
    const b = ym(tMax);
    return { yMin: a.y, m0Min: a.m0, yMax: b.y, m0Max: b.m0 };
  }

  /** Totales globales alineados con la suma de todos los meses con la misma lógica que `porMes`. */
  private acumularHistorialCaja(
    pedidos: PedidoConRelaciones[],
    gastos: Gasto[],
    cobrosAsesoriaPagados: { montoTotal: number; montoIva: number; fechaPago: Date | null }[],
  ): Pick<
    EstadisticasResumen,
    'totalIngresos' | 'totalImpuestosIva' | 'totalCostoVentas' | 'totalGastos' | 'gananciaBruta' | 'gananciaNeta'
  > {
    const ext = this.extremosMesesContables(pedidos, gastos, cobrosAsesoriaPagados);
    let sumIng = 0;
    let sumIva = 0;
    let sumCosto = 0;
    let sumGastos = 0;
    let y = ext.yMin;
    let m = ext.m0Min;
    let guard = 0;
    while (guard < 600) {
      const mes = this.calcularUnMesEstadistica(y, m, pedidos, gastos, cobrosAsesoriaPagados);
      sumIng += mes.ingresos;
      sumIva += mes.impuestosIva;
      sumCosto += mes.costoVentas;
      sumGastos += mes.gastos;
      if (y === ext.yMax && m === ext.m0Max) break;
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
      guard += 1;
    }
    const totalIngresos = redondearMoneda(sumIng);
    const totalImpuestosIva = redondearMoneda(sumIva);
    const totalCostoVentas = redondearMoneda(sumCosto);
    const totalGastos = redondearMoneda(sumGastos);
    const gananciaBruta = redondearMoneda(totalIngresos - totalCostoVentas);
    const gananciaNeta = redondearMoneda(gananciaBruta - totalGastos);
    return {
      totalIngresos,
      totalImpuestosIva,
      totalCostoVentas,
      totalGastos,
      gananciaBruta,
      gananciaNeta,
    };
  }

  private calcularUnMesEstadistica(
    anio: number,
    mes: number,
    pedidos: PedidoConRelaciones[],
    gastos: Gasto[],
    cobrosAsesoriaPagados: { montoTotal: number; montoIva: number; fechaPago: Date | null }[],
  ): MesEstadistica {
    const tz = ESTADISTICAS_ZONA;
    const todasVentas = pedidos.filter((p) => p.tipo === 'venta');
    const todasCompras = pedidos.filter((p) => p.tipo === 'compra');

    const gastosMes = gastos.filter((g) => fechaCaeEnMesCalendario(g.fecha, anio, mes, tz));

    const { ingresos: ingresoVentasMes, costo: costoVentasSoloPedidos, iva: ivaVentasMes } =
      ingresoCostoIvaVentasPorCobrosEnMes(todasVentas, anio, mes, tz);

    const costoComprasMes = costoComprasPorPagosEnMes(todasCompras, anio, mes, tz);
    const costoVentas = redondearMoneda(costoVentasSoloPedidos + costoComprasMes);

    const cobrosAsesoriaMes = cobrosAsesoriaPagados.filter((c) => {
      if (!c.fechaPago) return false;
      return fechaCaeEnMesCalendario(c.fechaPago, anio, mes, tz);
    });
    const ingresoAsesoriasMes = cobrosAsesoriaMes.reduce((acc, c) => acc + c.montoTotal, 0);
    const ingresos = redondearMoneda(ingresoVentasMes + ingresoAsesoriasMes);
    const impuestosIva = redondearMoneda(
      ivaVentasMes + cobrosAsesoriaMes.reduce((acc, c) => acc + c.montoIva, 0),
    );
    const ganancia = redondearMoneda(ingresos - costoVentas);
    const gastosTotalMes = gastosMes.reduce((acc, g) => acc + g.monto, 0);
    const gananciaNeta = redondearMoneda(ganancia - gastosTotalMes);

    const ingresosPedidos = redondearMoneda(ingresoVentasMes);
    const ingresosAsesorias = redondearMoneda(ingresoAsesoriasMes);
    const margenPedidos = redondearMoneda(ingresoVentasMes - costoVentas);
    const margenAsesorias = redondearMoneda(ingresoAsesoriasMes);
    const sumaMargen = redondearMoneda(margenPedidos + margenAsesorias);
    let gananciaNetaPedidos = gananciaNeta;
    let gananciaNetaAsesorias = 0;
    if (Math.abs(sumaMargen) >= 0.005) {
      gananciaNetaPedidos = redondearMoneda(gananciaNeta * (margenPedidos / sumaMargen));
      gananciaNetaAsesorias = redondearMoneda(gananciaNeta - gananciaNetaPedidos);
    }

    return {
      mes: MESES_ETQ[mes] ?? String(mes + 1),
      anio,
      ingresos,
      impuestosIva,
      costoVentas,
      ganancia,
      gastos: gastosTotalMes,
      gananciaNeta,
      ingresosPedidos,
      ingresosAsesorias,
      gananciaNetaPedidos,
      gananciaNetaAsesorias,
    };
  }
}
