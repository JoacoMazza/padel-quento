// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { WhatsAppButton, whatsAppContactUrl } from "@/app/components/whatsapp-button";

describe("whatsAppContactUrl", () => {
  it("arma el link de wa.me con el número", () => {
    expect(whatsAppContactUrl("5492215380806")).toBe("https://wa.me/5492215380806");
  });

  it("deja solo los dígitos del número, como lo espera wa.me", () => {
    expect(whatsAppContactUrl("+54 9 221 538-0806")).toBe("https://wa.me/5492215380806");
  });

  it("agrega el mensaje inicial codificado", () => {
    expect(whatsAppContactUrl("5492215380806", "Hola, quiero reservar una cancha & consultar")).toBe(
      "https://wa.me/5492215380806?text=Hola%2C%20quiero%20reservar%20una%20cancha%20%26%20consultar",
    );
  });

  it("sin mensaje (o vacío) no agrega el parámetro text", () => {
    expect(whatsAppContactUrl("5492215380806", "  ")).toBe("https://wa.me/5492215380806");
  });

  it("sin número no hay link", () => {
    expect(whatsAppContactUrl(undefined)).toBeNull();
    expect(whatsAppContactUrl("")).toBeNull();
    expect(whatsAppContactUrl("sin número")).toBeNull();
  });
});

describe("WhatsAppButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  function renderWith(number: string | undefined, message?: string) {
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_CONTACT_NUMBER", number);
    vi.stubEnv("NEXT_PUBLIC_WHATSAPP_CONTACT_MESSAGE", message);
    return render(<WhatsAppButton />);
  }

  it("abre WhatsApp con el número y el mensaje de las variables de entorno, en una pestaña nueva", () => {
    renderWith("5492215380806", "Hola Quento");

    const link = screen.getByRole("link", { name: "Contactar por WhatsApp" });
    expect(link.getAttribute("href")).toBe("https://wa.me/5492215380806?text=Hola%20Quento");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("queda fijo en la esquina inferior derecha, debajo de los modales y del header", () => {
    renderWith("5492215380806");

    const classes = screen.getByRole("link", { name: "Contactar por WhatsApp" }).className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["fixed", "right-4", "bottom-4", "z-30"]));
  });

  it("mide al menos 44 px para tocarlo sin errar", () => {
    renderWith("5492215380806");

    const classes = screen.getByRole("link", { name: "Contactar por WhatsApp" }).className.split(" ");
    expect(classes).toEqual(expect.arrayContaining(["h-14", "w-14"]));
  });

  it("se puede enfocar con el teclado y muestra el foco", () => {
    renderWith("5492215380806");

    const link = screen.getByRole("link", { name: "Contactar por WhatsApp" });
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(link.className).toContain("focus-visible:ring-2");
  });

  it("no se muestra si no está configurado el número", () => {
    const { container } = renderWith(undefined, "Hola");

    expect(container.innerHTML).toBe("");
  });
});
