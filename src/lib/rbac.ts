import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { Role } from "@/src/domain/enums";

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "No autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Acceso denegado: Se requieren permisos de Administrador") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Obtiene la sesión actual del usuario autenticado.
 */
export async function getCurrentUserSession() {
  return getServerSession(authOptions);
}

/**
 * Verifica que el usuario tenga rol de Administrador.
 * Lanza `UnauthorizedError` si no hay sesión activa, o `ForbiddenError` si el rol no es ADMIN.
 */
export async function requireAdmin() {
  const session = await getCurrentUserSession();
  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }

  if (session.user.role !== Role.ADMIN) {
    throw new ForbiddenError();
  }

  return session.user;
}

/**
 * Verifica si el usuario actual posee alguno de los roles permitidos.
 */
export async function requireRole(allowedRoles: Role | Role[]) {
  const session = await getCurrentUserSession();
  if (!session?.user?.email) {
    throw new UnauthorizedError();
  }

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (!session.user.role || !roles.includes(session.user.role)) {
    throw new ForbiddenError("Acceso denegado: Rol no autorizado");
  }

  return session.user;
}
