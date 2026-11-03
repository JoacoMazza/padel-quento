// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

const { getWhatsAppContact } = vi.hoisted(() => ({ getWhatsAppContact: vi.fn() }));
vi.mock("@/src/actions/complex", () => ({ getWhatsAppContact }));

import { WhatsAppButton } from "@/app/components/whatsapp-button";

const URL = "https://wa.me/5492216049987?text=Hola%20Quento";

describe("WhatsAppButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWhatsAppContact.mockResolvedValue({ success: true, data: { url: URL, number: "+54 9 221 604-9987" } });
  });

  afterEach(() => {
    cleanup();
  });

  async function renderButton() {
    render(<WhatsAppButton />);
    return screen.findByRole("link", { name: "Contactar por WhatsApp" });
  }

  it("abre el chat con el número y el mensaje del complejo, en una pestaña nueva", async () => {
    const link = await renderButton();

    expect(link.getAttribute("href")).toBe(URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("queda fijo en la esquina inferior derecha, debajo de los modales y del header", async () => {
    const classes = (await renderButton()).className.split(" ");

    expect(classes).toEqual(expect.arrayContaining(["fixed", "right-4", "bottom-4", "z-30"]));
  });

  it("mide al menos 44 px para tocarlo sin errar", async () => {
    const classes = (await renderButton()).className.split(" ");

    expect(classes).toEqual(expect.arrayContaining(["h-14", "w-14"]));
  });

  it("se puede enfocar con el teclado y muestra el foco", async () => {
    const link = await renderButton();

    link.focus();
    expect(document.activeElement).toBe(link);
    expect(link.className).toContain("focus-visible:ring-2");
  });

  it("no se muestra si el complejo no tiene número cargado", async () => {
    getWhatsAppContact.mockResolvedValue({ success: true, data: null });
    const { container } = render(<WhatsAppButton />);

    await waitFor(() => expect(getWhatsAppContact).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("no se muestra si no se pudo obtener el número", async () => {
    getWhatsAppContact.mockResolvedValue({ success: false, error: "No se pudo obtener el contacto." });
    const { container } = render(<WhatsAppButton />);

    await waitFor(() => expect(getWhatsAppContact).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });
});
