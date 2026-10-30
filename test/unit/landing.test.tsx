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
import { CLUB_MAPS_URL } from "@/app/components/club-info";

const WHATSAPP_URL = "https://wa.me/5492216049987?text=Hola";

const hours = [
  { days: "Lunes a viernes", hours: "08:00 – 23:00" },
  { days: "Sábado y domingo", hours: "09:00 – 20:00" },
];

function renderLanding(userName: string | null = null, whatsappUrl: string | null = WHATSAPP_URL) {
  return render(
    <Landing userName={userName} isGuest={userName === null} courtCount={8} hours={hours} whatsappUrl={whatsappUrl} />,
  );
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
      expect(within(club).getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe(WHATSAPP_URL);
    });

    it("el botón de WhatsApp abre el chat con el número y el mensaje del complejo", () => {
      renderLanding();

      const whatsapp = within(screen.getByRole("region", { name: "El complejo" })).getByRole("link", { name: /WhatsApp/ });
      expect(whatsapp.getAttribute("href")).toBe(WHATSAPP_URL);
    });

    it("sin número de WhatsApp cargado no muestra el botón", () => {
      renderLanding(null, null);

      expect(within(screen.getByRole("region", { name: "El complejo" })).queryByRole("link", { name: /WhatsApp/ })).toBeNull();
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
    render(<Landing userName={null} isGuest courtCount={8} hours={[]} whatsappUrl={WHATSAPP_URL} />);

    expect(screen.getByText("Consultá los horarios por WhatsApp.")).toBeTruthy();
  });
});
