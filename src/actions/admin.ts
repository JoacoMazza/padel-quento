"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { Account } from "@/src/entities/Account";
import { Admin } from "@/src/entities/Admin";
import { getDataSource } from "@/src/lib/db";
import { duplicateAdminMessage, isUniqueViolation } from "@/src/lib/db-errors";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { validateDni } from "@/src/domain/dni";
import { AdminAccessLevel } from "@/src/domain/enums";
import { ForbiddenError, UnauthorizedError, requireOwner } from "@/src/lib/rbac";

// Gestionar administradores es solo para el dueño del complejo (requireOwner).

/** Errores de permisos: se muestran tal cual. */
function authErrorMessage(error: unknown): string | null {
  return error instanceof ForbiddenError || error instanceof UnauthorizedError ? error.message : null;
}

export type CreateAdminInput = {
  email: string;
  password: string;
  names: string;
  lastnames: string;
  /** Obligatorio, de 7 u 8 dígitos y sin repetirse entre administradores (UQ_admins_dni). */
  dni: number;
  /** Dueño o trabajador; por defecto, trabajador. */
  accessLevel?: AdminAccessLevel;
};

/** Lo que ve el dueño en la sección Equipo (sin datos de la cuenta como la contraseña). */
export type TeamMember = {
  id: number;
  names: string;
  lastnames: string;
  dni: number | null;
  email: string;
  accessLevel: AdminAccessLevel;
  /** true si es el propio dueño que está mirando: no puede darse de baja ni cambiarse el nivel. */
  isSelf: boolean;
};

export type UpdateAdminInput = Partial<Omit<CreateAdminInput, "password">> & {
  password?: string;
};

/** Crea al administrador junto con su cuenta en una misma transacción. */
export async function createAdmin(
  input: CreateAdminInput,
): Promise<ActionResult<Admin>> {
  try {
    await requireOwner();
    const dniError = validateDni(input.dni);
    if (dniError) {
      return { success: false, error: dniError };
    }

    const dataSource = await getDataSource();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const saved = await dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository<Account>("Account");
      const admins = manager.getRepository<Admin>("Admin");

      const account = await accounts.save(
        accounts.create({
          email: input.email,
          passwordHash,
        }),
      );
      return admins.save(
        admins.create({
          account,
          names: input.names,
          lastnames: input.lastnames,
          dni: input.dni,
          accessLevel: input.accessLevel ?? AdminAccessLevel.STAFF,
        }),
      );
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    if (isUniqueViolation(error)) {
      return { success: false, error: duplicateAdminMessage(error) };
    }
    console.error("createAdmin", error);
    return { success: false, error: "No se pudo crear el administrador." };
  }
}

export async function getAdmins(): Promise<ActionResult<Admin[]>> {
  try {
    await requireOwner();
    const dataSource = await getDataSource();
    const admins = dataSource.getRepository<Admin>("Admin");
    const data = await admins.find({ relations: { account: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("getAdmins", error);
    return { success: false, error: "No se pudieron obtener los administradores." };
  }
}

export async function getAdminById(
  id: number,
): Promise<ActionResult<Admin | null>> {
  try {
    await requireOwner();
    const dataSource = await getDataSource();
    const admins = dataSource.getRepository<Admin>("Admin");
    const data = await admins.findOne({ where: { id }, relations: { account: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("getAdminById", error);
    return { success: false, error: "No se pudo obtener el administrador." };
  }
}

/**
 * Reparte los campos a actualizar entre la cuenta y el administrador. El DNI no
 * se puede borrar, y a un administrador anterior a que fuera obligatorio se le
 * pide cargarlo al editarlo. El dueño no puede cambiarse su propio nivel, para
 * no quedarse sin acceso.
 */
export async function updateAdmin(
  id: number,
  input: UpdateAdminInput,
): Promise<ActionResult<Admin>> {
  try {
    const owner = await requireOwner();
    if (input.accessLevel !== undefined && id === owner.adminId) {
      return { success: false, error: "No podés cambiar tu propio nivel de acceso." };
    }
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager): Promise<{ admin: Admin } | { error: string }> => {
      const admins = manager.getRepository<Admin>("Admin");
      const admin = await admins.findOne({ where: { id }, relations: { account: true } });
      if (!admin) {
        return { error: "El administrador no existe." };
      }

      const { email, password, names, lastnames, dni, accessLevel } = input;
      const dniError = validateDni(dni !== undefined ? dni : admin.dni);
      if (dniError) {
        return { error: dniError };
      }

      if (email !== undefined) admin.account.email = email;
      if (password) admin.account.passwordHash = await bcrypt.hash(password, 12);
      if (names !== undefined) admin.names = names;
      if (lastnames !== undefined) admin.lastnames = lastnames;
      if (dni !== undefined) admin.dni = dni;
      if (accessLevel !== undefined) admin.accessLevel = accessLevel;

      admin.account = await manager.getRepository<Account>("Account").save(admin.account);
      return { admin: await admins.save(admin) };
    });

    if ("error" in saved) {
      return { success: false, error: saved.error };
    }
    return { success: true, data: toPlain(saved.admin) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    if (isUniqueViolation(error)) {
      return { success: false, error: duplicateAdminMessage(error) };
    }
    console.error("updateAdmin", error);
    return { success: false, error: "No se pudo actualizar el administrador." };
  }
}

/**
 * Elimina al administrador borrando su cuenta (admins.account_id tiene ON DELETE
 * CASCADE). El dueño no puede darse de baja a sí mismo.
 */
export async function deleteAdmin(id: number): Promise<ActionResult<null>> {
  try {
    const owner = await requireOwner();
    if (id === owner.adminId) {
      return { success: false, error: "No podés darte de baja a vos mismo." };
    }
    const dataSource = await getDataSource();
    const admins = dataSource.getRepository<Admin>("Admin");

    const admin = await admins.findOne({ where: { id }, relations: { account: true } });
    if (!admin) {
      return { success: false, error: "El administrador no existe." };
    }

    await dataSource.getRepository<Account>("Account").delete(admin.account.id);
    return { success: true, data: null };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("deleteAdmin", error);
    return { success: false, error: "No se pudo eliminar el administrador." };
  }
}

/** Equipo del complejo para la sección Equipo del panel (solo el dueño). */
export async function getTeam(): Promise<ActionResult<TeamMember[]>> {
  try {
    const owner = await requireOwner();
    const dataSource = await getDataSource();
    const admins = await dataSource
      .getRepository<Admin>("Admin")
      .find({ relations: { account: true }, order: { lastnames: "ASC", names: "ASC" } });
    return {
      success: true,
      data: admins.map((admin) => ({
        id: admin.id,
        names: admin.names,
        lastnames: admin.lastnames,
        dni: admin.dni,
        email: admin.account.email,
        accessLevel: admin.accessLevel,
        isSelf: admin.id === owner.adminId,
      })),
    };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("getTeam", error);
    return { success: false, error: "No se pudo obtener el equipo." };
  }
}
