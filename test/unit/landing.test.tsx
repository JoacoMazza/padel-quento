// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { Landing } from "@/app/landing/landing";
import { CLUB_MAPS_URL, CLUB_WHATSAPP_URL } from "@/app/components/club-info";

const hours = [
  { days: "Lunes a viernes", hours: "08:00 – 23:00" },
  { days: "Sábado y domingo", hours: "09:00 – 20:00" },
];

function renderLanding(userName: string | null = null) {
  return render(<Landing userName={userName} isGuest={userName === null} courtCount={8} hours={hours} />);
}

describe("Landing", () => {
  afterEach(() => {
    cleanup();
  });

  describe("visitante sin sesión", () => {
    it("muestra el club y lo invita a ver los turnos", () => {
      renderLanding();

      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Quento Club");
      const hero = screen.getByRole("region", { name: "Bienvenida" });
      expect(within(hero).getByRole("link", { name: "Ver turnos disponibles" }).getAttribute("href")).toBe("/bookings");
    });

    it("no repite los accesos de sesión: Iniciar sesión y Registrarse están en el encabezado", () => {
      renderLanding();

      // Tampoco hay links ocultos a secciones que piden sesión (un lector de pantalla los anunciaría igual).
      for (const name of ["Iniciar sesión", "Registrarse", "Mis reservas", "Mi perfil"]) {
        expect(screen.queryByRole("link", { name })).toBeNull();
      }
    });

    it("informa ubicación con mapa, canchas, horarios y contacto", () => {
      renderLanding();

      const club = screen.getByRole("region", { name: "El complejo" });
      expect(within(club).getByRole("link", { name: /Cómo llegar/ }).getAttribute("href")).toBe(CLUB_MAPS_URL);
      expect(within(club).getByTitle("Mapa del complejo")).toBeTruthy();
      expect(within(club).getByText("8 canchas")).toBeTruthy();
      expect(within(club).getByText("Lunes a viernes")).toBeTruthy();
      expect(within(club).getByText("08:00 – 23:00")).toBeTruthy();
      expect(within(club).getByText("Sábado y domingo")).toBeTruthy();
      expect(within(club).getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe(CLUB_WHATSAPP_URL);
    });

    it("el botón de WhatsApp abre el chat con el número del complejo y lo muestra", () => {
      renderLanding();

      const whatsapp = within(screen.getByRole("region", { name: "El complejo" })).getByRole("link", { name: /WhatsApp/ });
      expect(whatsapp.getAttribute("href")).toBe("https://wa.me/5492215380806");
      expect(whatsapp.textContent).toContain("0221 538-0806");
    });

    it("en el botón de WhatsApp, en mobile el texto va arriba y el número abajo; desde sm, en una línea", () => {
      renderLanding();

      const whatsapp = within(screen.getByRole("region", { name: "El complejo" })).getByRole("link", { name: /WhatsApp/ });
      const text = within(whatsapp).getByText("Escribinos por WhatsApp");
      const number = within(whatsapp).getByText("0221 538-0806");
      // Uno debajo del otro: en la misma columna, el texto primero.
      expect(text.parentElement).toBe(number.parentElement);
      expect(text.parentElement!.className.split(" ")).toEqual(expect.arrayContaining(["flex-col", "sm:flex-row"]));
      expect(text.compareDocumentPosition(number) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(number.className.split(" ")).toContain("whitespace-nowrap");
    });

    it("en mobile el botón de WhatsApp alinea el texto con el ícono a la izquierda y lleva la flecha al final", () => {
      renderLanding();

      const whatsapp = within(screen.getByRole("region", { name: "El complejo" })).getByRole("link", { name: /WhatsApp/ });
      expect(whatsapp.className.split(" ")).toEqual(expect.arrayContaining(["justify-start", "sm:justify-center"]));
      expect(whatsapp.lastElementChild!.getAttribute("class")!.split(" ")).toEqual(
        expect.arrayContaining(["ml-auto", "sm:ml-0.5"]),
      );
    });

    it("cuenta qué se puede hacer en la plataforma", () => {
      renderLanding();

      const features = screen.getByRole("region", { name: "Qué podés hacer" });
      for (const title of ["Reservá online", "Partidos abiertos", "Chat del partido", "Sumá puntos"]) {
        expect(within(features).getByRole("heading", { name: title })).toBeTruthy();
      }
    });
  });

  describe("jugador con sesión", () => {
    it("le muestra la misma landing, con los turnos a un click (sus accesos están en el encabezado)", () => {
      renderLanding("Ana");

      const hero = screen.getByRole("region", { name: "Bienvenida" });
      expect(within(hero).getByRole("link", { name: "Ver turnos disponibles" }).getAttribute("href")).toBe("/bookings");
      expect(screen.queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
    });
  });

  it("si no hay horarios cargados no muestra la tabla vacía", () => {
    render(<Landing userName={null} isGuest courtCount={8} hours={[]} />);

    expect(screen.getByText("Consultá los horarios por WhatsApp.")).toBeTruthy();
  });
});
