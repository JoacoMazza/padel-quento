// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

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

  it("a un profesor le suma el link a sus clases (HU-42)", () => {
    render(<AppHeader active="/teacher" userRole={Role.PLAYER} isTeacher />);

    const link = screen.getAllByRole("link", { name: "Mis clases" })[0];
    expect(link.getAttribute("href")).toBe("/teacher");
    expect(link.getAttribute("aria-current")).toBe("page");
  });

  it("a un jugador que no es profesor no le muestra el link a las clases", () => {
    render(<AppHeader active="/" userRole={Role.PLAYER} />);

    expect(screen.queryByRole("link", { name: "Mis clases" })).toBeNull();
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

  describe("menú de navegación en pantallas chicas", () => {
    it("oculta la navegación en línea en pantallas chicas y la muestra desde lg", () => {
      render(<AppHeader active="/" />);

      const nav = screen.getByRole("navigation");
      expect(nav.className.split(" ")).toEqual(expect.arrayContaining(["hidden", "lg:flex"]));
    });

    it("ofrece un botón para abrir el menú, que solo se ve en pantallas chicas", () => {
      render(<AppHeader active="/" />);

      const toggle = screen.getByRole("button", { name: "Abrir menú" });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.className.split(" ")).toContain("lg:hidden");
    });

    it("al abrirlo muestra los links principales, con el actual marcado", () => {
      render(<AppHeader active="/bookings" />);

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

      const menu = screen.getByRole("navigation", { name: "Menú principal" });
      const links = within(menu).getAllByRole("link");
      expect(links.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
        ["Inicio", "/"],
        ["Turnos", "/bookings"],
        ["Partidos abiertos", "/open-matches"],
        ["Mis reservas", "/my-bookings"],
      ]);
      expect(within(menu).getByRole("link", { name: "Turnos" }).getAttribute("aria-current")).toBe("page");
      expect(screen.getByRole("button", { name: "Cerrar menú" }).getAttribute("aria-expanded")).toBe("true");
    });

    it("se cierra al tocar fuera del menú", () => {
      render(<AppHeader active="/" />);

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
      fireEvent.pointerDown(document.body);

      expect(screen.queryByRole("navigation", { name: "Menú principal" })).toBeNull();
      expect(screen.getByRole("button", { name: "Abrir menú" }).getAttribute("aria-expanded")).toBe("false");
    });

    it("tocar dentro del menú no lo cierra", () => {
      render(<AppHeader active="/" />);

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
      fireEvent.pointerDown(screen.getByRole("navigation", { name: "Menú principal" }));

      expect(screen.getByRole("navigation", { name: "Menú principal" })).toBeTruthy();
    });

    it("el menú se despliega de arriba hacia abajo", () => {
      render(<AppHeader active="/" />);

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

      const menu = screen.getByRole("navigation", { name: "Menú principal" });
      expect(menu.className.split(" ")).toContain("motion-safe:animate-slide-down");
    });

    it("se cierra al elegir un link o al volver a tocar el botón", () => {
      render(<AppHeader active="/" />);

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
      fireEvent.click(within(screen.getByRole("navigation", { name: "Menú principal" })).getByRole("link", { name: "Turnos" }));
      expect(screen.queryByRole("navigation", { name: "Menú principal" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
      fireEvent.click(screen.getByRole("button", { name: "Cerrar menú" }));
      expect(screen.queryByRole("navigation", { name: "Menú principal" })).toBeNull();
    });

    it("para un visitante solo lista las secciones que se pueden ver sin sesión", () => {
      render(<AppHeader active="/" guest />);

      fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

      const menu = screen.getByRole("navigation", { name: "Menú principal" });
      expect(within(menu).queryByRole("link", { name: "Mis reservas" })).toBeNull();
      expect(within(menu).getByRole("link", { name: "Turnos" })).toBeTruthy();
    });

    it("no se muestra en el panel de administración", () => {
      render(<AppHeader active="/admin" showNav={false} />);

      expect(screen.queryByRole("button", { name: "Abrir menú" })).toBeNull();
    });
  });

  describe("visitante sin sesión", () => {
    it("ofrece iniciar sesión y registrarse en lugar del menú de usuario", () => {
      const { container } = render(<AppHeader active="/" guest />);

      expect(screen.getByRole("link", { name: "Iniciar sesión" }).getAttribute("href")).toBe("/login");
      expect(screen.getByRole("link", { name: "Registrarse" }).getAttribute("href")).toBe("/register");
      expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
    });

    it("no muestra el link a Mis reservas, pero sí los que se pueden ver sin sesión", () => {
      render(<AppHeader active="/bookings" guest />);

      expect(screen.queryByRole("link", { name: "Mis reservas" })).toBeNull();
      expect(screen.getByRole("link", { name: "Turnos" }).getAttribute("href")).toBe("/bookings");
      expect(screen.getByRole("link", { name: "Partidos abiertos" }).getAttribute("href")).toBe("/open-matches");
    });
  });
});
