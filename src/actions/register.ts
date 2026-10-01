"use server";

import "reflect-metadata";
import { redirect } from "next/navigation";
import { createPlayer } from "@/src/actions/player";
import { DUPLICATE_EMAIL_MESSAGE, DUPLICATE_PHONE_NUMBER_MESSAGE } from "@/src/lib/db-errors";
import {
  parseRegisterForm,
  type FieldErrors,
} from "@/src/lib/register-validation";

export type RegisterState = {
  message?: string;
  errors?: FieldErrors;
};

export async function registerPlayer(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = parseRegisterForm(formData);
  if (parsed.errors || !parsed.data) {
    return { errors: parsed.errors };
  }

  const { names, lastnames, email, password, phoneNumber } = parsed.data;

  // createPlayer guarda cuenta, booker y jugador en una sola transacción y
  // traduce las violaciones de unicidad (email o teléfono) a un mensaje.
  const result = await createPlayer({ names, lastnames, email, password, phoneNumber });
  if (!result.success) {
    const isDuplicate = [DUPLICATE_EMAIL_MESSAGE, DUPLICATE_PHONE_NUMBER_MESSAGE].includes(result.error);
    return {
      message: isDuplicate ? result.error : "No se pudo crear la cuenta. Intentá de nuevo más tarde.",
    };
  }
  console.log(`[Register] Jugador guardado exitosamente en BD: ${email}`);

  redirect("/login");
}
