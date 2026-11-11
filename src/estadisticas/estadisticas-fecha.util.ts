/**
 * Zona horaria de negocio para agrupar estadísticas por mes calendario
 * (cobros, gastos, asesorías pagadas).
 */
export const ESTADISTICAS_ZONA = 'America/Guatemala';

/** Año y mes 0–11 del instante `d` en la zona configurada. */
export function yearMonthInZone(d: Date, timeZone: string): { year: number; monthIndex: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const mo = Number(parts.find((p) => p.type === 'month')?.value);
  if (!Number.isFinite(y) || !Number.isFinite(mo)) {
    return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
  }
  return { year: y, monthIndex: mo - 1 };
}

/** Hoy (reloj del servidor) proyectado al calendario de la zona. */
export function todayYearMonthInZone(timeZone: string): { year: number; monthIndex: number } {
  return yearMonthInZone(new Date(), timeZone);
}

export function fechaCaeEnMesCalendario(
  fecha: Date | string,
  anio: number,
  monthIndex: number,
  timeZone: string,
): boolean {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return false;
  const { year, monthIndex: m0 } = yearMonthInZone(d, timeZone);
  return year === anio && m0 === monthIndex;
}

export function addCalendarMonths(
  year: number,
  monthIndex: number,
  deltaMonths: number,
): { year: number; monthIndex: number } {
  const t = year * 12 + monthIndex + deltaMonths;
  const y = Math.floor(t / 12);
  const m0 = ((t % 12) + 12) % 12;
  return { year: y, monthIndex: m0 };
}

/** Parsea YYYY-MM-DD (como envía el front) a año y mes 0–11 sin depender del parse de Date. */
export function parseIsoDateYm(iso: string): { year: number; monthIndex: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const mo = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(mo) || mo < 1 || mo > 12) return null;
  return { year, monthIndex: mo - 1 };
}
