import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { AdminAccessLevel, Role } from "@/src/domain/enums";
import type { Admin } from "@/src/entities/Admin";
import { getDataSource } from "@/src/lib/db";

export const OWNER_ONLY_MESSAGE = "Solo el dueño del complejo puede hacer esto.";

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
 * Verifica que el usuario sea el dueño del complejo (un admin con nivel OWNER).
 * El nivel se lee de la base y no de la sesión, así un cambio de nivel aplica
 * en el momento. Devuelve además el id del administrador.
 */
export async function requireOwner() {
  const user = await requireAdmin();
  const dataSource = await getDataSource();
  const admin = await dataSource
    .getRepository<Admin>("Admin")
    .findOne({ where: { account: { email: user.email! } } });
  if (admin?.accessLevel !== AdminAccessLevel.OWNER) {
    throw new ForbiddenError(OWNER_ONLY_MESSAGE);
  }
  return { ...user, adminId: admin.id };
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
