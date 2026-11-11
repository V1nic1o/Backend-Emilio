/**
 * Verificación manual de la lógica de meses (backfill asesorías).
 * Ejecutar: npm run test:asesorias-periodos
 */
import { mesesRangoInclusivo, periodoDesdeFecha } from './util/periodo-meses-asesoria.util';

function assert(cond: boolean, mensaje: string): void {
  if (!cond) {
    console.error('FALLA:', mensaje);
    process.exit(1);
  }
}

function igualPeriodos(
  a: { anio: number; mes: number }[],
  b: { anio: number; mes: number }[],
): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => p.anio === b[i].anio && p.mes === b[i].mes);
}

// Alta abril → sincronizar hasta junio: debe incluir mayo (no saltar)
const abrJun = mesesRangoInclusivo({ anio: 2026, mes: 4 }, { anio: 2026, mes: 6 });
assert(
  igualPeriodos(abrJun, [
    { anio: 2026, mes: 4 },
    { anio: 2026, mes: 5 },
    { anio: 2026, mes: 6 },
  ]),
  'Abr–Jun 2026 debe incluir may',
);

// Un solo mes
assert(mesesRangoInclusivo({ anio: 2026, mes: 5 }, { anio: 2026, mes: 5 }).length === 1, 'Mismo mes = 1 fila');

// Cruce de año
const novAFeb = mesesRangoInclusivo({ anio: 2025, mes: 11 }, { anio: 2026, mes: 2 });
assert(
  igualPeriodos(novAFeb, [
    { anio: 2025, mes: 11 },
    { anio: 2025, mes: 12 },
    { anio: 2026, mes: 1 },
    { anio: 2026, mes: 2 },
  ]),
  'Cruce año nov–feb',
);

// Fin antes que inicio → vacío
assert(mesesRangoInclusivo({ anio: 2026, mes: 6 }, { anio: 2026, mes: 4 }).length === 0, 'Rango inválido vacío');

// Alta mediados de abril (fecha típica usuario)
const pAbr15 = periodoDesdeFecha(new Date(2026, 3, 15));
assert(pAbr15.anio === 2026 && pAbr15.mes === 4, '15 abr 2026 → mes 4');

const desdeAlta = mesesRangoInclusivo(pAbr15, { anio: 2026, mes: 6 });
assert(desdeAlta.length === 3 && desdeAlta[1].mes === 5, 'Desde alta abr hasta jun incluye may');

console.log('OK — verificación periodos asesoría (backfill abril→jun incluye mayo, cruce año, bordes)');
