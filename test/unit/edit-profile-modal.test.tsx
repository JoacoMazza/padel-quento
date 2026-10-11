// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/src/actions/profile", () => ({ updatePlayerProfile: vi.fn() }));

import { EditProfileModal } from "@/app/profile/edit-profile-modal";

const initialData = { names: "Juan", lastnames: "Pérez", category: "FOURTH" };

describe("EditProfileModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("la información personal se abre en un modal al tocar Editar perfil", () => {
    render(<EditProfileModal initialData={initialData} />);

    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));

    const dialog = screen.getByRole("dialog", { name: "Información personal" });
    expect(dialog).toBeTruthy();
    expect((screen.getByLabelText("Nombre") as HTMLInputElement).value).toBe("Juan");
    expect(screen.queryByLabelText(/foto de perfil/i)).toBeNull();
    expect(dialog.querySelector("img")).toBeNull();
  });

  it("se cierra con el botón de cerrar", () => {
    render(<EditProfileModal initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("se cierra con la tecla Escape", () => {
    render(<EditProfileModal initialData={initialData} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar perfil" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
