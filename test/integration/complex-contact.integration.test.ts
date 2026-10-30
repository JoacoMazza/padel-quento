import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessLevel, Role } from "@/src/domain/enums";
import type { Complex } from "@/src/entities/Complex";
import { getDataSource } from "@/src/lib/db";
import { getComplexContacts, getWhatsAppContact, updateComplexContact } from "@/src/actions/complex";
import { createTestAdmin, ensureTestComplex } from "./helpers";

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";

describe("WhatsApp de contacto del complejo (integración con Postgres real)", () => {
  let complex: Complex;
  let staffEmail: string;

  function signInAs(email: string, role = Role.ADMIN) {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email, role } } as never);
  }

  async function setContact(whatsappNumber: string | null, whatsappMessage: string | null) {
    const dataSource = await getDataSource();
    await dataSource.getRepository<Complex>("Complex").update(complex.id, { whatsappNumber, whatsappMessage });
  }

  beforeAll(async () => {
    complex = await ensureTestComplex();
    // Cualquier administrador puede cargarlo, también un trabajador.
    staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
  });

  beforeEach(() => {
    signInAs(staffEmail);
  });

  afterAll(async () => {
    await setContact(null, null);
  });

  describe("getWhatsAppContact", () => {
    it("devuelve el link de wa.me y el número a mostrar del complejo del club, sin pedir sesión", async () => {
      await setContact("+54 9 221 604-9987", "Hola Quento");
      vi.mocked(getServerSession).mockResolvedValue(null);

      expect(await getWhatsAppContact()).toEqual({
        success: true,
        data: { url: "https://wa.me/5492216049987?text=Hola%20Quento", number: "+54 9 221 604-9987" },
      });
    });

    it("sin número cargado no hay link", async () => {
      await setContact(null, "Hola Quento");

      expect(await getWhatsAppContact()).toEqual({ success: true, data: null });
    });
  });

  describe("updateComplexContact", () => {
    it("guarda el número como se escribió, para mostrarlo así, y el mensaje sin espacios de más", async () => {
      const result = await updateComplexContact(complex.id, {
        whatsappNumber: "  +54 9 221   604-9987 ",
        whatsappMessage: "  Hola, quiero hacer una consulta.  ",
      });

      expect(result).toEqual({
        success: true,
        data: {
          id: complex.id,
          name: complex.name,
          whatsappNumber: "+54 9 221 604-9987",
          whatsappMessage: "Hola, quiero hacer una consulta.",
        },
      });
      expect(await getWhatsAppContact()).toEqual({
        success: true,
        data: {
          url: "https://wa.me/5492216049987?text=Hola%2C%20quiero%20hacer%20una%20consulta.",
          number: "+54 9 221 604-9987",
        },
      });
    });

    it("rechaza un número con letras u otros caracteres que no van en un teléfono", async () => {
      expect(await updateComplexContact(complex.id, { whatsappNumber: "+54 9 221 604-9987 int 2", whatsappMessage: "" })).toEqual({
        success: false,
        error: "El número de WhatsApp solo puede tener dígitos, espacios, guiones, paréntesis y el + del código de país.",
      });
    });

    it("con el número vacío lo borra (y el botón deja de mostrarse)", async () => {
      await setContact("+54 9 221 604-9987", null);

      const result = await updateComplexContact(complex.id, { whatsappNumber: " ", whatsappMessage: "" });

      expect(result).toMatchObject({ success: true, data: { whatsappNumber: null, whatsappMessage: null } });
      expect(await getWhatsAppContact()).toEqual({ success: true, data: null });
    });

    it("rechaza un número con menos de 10 o más de 15 dígitos y no lo guarda", async () => {
      await setContact("+54 9 221 604-9987", null);

      for (const whatsappNumber of ["221 604-998", "+54 9 221 604-9987 123"]) {
        expect(await updateComplexContact(complex.id, { whatsappNumber, whatsappMessage: "" })).toEqual({
          success: false,
          error: "El número de WhatsApp tiene que tener entre 10 y 15 dígitos, con el código de país (por ejemplo +54 9 221 604-9987).",
        });
      }
      expect(await getWhatsAppContact()).toEqual({
        success: true,
        data: { url: "https://wa.me/5492216049987", number: "+54 9 221 604-9987" },
      });
    });

    it("rechaza un mensaje de más de 500 caracteres", async () => {
      expect(
        await updateComplexContact(complex.id, { whatsappNumber: "5492216049987", whatsappMessage: "a".repeat(501) }),
      ).toEqual({ success: false, error: "El mensaje inicial puede tener hasta 500 caracteres." });
    });

    it("devuelve error si el complejo no existe", async () => {
      expect(await updateComplexContact(999_999, { whatsappNumber: "5492216049987", whatsappMessage: "" })).toEqual({
        success: false,
        error: "El complejo no existe.",
      });
    });

    it("un jugador no lo puede cambiar", async () => {
      signInAs("jugador@test.com", Role.PLAYER);

      const result = await updateComplexContact(complex.id, { whatsappNumber: "5491100000000", whatsappMessage: "" });

      expect(result).toEqual({ success: false, error: "Acceso denegado: Se requieren permisos de Administrador" });
    });
  });

  describe("getComplexContacts", () => {
    it("lista los complejos con su número y mensaje", async () => {
      await setContact("+54 9 221 604-9987", "Hola Quento");

      const result = await getComplexContacts();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((c) => c.id === complex.id)).toEqual({
        id: complex.id,
        name: complex.name,
        whatsappNumber: "+54 9 221 604-9987",
        whatsappMessage: "Hola Quento",
      });
    });

    it("un jugador no los puede ver", async () => {
      signInAs("jugador@test.com", Role.PLAYER);

      expect(await getComplexContacts()).toEqual({
        success: false,
        error: "Acceso denegado: Se requieren permisos de Administrador",
      });
    });
  });
});
