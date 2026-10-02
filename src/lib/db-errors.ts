import { QueryFailedError } from "typeorm";

const UNIQUE_VIOLATION_CODE = "23505";
const BOOKER_PHONE_NUMBER_CONSTRAINT = "UQ_bookers_phone_number";

export const DUPLICATE_EMAIL_MESSAGE = "El correo ya está en uso.";
export const DUPLICATE_PHONE_NUMBER_MESSAGE = "El teléfono ya está en uso.";

export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string };
  return driverError.code === UNIQUE_VIOLATION_CODE;
}

/**
 * Mensaje para una violación de unicidad al crear o editar una cuenta: el
 * teléfono del booker (UQ_bookers_phone_number) o, si no, el email de la cuenta.
 */
export function duplicateAccountMessage(error: unknown): string {
  const driverError = error instanceof QueryFailedError ? (error.driverError as { constraint?: string }) : {};
  return driverError.constraint === BOOKER_PHONE_NUMBER_CONSTRAINT
    ? DUPLICATE_PHONE_NUMBER_MESSAGE
    : DUPLICATE_EMAIL_MESSAGE;
}
