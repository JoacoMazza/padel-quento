// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PasswordInput } from "@/app/components/ui/password-input";

describe("PasswordInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("oculta la contraseña por defecto y permite mostrarla y volver a ocultarla", () => {
    render(
      <>
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" name="password" />
      </>,
    );

    const input = screen.getByLabelText("Contraseña") as HTMLInputElement;
    expect(input.type).toBe("password");

    fireEvent.click(screen.getByRole("button", { name: "Mostrar contraseña" }));
    expect(input.type).toBe("text");

    fireEvent.click(screen.getByRole("button", { name: "Ocultar contraseña" }));
    expect(input.type).toBe("password");
  });

  it("el botón no envía el formulario", () => {
    render(<PasswordInput id="password" name="password" />);

    expect(screen.getByRole("button", { name: "Mostrar contraseña" }).getAttribute("type")).toBe("button");
  });
});
