"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import type { Account } from "@/src/entities/Account";
import type { Player } from "@/src/entities/Player";
import type { Teacher } from "@/src/entities/Teacher";
import { PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { duplicateAccountMessage, isUniqueViolation } from "@/src/lib/db-errors";
import type { ActionResult } from "@/src/lib/action-result";
import { parseRegisterForm } from "@/src/lib/register-validation";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "@/src/lib/rbac";
import { cancelFutureClassesOf } from "@/src/lib/teacher-classes";
import { notifyClassesCancelled } from "@/src/lib/match-notifications";

/** Profesor como lo muestra el panel: sus datos de jugador y si está activo. */
export type TeacherAdminItem = {
  id: number;
  playerId: number;
  names: string;
  lastnames: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
};

const TEACHER_RELATIONS = { player: { account: true } } as const;
const NOT_FOUND_ERROR = "El profesor no existe.";

function toAdminItem(teacher: Teacher): TeacherAdminItem {
  return {
    id: teacher.id,
    playerId: teacher.player.id,
    names: teacher.player.names,
    lastnames: teacher.player.lastnames,
    email: teacher.player.account.email,
    phoneNumber: teacher.player.phoneNumber,
    isActive: teacher.isActive,
  };
}

/** Errores de permisos: se muestran tal cual. */
function authErrorMessage(error: unknown): string | null {
  return error instanceof ForbiddenError || error instanceof UnauthorizedError ? error.message : null;
}

async function findTeacher(id: number): Promise<Teacher | null> {
  const dataSource = await getDataSource();
  return dataSource.getRepository<Teacher>("Teacher").findOne({ where: { id }, relations: TEACHER_RELATIONS });
}

/** Lista los profesores, activos o no. Cualquier administrador. */
export async function getTeachersAdmin(): Promise<ActionResult<TeacherAdminItem[]>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const teachers = await dataSource
      .getRepository<Teacher>("Teacher")
      .find({ relations: TEACHER_RELATIONS, order: { id: "ASC" } });
    return { success: true, data: teachers.map(toAdminItem) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("getTeachersAdmin", error);
    return { success: false, error: "No se pudieron obtener los profesores." };
  }
}

/**
 * Alta de un profesor nuevo: crea el jugador con su cuenta (con las mismas
 * validaciones que el registro) y le da el rol de profesor, en una sola
 * transacción. Cualquier administrador.
 */
export async function createTeacher(formData: FormData): Promise<ActionResult<TeacherAdminItem>> {
  try {
    await requireAdmin();
    const parsed = parseRegisterForm(formData);
    if (parsed.errors || !parsed.data) {
      const [firstError] = Object.values(parsed.errors ?? {});
      return { success: false, error: firstError ?? "Revisá los datos del profesor." };
    }
    const { names, lastnames, email, password, phoneNumber } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const dataSource = await getDataSource();
    const saved = await dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository<Account>("Account");
      const players = manager.getRepository<Player>("Player");
      const teachers = manager.getRepository<Teacher>("Teacher");

      const account = await accounts.save(accounts.create({ email, passwordHash }));
      const player = await players.save(
        players.create({
          account,
          names,
          lastnames,
          phoneNumber,
          category: PlayerCategory.WITHOUT_CATEGORY,
          scoring: 0,
        }),
      );
      return teachers.save(teachers.create({ player, isActive: true }));
    });

    const created = await findTeacher(saved.id);
    return { success: true, data: toAdminItem(created!) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    if (isUniqueViolation(error)) {
      return { success: false, error: duplicateAccountMessage(error) };
    }
    console.error("createTeacher", error);
    return { success: false, error: "No se pudo crear el profesor." };
  }
}

/** Le da el rol de profesor a un jugador que ya existe (sigue siendo jugador). Cualquier administrador. */
export async function assignTeacherRole(playerId: number): Promise<ActionResult<TeacherAdminItem>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const player = await dataSource.getRepository<Player>("Player").findOne({ where: { id: playerId } });
    if (!player) {
      return { success: false, error: "El jugador no existe." };
    }

    const teachers = dataSource.getRepository<Teacher>("Teacher");
    const saved = await teachers.save(teachers.create({ player, isActive: true }));
    const created = await findTeacher(saved.id);
    return { success: true, data: toAdminItem(created!) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    if (isUniqueViolation(error)) {
      return { success: false, error: "Ese jugador ya es profesor." };
    }
    console.error("assignTeacherRole", error);
    return { success: false, error: "No se pudo asignar el rol de profesor." };
  }
}

/** Cancela las clases futuras del profesor y avisa a sus alumnos (sin penalizar a nadie). */
async function cancelClassesOf(teacher: Teacher) {
  const cancelledIds = await cancelFutureClassesOf(teacher.player.id);
  if (cancelledIds.length > 0) {
    await notifyClassesCancelled(cancelledIds);
  }
}

/**
 * Desactiva (o vuelve a activar) a un profesor: desactivado no accede a sus
 * secciones y se cancelan sus clases futuras. Cualquier administrador.
 */
export async function setTeacherActive(id: number, isActive: boolean): Promise<ActionResult<TeacherAdminItem>> {
  try {
    await requireAdmin();
    const teacher = await findTeacher(id);
    if (!teacher) {
      return { success: false, error: NOT_FOUND_ERROR };
    }

    const dataSource = await getDataSource();
    await dataSource.getRepository<Teacher>("Teacher").update(id, { isActive });
    if (!isActive) {
      await cancelClassesOf(teacher);
    }
    return { success: true, data: toAdminItem({ ...teacher, isActive }) };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("setTeacherActive", error);
    return { success: false, error: "No se pudo actualizar el profesor." };
  }
}

/** Le quita el rol de profesor (sigue siendo jugador) y cancela sus clases futuras. Cualquier administrador. */
export async function removeTeacherRole(id: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const teacher = await findTeacher(id);
    if (!teacher) {
      return { success: false, error: NOT_FOUND_ERROR };
    }
    const dataSource = await getDataSource();
    await dataSource.getRepository<Teacher>("Teacher").delete(id);
    await cancelClassesOf(teacher);
    return { success: true, data: null };
  } catch (error) {
    const authError = authErrorMessage(error);
    if (authError) return { success: false, error: authError };
    console.error("removeTeacherRole", error);
    return { success: false, error: "No se pudo quitar el rol de profesor." };
  }
}
