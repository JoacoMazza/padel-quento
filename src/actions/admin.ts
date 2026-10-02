"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { Account } from "@/src/entities/Account";
import { Admin } from "@/src/entities/Admin";
import { getDataSource } from "@/src/lib/db";
import { DUPLICATE_EMAIL_MESSAGE, isUniqueViolation } from "@/src/lib/db-errors";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateAdminInput = {
  email: string;
  password: string;
  names: string;
  lastnames: string;
  dni?: number | null;
  photoUrl?: string | null;
};

export type UpdateAdminInput = Partial<Omit<CreateAdminInput, "password">> & {
  password?: string;
};

/** Crea al administrador junto con su cuenta en una misma transacción. */
export async function createAdmin(
  input: CreateAdminInput,
): Promise<ActionResult<Admin>> {
  try {
    const dataSource = await getDataSource();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const saved = await dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository<Account>("Account");
      const admins = manager.getRepository<Admin>("Admin");

      const account = await accounts.save(
        accounts.create({
          email: input.email,
          passwordHash,
          photoUrl: input.photoUrl ?? null,
        }),
      );
      return admins.save(
        admins.create({
          account,
          names: input.names,
          lastnames: input.lastnames,
          dni: input.dni ?? null,
        }),
      );
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: DUPLICATE_EMAIL_MESSAGE };
    }
    console.error("createAdmin", error);
    return { success: false, error: "No se pudo crear el administrador." };
  }
}

export async function getAdmins(): Promise<ActionResult<Admin[]>> {
  try {
    const dataSource = await getDataSource();
    const admins = dataSource.getRepository<Admin>("Admin");
    const data = await admins.find({ relations: { account: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getAdmins", error);
    return { success: false, error: "No se pudieron obtener los administradores." };
  }
}

export async function getAdminById(
  id: number,
): Promise<ActionResult<Admin | null>> {
  try {
    const dataSource = await getDataSource();
    const admins = dataSource.getRepository<Admin>("Admin");
    const data = await admins.findOne({ where: { id }, relations: { account: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getAdminById", error);
    return { success: false, error: "No se pudo obtener el administrador." };
  }
}

/** Reparte los campos a actualizar entre la cuenta y el administrador. */
export async function updateAdmin(
  id: number,
  input: UpdateAdminInput,
): Promise<ActionResult<Admin>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      const admins = manager.getRepository<Admin>("Admin");
      const admin = await admins.findOne({ where: { id }, relations: { account: true } });
      if (!admin) {
        return null;
      }

      const { email, password, photoUrl, names, lastnames, dni } = input;

      if (email !== undefined) admin.account.email = email;
      if (photoUrl !== undefined) admin.account.photoUrl = photoUrl;
      if (password) admin.account.passwordHash = await bcrypt.hash(password, 12);
      if (names !== undefined) admin.names = names;
      if (lastnames !== undefined) admin.lastnames = lastnames;
      if (dni !== undefined) admin.dni = dni;

      admin.account = await manager.getRepository<Account>("Account").save(admin.account);
      return admins.save(admin);
    });

    if (!saved) {
      return { success: false, error: "El administrador no existe." };
    }
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: DUPLICATE_EMAIL_MESSAGE };
    }
    console.error("updateAdmin", error);
    return { success: false, error: "No se pudo actualizar el administrador." };
  }
}

/** Elimina al administrador borrando su cuenta (admins.account_id tiene ON DELETE CASCADE). */
export async function deleteAdmin(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const admins = dataSource.getRepository<Admin>("Admin");

    const admin = await admins.findOne({ where: { id }, relations: { account: true } });
    if (!admin) {
      return { success: false, error: "El administrador no existe." };
    }

    await dataSource.getRepository<Account>("Account").delete(admin.account.id);
    return { success: true, data: null };
  } catch (error) {
    console.error("deleteAdmin", error);
    return { success: false, error: "No se pudo eliminar el administrador." };
  }
}
