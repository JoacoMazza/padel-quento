// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { getComplexContacts, updateComplexContact } = vi.hoisted(() => ({
  getComplexContacts: vi.fn(),
  updateComplexContact: vi.fn(),
}));
vi.mock("@/src/actions/complex", () => ({ getComplexContacts, updateComplexContact }));

import { ComplexContactPanel } from "@/app/admin/complex-contact-panel";

const contact = {
  id: 1,
  name: "Quento Club",
  whatsappNumber: "5492216049987",
  whatsappMessage: "Hola, quiero hacer una consulta sobre Quento Club.",
};

describe("ComplexContactPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getComplexContacts.mockResolvedValue({ success: true, data: [contact] });
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra el número y el mensaje cargados de cada complejo", async () => {
    render(<ComplexContactPanel />);

    expect(await screen.findByText("Quento Club")).toBeTruthy();
    expect((screen.getByLabelText("Número de WhatsApp") as HTMLInputElement).value).toBe("+5492216049987");
    expect((screen.getByLabelText("Mensaje inicial") as HTMLTextAreaElement).value).toBe(contact.whatsappMessage);
  });

  it("guarda el número y el mensaje editados y avisa", async () => {
    updateComplexContact.mockResolvedValue({
      success: true,
      data: { ...contact, whatsappNumber: "5492215550000", whatsappMessage: "Hola" },
    });
    render(<ComplexContactPanel />);
    await screen.findByText("Quento Club");

    fireEvent.change(screen.getByLabelText("Número de WhatsApp"), { target: { value: "+54 9 221 555-0000" } });
    fireEvent.change(screen.getByLabelText("Mensaje inicial"), { target: { value: "Hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updateComplexContact).toHaveBeenCalledWith(1, { whatsappNumber: "+54 9 221 555-0000", whatsappMessage: "Hola" }),
    );
    expect(await screen.findByText("WhatsApp de contacto guardado.")).toBeTruthy();
    expect((screen.getByLabelText("Número de WhatsApp") as HTMLInputElement).value).toBe("+5492215550000");
  });

  it("muestra el error si no se pudo guardar", async () => {
    updateComplexContact.mockResolvedValue({ success: false, error: "El número de WhatsApp tiene que tener entre 10 y 15 dígitos." });
    render(<ComplexContactPanel />);
    await screen.findByText("Quento Club");

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El número de WhatsApp tiene que tener entre 10 y 15 dígitos.")).toBeTruthy();
  });

  it("explica que sin número el botón de WhatsApp no se muestra", async () => {
    getComplexContacts.mockResolvedValue({ success: true, data: [{ ...contact, whatsappNumber: null }] });
    render(<ComplexContactPanel />);

    expect((await screen.findByLabelText("Número de WhatsApp") as HTMLInputElement).value).toBe("");
    expect(screen.getByText(/Sin número, el botón de WhatsApp no se muestra/)).toBeTruthy();
  });
});
