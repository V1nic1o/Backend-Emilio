/**
 * Verificación local de criterios de estadísticas (sin DB ni HTTP).
 * Ejecutar: npx ts-node -r tsconfig-paths/register src/estadisticas/ejecutar-verificacion-estadisticas.ts
 */
import { TipoItem } from '@prisma/client';
import {
  ESTADISTICAS_ZONA,
  addCalendarMonths,
  fechaCaeEnMesCalendario,
  parseIsoDateYm,
  todayYearMonthInZone,
  yearMonthInZone,
} from './estadisticas-fecha.util';
import { modoPedidoNegocio } from '../comunes/utilidades/modo-pedido.util';
import {
  type PedidoConRelacionesEstadisticas,
  costoComprasPorPagosEnMes,
  ingresoCostoIvaVentasPorCobrosEnMes,
} from './estadisticas-calculo.util';

let fallos = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FALLO: ${msg}`);
    fallos += 1;
  } else {
    console.log(`OK: ${msg}`);
  }
}

function assertApprox(a: number, b: number, msg: string, eps = 0.02) {
  assert(Math.abs(a - b) <= eps, `${msg} (esperado ~${b}, obtuvo ${a})`);
}

/** Mayo 2026 en Guatemala — mediodía UTC suele seguir siendo el mismo día local. */
const MAYO_2026 = new Date('2026-05-15T18:00:00.000Z');

function itemBase(over: Partial<{ precioCompra: number; precioVenta: number }> = {}) {
  return {
    id: 1,
    pedidoId: 1,
    productoId: null as number | null,
    tipo: TipoItem.bien,
    nombre: 'Item',
    cantidad: 1,
    precioCompra: over.precioCompra ?? 4000,
    precioVenta: over.precioVenta ?? 16000,
  };
}

function main() {
  console.log('--- Fechas (zona) ---');
  const ym = yearMonthInZone(MAYO_2026, ESTADISTICAS_ZONA);
  assert(ym.year === 2026 && ym.monthIndex === 4, 'Mayo 2026 en America/Guatemala');

  assert(fechaCaeEnMesCalendario(MAYO_2026, 2026, 4, ESTADISTICAS_ZONA), 'fechaCaeEnMesCalendario mayo 2026');
  assert(!fechaCaeEnMesCalendario(MAYO_2026, 2026, 3, ESTADISTICAS_ZONA), 'no es abril');

  const p1 = parseIsoDateYm('2026-03-01');
  assert(p1?.year === 2026 && p1.monthIndex === 2, 'parseIsoDateYm marzo');
  assert(parseIsoDateYm('xx') == null, 'parseIsoDateYm inválido');

  const hoy = todayYearMonthInZone(ESTADISTICAS_ZONA);
  const m1 = addCalendarMonths(hoy.year, hoy.monthIndex, -1);
  const m2 = addCalendarMonths(m1.year, m1.monthIndex, 1);
  assert(m2.year === hoy.year && m2.monthIndex === hoy.monthIndex, 'addCalendarMonths ida y vuelta');

  console.log('\n--- Modo de pedido (resolución) ---');
  assert(modoPedidoNegocio({ tipo: 'compra', esIntermediacion: false, personaId: 1, proveedorId: null }) === null, 'compra sin modo venta');
  assert(
    modoPedidoNegocio({ tipo: 'venta', esIntermediacion: false, personaId: 10, proveedorId: 20 }) === 'venta_cliente',
    'modo venta_cliente',
  );
  assert(
    modoPedidoNegocio({ tipo: 'venta', esIntermediacion: true, personaId: 10, proveedorId: 20 }) === 'venta_proveedor',
    'modo venta_proveedor (intermediación)',
  );
  assert(
    modoPedidoNegocio({ tipo: 'venta', esIntermediacion: false, personaId: null, proveedorId: 20 }) === 'venta_proveedor',
    'sin cliente en app → canal proveedor (mismo modo)',
  );

  console.log('\n--- Venta cliente + proveedor: cobro entero al margen si no pagás proveedor en el mes ---');
  const ventaClienteProv: PedidoConRelacionesEstadisticas = {
    id: 6,
    tipo: 'venta',
    personaId: 10,
    proveedorId: 20,
    esIntermediacion: false,
    impuesto: null,
    items: [itemBase({ precioCompra: 30000, precioVenta: 43600 })],
    pagos: [{ id: 1, pedidoId: 6, monto: 19000, fecha: MAYO_2026 }],
    pagosProveedor: [],
  } as PedidoConRelacionesEstadisticas;
  const rCp = ingresoCostoIvaVentasPorCobrosEnMes([ventaClienteProv], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(rCp.ingresos, 19000, 'ingreso cobro cliente completo');
  assertApprox(rCp.costo, 0, 'sin pago al proveedor en el mes → costo 0');
  const ventaClienteProvPagoProv = {
    ...ventaClienteProv,
    pagosProveedor: [{ id: 1, pedidoId: 6, monto: 12000, fecha: MAYO_2026, tipo: 'pago' }],
  } as PedidoConRelacionesEstadisticas;
  const rCp2 = ingresoCostoIvaVentasPorCobrosEnMes([ventaClienteProvPagoProv], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(rCp2.ingresos, 19000, 'ingreso sin cambio');
  assertApprox(rCp2.costo, 12000, 'costo = pago al proveedor en el mes');

  console.log('\n--- Venta cliente + cobro parcial ---');
  const ventaCliente: PedidoConRelacionesEstadisticas = {
    id: 1,
    tipo: 'venta',
    personaId: 10,
    proveedorId: null,
    esIntermediacion: false,
    impuesto: null,
    items: [itemBase({ precioCompra: 4000, precioVenta: 10000 })],
    pagos: [{ id: 1, pedidoId: 1, monto: 5000, fecha: MAYO_2026 }],
    pagosProveedor: [],
  } as PedidoConRelacionesEstadisticas;

  const r1 = ingresoCostoIvaVentasPorCobrosEnMes([ventaCliente], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(r1.ingresos, 5000, 'ingreso cliente parcial');
  assert(r1.costo > 0 && r1.costo < 4000, 'costo prorrateado parcial');
  assert(r1.iva === 0, 'sin IVA declarado');

  console.log('\n--- Intermediación: solo reparto proveedor en el mes ---');
  const inter: PedidoConRelacionesEstadisticas = {
    id: 2,
    tipo: 'venta',
    personaId: 10,
    proveedorId: 20,
    esIntermediacion: true,
    impuesto: null,
    items: [itemBase({ precioCompra: 2000, precioVenta: 16000 })],
    pagos: [],
    pagosProveedor: [{ id: 1, pedidoId: 2, monto: 2500, fecha: MAYO_2026, tipo: 'pago' }],
  } as PedidoConRelacionesEstadisticas;

  const r2 = ingresoCostoIvaVentasPorCobrosEnMes([inter], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(r2.ingresos, 2500, 'ingreso intermediación proveedor→empresa');
  assertApprox(r2.costo, 0, 'intermediación sin costo de catálogo en empresa');

  console.log('\n--- Intermediación: pagos del pedido en el mes no son ingreso de empresa ---');
  const interConPagosPedido: PedidoConRelacionesEstadisticas = {
    ...inter,
    id: 3,
    pagos: [{ id: 2, pedidoId: 3, monto: 92500, fecha: MAYO_2026 }],
    pagosProveedor: [{ id: 1, pedidoId: 3, monto: 2500, fecha: MAYO_2026, tipo: 'pago' }],
  } as PedidoConRelacionesEstadisticas;
  const r3 = ingresoCostoIvaVentasPorCobrosEnMes([interConPagosPedido], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(r3.ingresos, 2500, 'solo reparto proveedor→empresa');
  assertApprox(r3.costo, 0, 'pagos del pedido no imputan costo en intermediación');

  console.log('\n--- Venta sin cliente: ingreso_cliente_a_proveedor ---');
  const soloProv: PedidoConRelacionesEstadisticas = {
    id: 4,
    tipo: 'venta',
    personaId: null,
    proveedorId: 20,
    esIntermediacion: false,
    impuesto: null,
    items: [itemBase({ precioCompra: 5000, precioVenta: 12000 })],
    pagos: [],
    pagosProveedor: [
      { id: 1, pedidoId: 4, monto: 3000, fecha: MAYO_2026, tipo: 'ingreso_cliente_a_proveedor' },
    ],
  } as PedidoConRelacionesEstadisticas;
  const r4 = ingresoCostoIvaVentasPorCobrosEnMes([soloProv], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(r4.ingresos, 3000, 'ingreso cliente→proveedor cuenta como caja');
  assert(r4.costo === 0, 'sin costo catálogo en venta sin cliente');

  console.log('\n--- Compra: pago al proveedor en el mes ---');
  const compra: PedidoConRelacionesEstadisticas = {
    id: 5,
    tipo: 'compra',
    personaId: 30,
    proveedorId: null,
    esIntermediacion: false,
    impuesto: null,
    items: [itemBase({ precioCompra: 10000, precioVenta: 0 })],
    pagos: [{ id: 1, pedidoId: 5, monto: 4000, fecha: MAYO_2026 }],
    pagosProveedor: [],
  } as PedidoConRelacionesEstadisticas;
  const cCost = costoComprasPorPagosEnMes([compra], 2026, 4, ESTADISTICAS_ZONA);
  assertApprox(cCost, 4000, 'compra prorratea costo con pago parcial');

  console.log('\n--- Coherencia suma mensual vs “histórico” simulado (2 meses) ---');
  const vJun = {
    ...ventaCliente,
    pagos: [{ id: 1, pedidoId: 1, monto: 2000, fecha: new Date('2026-06-10T18:00:00.000Z') }],
  } as PedidoConRelacionesEstadisticas;
  const rMay = ingresoCostoIvaVentasPorCobrosEnMes([ventaCliente], 2026, 4, ESTADISTICAS_ZONA);
  const rJun = ingresoCostoIvaVentasPorCobrosEnMes([vJun], 2026, 5, ESTADISTICAS_ZONA);
  const sumIng = rMay.ingresos + rJun.ingresos;
  assert(sumIng >= 5000 && sumIng <= 9000, 'suma de cobros en dos meses es consistente');

  console.log('\n--- Resultado ---');
  if (fallos === 0) {
    console.log('\nTodas las verificaciones pasaron.');
    process.exit(0);
  } else {
    console.error(`\n${fallos} verificación(es) fallaron.`);
    process.exit(1);
  }
}

main();
