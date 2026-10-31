import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessLevel, Role } from "@/src/domain/enums";
import type { Teacher } from "@/src/entities/Teacher";
import { getDataSource } from "@/src/lib/db";
import { createPlayer } from "@/src/actions/player";
import {
  assignTeacherRole,
  createTeacher,
  getTeachersAdmin,
  removeTeacherRole,
  setTeacherActive,
} from "@/src/actions/teacher";
import { ForbiddenError, requireTeacher } from "@/src/lib/rbac";
import { createTestAdmin, uniquePhoneNumber } from "./helpers";

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";

let seq = 0;
function uniqueEmail(prefix: string) {
  seq += 1;
  return `${prefix}.${Date.now()}.${seq}@test.com`;
}

function teacherForm(overrides: Record<string, string> = {}) {
  const values = {
    names: "Lucía",
    lastnames: "Profe",
    email: uniqueEmail("profe"),
    password: "secreto123",
    phoneNumber: uniquePhoneNumber(),
    ...overrides,
  };
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return { form, values };
}

async function newPlayer(names = "Juan") {
  const created = await createPlayer({
    names,
    lastnames: "Jugador",
    email: uniqueEmail("jugador"),
    password: "secreto123",
    phoneNumber: uniquePhoneNumber(),
  });
  if (!created.success) throw new Error(created.error);
  return { id: created.data.id, email: created.data.account.email };
}

describe("profesores (HU-42, integración con Postgres real)", () => {
  let staffEmail: string;

  function signInAs(email: string, role: Role) {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email, role } } as never);
  }

  beforeAll(async () => {
    // Cualquier administrador gestiona profesores, también un trabajador.
    staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
  });

  beforeEach(() => {
    signInAs(staffEmail, Role.ADMIN);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("createTeacher", () => {
    it("da de alta un profesor nuevo: un jugador con su cuenta y el rol de profesor activo", async () => {
      const { form, values } = teacherForm();

      const result = await createTeacher(form);

      expect(result).toEqual({
        success: true,
        data: {
          id: expect.any(Number),
          playerId: expect.any(Number),
          names: "Lucía",
          lastnames: "Profe",
          email: values.email,
          phoneNumber: values.phoneNumber,
          isActive: true,
        },
      });
    });

    it("valida los datos como en el registro", async () => {
      const { form } = teacherForm({ email: "no-es-un-email", password: "123" });

      const result = await createTeacher(form);

      expect(result).toEqual({ success: false, error: "Ingresá un email con formato válido." });
    });

    it("no permite repetir el email de otra cuenta", async () => {
      const player = await newPlayer();
      const { form } = teacherForm({ email: player.email });

      expect(await createTeacher(form)).toEqual({ success: false, error: "El correo ya está en uso." });
    });
  });

  describe("assignTeacherRole", () => {
    it("le da el rol de profesor a un jugador que ya existe, que sigue siendo jugador", async () => {
      const player = await newPlayer("Martina");

      const result = await assignTeacherRole(player.id);

      expect(result).toMatchObject({ success: true, data: { playerId: player.id, names: "Martina", isActive: true } });
    });

    it("no se lo da dos veces al mismo jugador", async () => {
      const player = await newPlayer();
      await assignTeacherRole(player.id);

      expect(await assignTeacherRole(player.id)).toEqual({ success: false, error: "Ese jugador ya es profesor." });
    });

    it("devuelve error si el jugador no existe", async () => {
      expect(await assignTeacherRole(999_999)).toEqual({ success: false, error: "El jugador no existe." });
    });
  });

  describe("desactivar, reactivar y quitar el rol", () => {
    it("desactiva y vuelve a activar a un profesor", async () => {
      const player = await newPlayer();
      const assigned = await assignTeacherRole(player.id);
      if (!assigned.success) throw new Error(assigned.error);

      expect(await setTeacherActive(assigned.data.id, false)).toMatchObject({ success: true, data: { isActive: false } });
      expect(await setTeacherActive(assigned.data.id, true)).toMatchObject({ success: true, data: { isActive: true } });
    });

    it("quitarle el rol lo saca del listado de profesores, pero el jugador sigue existiendo", async () => {
      const player = await newPlayer();
      const assigned = await assignTeacherRole(player.id);
      if (!assigned.success) throw new Error(assigned.error);

      expect(await removeTeacherRole(assigned.data.id)).toEqual({ success: true, data: null });

      const list = await getTeachersAdmin();
      if (!list.success) throw new Error(list.error);
      expect(list.data.some((t) => t.id === assigned.data.id)).toBe(false);
      // Puede volver a ser profesor.
      expect(await assignTeacherRole(player.id)).toMatchObject({ success: true });
    });

    it("devuelve error si el profesor no existe", async () => {
      expect(await setTeacherActive(999_999, false)).toEqual({ success: false, error: "El profesor no existe." });
      expect(await removeTeacherRole(999_999)).toEqual({ success: false, error: "El profesor no existe." });
    });
  });

  describe("getTeachersAdmin", () => {
    it("lista los profesores con sus datos de contacto y si están activos", async () => {
      const player = await newPlayer("Sofía");
      const assigned = await assignTeacherRole(player.id);
      if (!assigned.success) throw new Error(assigned.error);
      await setTeacherActive(assigned.data.id, false);

      const result = await getTeachersAdmin();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((t) => t.id === assigned.data.id)).toMatchObject({
        playerId: player.id,
        names: "Sofía",
        email: player.email,
        isActive: false,
      });
    });
  });

  describe("permisos", () => {
    it("un jugador no puede gestionar profesores", async () => {
      const player = await newPlayer();
      signInAs(player.email, Role.PLAYER);
      const denied = { success: false, error: "Acceso denegado: Se requieren permisos de Administrador" };

      expect(await getTeachersAdmin()).toEqual(denied);
      expect(await createTeacher(teacherForm().form)).toEqual(denied);
      expect(await assignTeacherRole(player.id)).toEqual(denied);
    });
  });

  describe("requireTeacher", () => {
    it("deja pasar a un profesor activo y devuelve su jugador", async () => {
      const player = await newPlayer();
      const assigned = await assignTeacherRole(player.id);
      if (!assigned.success) throw new Error(assigned.error);
      signInAs(player.email, Role.PLAYER);

      expect(await requireTeacher()).toMatchObject({ teacherId: assigned.data.id, playerId: player.id });
    });

    it("rechaza a un profesor desactivado, a un jugador sin el rol y a un administrador", async () => {
      const deactivated = await newPlayer();
      const assigned = await assignTeacherRole(deactivated.id);
      if (!assigned.success) throw new Error(assigned.error);
      await setTeacherActive(assigned.data.id, false);
      const plain = await newPlayer();

      for (const [email, role] of [
        [deactivated.email, Role.PLAYER],
        [plain.email, Role.PLAYER],
        [staffEmail, Role.ADMIN],
      ] as const) {
        signInAs(email, role);
        await expect(requireTeacher()).rejects.toThrow(new ForbiddenError("Acceso denegado: Se requiere el rol de Profesor"));
      }
    });

    it("una desactivación aplica en el momento, sin volver a iniciar sesión", async () => {
      const player = await newPlayer();
      const assigned = await assignTeacherRole(player.id);
      if (!assigned.success) throw new Error(assigned.error);

      const dataSource = await getDataSource();
      await dataSource.getRepository<Teacher>("Teacher").update(assigned.data.id, { isActive: false });
      signInAs(player.email, Role.PLAYER);

      await expect(requireTeacher()).rejects.toBeInstanceOf(ForbiddenError);
    });
  });
});
