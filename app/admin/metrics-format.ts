/** Duración en horas y minutos (por ejemplo 75 → "1h 15m"), redondeada al minuto. */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (mins === 0) return `${hours}h`;
  return hours === 0 ? `${mins}m` : `${hours}h ${mins}m`;
}

/** Porcentaje con dos decimales, con el formato argentino (por ejemplo 0.625 → "62,50%"). */
export function formatPercent(ratio: number): string {
  return `${(ratio * 100).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}
