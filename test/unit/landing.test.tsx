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
    it("muestra el club y lo invita a ver los turnos, iniciar sesión o registrarse", () => {
      renderLanding();

      expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Quento Club");
      const hero = screen.getByRole("region", { name: "Bienvenida" });
      expect(within(hero).getByRole("link", { name: "Ver turnos disponibles" }).getAttribute("href")).toBe("/bookings");
      expect(within(hero).getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
      expect(within(hero).getByRole("link", { name: "Registrarse" }).getAttribute("href")).toBe("/register");
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

    it("cuenta qué se puede hacer en la plataforma", () => {
      renderLanding();

      const features = screen.getByRole("region", { name: "Qué podés hacer" });
      for (const title of ["Reservá online", "Partidos abiertos", "Chat del partido", "Sumá puntos"]) {
        expect(within(features).getByRole("heading", { name: title })).toBeTruthy();
      }
    });
  });

  describe("jugador con sesión", () => {
    it("lo saluda y le muestra sus accesos en lugar de iniciar sesión o registrarse", () => {
      renderLanding("Ana");

      const hero = screen.getByRole("region", { name: "Bienvenida" });
      expect(within(hero).getByText(/Bienvenido, Ana/)).toBeTruthy();
      expect(within(hero).queryByRole("link", { name: "Iniciar sesión" })).toBeNull();
      expect(within(hero).queryByRole("link", { name: "Registrarse" })).toBeNull();

      const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
      expect(links).toEqual(expect.arrayContaining(["/bookings", "/open-matches", "/my-bookings", "/profile"]));
    });
  });

  it("si no hay horarios cargados no muestra la tabla vacía", () => {
    render(<Landing userName={null} isGuest courtCount={8} hours={[]} />);

    expect(screen.getByText("Consultá los horarios por WhatsApp.")).toBeTruthy();
  });
});
