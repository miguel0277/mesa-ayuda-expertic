const pctFmt = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });

/**
 * 66.666 → "66,7 %" (coma decimal y espacio de no separación para que no se parta la línea).
 * Sin dato → "—".
 */
export function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${pctFmt.format(value)} %`;
}
