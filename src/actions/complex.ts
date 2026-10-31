"use server";

import "reflect-metadata";
import type { Complex } from "@/src/entities/Complex";
import { isValidWhatsAppNumber, toWhatsAppDigits, whatsAppContactUrl, type WhatsAppContact } from "@/src/domain/complex";
import { getDataSource } from "@/src/lib/db";
import { findClubComplex } from "@/src/lib/club-complex";
import type { ActionResult } from "@/src/lib/action-result";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "@/src/lib/rbac";

/** WhatsApp de contacto de un complejo, como lo edita el panel. */
export type ComplexContact = {
  id: number;
  name: string;
  whatsappNumber: string | null;
  whatsappMessage: string | null;
};

export type UpdateComplexContactInput = { whatsappNumber: string; whatsappMessage: string };

const MAX_MESSAGE_LENGTH = 500;
// Lo que puede tener un teléfono escrito a mano: dígitos, espacios, guiones, paréntesis y el + del código de país.
const PHONE_CHARACTERS = /^[\d\s()+-]*$/;

function toContact(complex: Complex): ComplexContact {
  return {
    id: complex.id,
    name: complex.name,
    whatsappNumber: complex.whatsappNumber,
    whatsappMessage: complex.whatsappMessage,
  };
}

/** Errores de permisos: se muestran tal cual. */
function authErrorMessage(error: unknown): string | null {
  return error instanceof ForbiddenError || error instanceof UnauthorizedError ? error.message : null;
}

/**
 * WhatsApp del complejo del club, para los botones de contacto (público): el
 * link al chat y el número como se muestra. Null si no tiene número.
 */
export async function getWhatsAppContact(): Promise<ActionResult<WhatsAppContact | null>> {
  try {
    const dataSource = await getDataSource();
    const complex = await findClubComplex(dataSource);
    const url = whatsAppContactUrl(complex?.whatsappNumber, complex?.whatsappMessage);
    return { success: true, data: url && complex?.whatsappNumber ? { url, number: complex.whatsappNumber } : null };
  } catch (error) {
    console.error("getWhatsAppContact", error);
    return { success: false, error: "No se pudo obtener el WhatsApp de contacto." };
  }
}

/** WhatsApp de contacto de cada complejo: cualquier administrador. */
export async function getComplexContacts(): Promise<ActionResult<ComplexContact[]>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const complexes = await dataSource.getRepository<Complex>("Complex").find({ order: { id: "ASC" } });
    return { success: true, data: complexes.map(toContact) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("getComplexContacts", error);
    return { success: false, error: "No se pudieron obtener los complejos." };
  }
}

/**
 * Carga el WhatsApp de contacto de un complejo: cualquier administrador. El
 * número se guarda como se escribió (para mostrarlo así) y el link usa sus
 * dígitos; vacío lo borra y el botón deja de mostrarse.
 */
export async function updateComplexContact(
  id: number,
  input: UpdateComplexContactInput,
): Promise<ActionResult<ComplexContact>> {
  try {
    await requireAdmin();
    const whatsappNumber = input.whatsappNumber.trim().replace(/\s+/g, " ") || null;
    if (whatsappNumber && !PHONE_CHARACTERS.test(whatsappNumber)) {
      return {
        success: false,
        error: "El número de WhatsApp solo puede tener dígitos, espacios, guiones, paréntesis y el + del código de país.",
      };
    }
    if (whatsappNumber && !isValidWhatsAppNumber(toWhatsAppDigits(whatsappNumber))) {
      return {
        success: false,
        error: "El número de WhatsApp tiene que tener entre 10 y 15 dígitos, con el código de país (por ejemplo +54 9 221 604-9987).",
      };
    }
    const whatsappMessage = input.whatsappMessage.trim() || null;
    if (whatsappMessage && whatsappMessage.length > MAX_MESSAGE_LENGTH) {
      return { success: false, error: `El mensaje inicial puede tener hasta ${MAX_MESSAGE_LENGTH} caracteres.` };
    }

    const dataSource = await getDataSource();
    const complexes = dataSource.getRepository<Complex>("Complex");
    const complex = await complexes.findOne({ where: { id } });
    if (!complex) {
      return { success: false, error: "El complejo no existe." };
    }

    complexes.merge(complex, { whatsappNumber, whatsappMessage });
    const saved = await complexes.save(complex);
    return { success: true, data: toContact(saved) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("updateComplexContact", error);
    return { success: false, error: "No se pudo guardar el WhatsApp de contacto." };
  }
}
