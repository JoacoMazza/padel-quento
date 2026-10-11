// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { UserMenu } from "@/app/components/user-menu";

describe("UserMenu", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra al lado de las iniciales el nombre completo y debajo el email", () => {
    render(<UserMenu name="Juan Pérez" email="juan@email.com" role="player" />);

    const button = screen.getByRole("button", { name: /Juan Pérez/ });
    expect(button.textContent).toBe("JPJuan Pérezjuan@email.com");
  });

  it("al tocarlo abre el menú con la opción de cerrar sesión", () => {
    render(<UserMenu name="Juan Pérez" email="juan@email.com" role="player" />);

    fireEvent.click(screen.getByRole("button", { name: /Juan Pérez/ }));

    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
  });
});
