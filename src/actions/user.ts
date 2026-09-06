"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { User } from "@/src/entities/User";
import { Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { isUniqueViolation } from "@/src/lib/db-errors";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateUserInput = {
  email: string;
  password: string;
  names: string;
  lastnames: string;
  dni?: number | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
  role?: Role;
};

export type UpdateUserInput = Partial<
  Omit<CreateUserInput, "email" | "password">
> & {
  email?: string;
  password?: string;
};

export async function createUser(
  input: CreateUserInput,
): Promise<ActionResult<User>> {
  try {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = users.create({
      email: input.email,
      passwordHash,
      names: input.names,
      lastnames: input.lastnames,
      dni: input.dni ?? null,
      phoneNumber: input.phoneNumber ?? null,
      photoUrl: input.photoUrl ?? null,
      role: input.role ?? Role.ADMIN,
    });

    const saved = await users.save(user);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "El correo ya está en uso." };
    }
    console.error("createUser", error);
    return { success: false, error: "No se pudo crear el usuario." };
  }
}

export async function getUsers(): Promise<ActionResult<User[]>> {
  try {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");
    const data = await users.find();
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getUsers", error);
    return { success: false, error: "No se pudieron obtener los usuarios." };
  }
}

export async function getUserById(
  id: number,
): Promise<ActionResult<User | null>> {
  try {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");
    const data = await users.findOne({ where: { id } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getUserById", error);
    return { success: false, error: "No se pudo obtener el usuario." };
  }
}

export async function updateUser(
  id: number,
  input: UpdateUserInput,
): Promise<ActionResult<User>> {
  try {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");

    const user = await users.findOne({ where: { id } });
    if (!user) {
      return { success: false, error: "El usuario no existe." };
    }

    const { password, ...rest } = input;
    users.merge(user, rest);
    if (password) {
      user.passwordHash = await bcrypt.hash(password, 12);
    }

    const saved = await users.save(user);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "El correo ya está en uso." };
    }
    console.error("updateUser", error);
    return { success: false, error: "No se pudo actualizar el usuario." };
  }
}

export async function deleteUser(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const users = dataSource.getRepository<User>("User");

    const result = await users.delete(id);
    if (!result.affected) {
      return { success: false, error: "El usuario no existe." };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("deleteUser", error);
    return { success: false, error: "No se pudo eliminar el usuario." };
  }
}
