/**
 * Utilidades puras para periodos de asesoría mensual (sin Prisma).
 * Usadas por AsesoriasServicio y por el script de verificación.
 */

export function periodoDesdeFecha(d: Date): { anio: number; mes: number } {
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

/**
 * Cada par (año, mes) desde `inicio` hasta `fin`, ambos inclusive.
 * Si `fin` es anterior a `inicio` en calendario, devuelve [].
 */
export function mesesRangoInclusivo(
  inicio: { anio: number; mes: number },
  fin: { anio: number; mes: number },
): { anio: number; mes: number }[] {
  const out: { anio: number; mes: number }[] = [];
  if (fin.anio < inicio.anio || (fin.anio === inicio.anio && fin.mes < inicio.mes)) {
    return out;
  }
  let y = inicio.anio;
  let m = inicio.mes;
  while (y < fin.anio || (y === fin.anio && m <= fin.mes)) {
    out.push({ anio: y, mes: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
