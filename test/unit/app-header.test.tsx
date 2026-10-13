// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-next-link="" {...props}>
      {children}
    </a>
  ),
}));

import { AppHeader } from "@/app/components/app-header";
import { Role } from "@/src/domain/enums";

describe("AppHeader", () => {
  afterEach(() => {
    cleanup();
  });

  it("mantiene los links principales y suma el de partidos abiertos", () => {
    render(<AppHeader active="/" />);

    const links = screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]);
    expect(links).toEqual(
      expect.arrayContaining([
        ["Inicio", "/"],
        ["Turnos", "/bookings"],
        ["Partidos abiertos", "/open-matches"],
        ["Mis reservas", "/my-bookings"],
      ]),
    );
  });

  it("marca como página actual el link activo", () => {
    render(<AppHeader active="/open-matches" />);

    expect(screen.getByRole("link", { name: "Partidos abiertos" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Turnos" }).getAttribute("aria-current")).toBeNull();
  });

  it("muestra solo el nombre del club, sin la localidad", () => {
    render(<AppHeader active="/" />);

    expect(screen.getByText("Quento Club")).toBeTruthy();
    expect(screen.queryByText(/Villa Elisa/)).toBeNull();
  });

  it("distribuye logo, navegación y menú de usuario en tres columnas", () => {
    render(<AppHeader active="/" />);

    const nav = screen.getByRole("navigation");
    const row = nav.parentElement!;
    expect(row.className).toContain("grid-cols-[1fr_minmax(0,auto)_1fr]");
    expect([...row.children].indexOf(nav)).toBe(1);
    expect(row.children).toHaveLength(3);
  });

  it("en el panel de administración pega el logo y el perfil a los bordes, con el margen del aside", () => {
    const { container } = render(<AppHeader active="/admin" showNav={false} />);

    const row = container.querySelector("header > div")!;
    expect(row.className).not.toContain("max-w-7xl");
    expect(row.className.split(" ")).toContain("px-6");
  });

  it("fuera del panel de administración centra el contenido en el ancho máximo", () => {
    const { container } = render(<AppHeader active="/" />);

    expect(container.querySelector("header > div")!.className).toContain("max-w-7xl");
  });

  it("el logo lleva al inicio", () => {
    render(<AppHeader active="/bookings" userRole={Role.PLAYER} />);

    const logo = screen.getByRole("link", { name: "Ir al inicio" });
    expect(logo.getAttribute("href")).toBe("/");
    expect(logo.textContent).toContain("Quento Club");
  });

  it("en el panel de administración el logo vuelve al panel desde el principio (Turnera Global)", () => {
    render(<AppHeader active="/admin" userRole={Role.ADMIN} showNav={false} />);

    const logo = screen.getByRole("link", { name: "Ir al inicio" });
    expect(logo.getAttribute("href")).toBe("/admin");
    // Link común y no next/link: una navegación del cliente a la misma ruta conservaría la sección abierta.
    expect(logo.hasAttribute("data-next-link")).toBe(false);
  });

  it("oculta la navegación en el panel de administración", () => {
    render(<AppHeader active="/admin" showNav={false} />);

    expect(screen.queryByRole("link", { name: "Turnos" })).toBeNull();
  });
});
