/**
 * Un bloqueo de cancha (OutOfService) está activo desde su inicio y hasta su fin
 * (exclusive). Un bloqueo programado todavía no empezó; uno vencido ya terminó.
 * Equivale a OutOfService.isActive() del diagrama de clases.
 */
export function isOutOfServiceActive(
  outOfService: { fromDateTime: Date; toDateTime: Date },
  now: Date = new Date(),
): boolean {
  const time = now.getTime();
  return new Date(outOfService.fromDateTime).getTime() <= time && time < new Date(outOfService.toDateTime).getTime();
}
