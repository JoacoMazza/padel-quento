export const DNI_REQUIRED_MESSAGE = "El DNI es obligatorio.";
export const INVALID_DNI_MESSAGE = "Ingresá un DNI válido (7 u 8 dígitos).";

const MIN_DNI = 1_000_000;
const MAX_DNI = 99_999_999;

/** Valida un DNI argentino (entero de 7 u 8 dígitos). Devuelve el mensaje de error, o null si es válido. */
export function validateDni(dni: number | null | undefined): string | null {
  if (dni === null || dni === undefined) return DNI_REQUIRED_MESSAGE;
  if (!Number.isInteger(dni) || dni < MIN_DNI || dni > MAX_DNI) return INVALID_DNI_MESSAGE;
  return null;
}
