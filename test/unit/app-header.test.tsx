// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AppHeader } from "@/app/components/app-header";

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

  it("oculta la navegación en el panel de administración", () => {
    render(<AppHeader active="/admin" showNav={false} />);

    expect(screen.queryByRole("link", { name: "Turnos" })).toBeNull();
  });
});
