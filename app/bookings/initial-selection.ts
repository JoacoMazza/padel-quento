import type { InitialSelection } from "@/app/bookings/bookings-board";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turno elegido antes de iniciar sesión, desde la URL de /bookings
 * (?date=YYYY-MM-DD&court=ID&time=HH:MM). Si falta o no es válido, se ignora.
 */
export function parseInitialSelection(searchParams: SearchParams): InitialSelection | undefined {
  const date = first(searchParams.date);
  const court = first(searchParams.court);
  const time = first(searchParams.time);
  if (!date || !court || !time) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(court) || !/^\d{2}:\d{2}$/.test(time)) return undefined;
  return { date, courtId: Number(court), time };
}
