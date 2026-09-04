"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { QueryFailedError } from "typeorm";
import { PlayerCategory, Role } from "@/src/domain/enums";
import { Player } from "@/src/entities/Player";
import { getDataSource } from "@/src/lib/db";
import {
  parseRegisterForm,
  type FieldErrors,
} from "@/src/lib/register-validation";

export type RegisterState = {
  message?: string;
  errors?: FieldErrors;
};

const DUPLICATE_EMAIL_MESSAGE = "El correo ya está en uso.";

function isUniqueViolation(error: unknown) {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string };
  return driverError.code === "23505";
}

export async function registerPlayer(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = parseRegisterForm(formData);
  if (parsed.errors || !parsed.data) {
    return { errors: parsed.errors };
  }

  const { names, lastnames, email, password } = parsed.data;

  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");

    const existing = await players.findOne({ where: { email } });
    if (existing) {
      return { message: DUPLICATE_EMAIL_MESSAGE };
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const player = players.create({
      names,
      lastnames,
      email,
      passwordHash,
      role: Role.PLAYER,
      category: PlayerCategory.WITHOUT_CATEGORY,
      scoring: 0,
      dni: null,
      phoneNumber: null,
      photoUrl: null,
    });

    await players.save(player);
    console.log(`[Register] Jugador guardado exitosamente en BD: ${email}`);
  } catch (error) {

    if (isUniqueViolation(error)) {
      return { message: DUPLICATE_EMAIL_MESSAGE };
    }
    console.error("registerPlayer", error);
    return {
      message: "No se pudo crear la cuenta. Intentá de nuevo más tarde.",
    };
  }

  redirect("/login");
}
