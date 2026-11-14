// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { AuthShell } from "@/app/components/auth-shell";

describe("AuthShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("el logo de iniciar sesión y registrarse lleva a la raíz", () => {
    render(
      <AuthShell title="Iniciar sesión" subtitle="Bienvenido">
        <form />
      </AuthShell>,
    );

    const logos = screen.getAllByRole("link", { name: "Ir al inicio" });
    // El logo de la tarjeta y la marca del panel lateral.
    expect(logos).toHaveLength(2);
    for (const logo of logos) {
      expect(logo.getAttribute("href")).toBe("/");
    }
  });

  it("en mobile deja lugar abajo para que el botón de WhatsApp no tape el formulario", () => {
    render(
      <AuthShell title="Iniciar sesión" subtitle="Bienvenido">
        <form aria-label="login" />
      </AuthShell>,
    );

    const content = screen.getByRole("form", { name: "login" }).closest(".card")!.parentElement!;
    expect(content.className.split(" ")).toEqual(expect.arrayContaining(["pb-24", "sm:pb-12"]));
  });
});
