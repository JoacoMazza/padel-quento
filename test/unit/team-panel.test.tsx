// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { createAdmin, updateAdmin, deleteAdmin, getTeam } = vi.hoisted(() => ({
  createAdmin: vi.fn(),
  updateAdmin: vi.fn(),
  deleteAdmin: vi.fn(),
  getTeam: vi.fn(),
}));
vi.mock("@/src/actions/admin", () => ({ createAdmin, updateAdmin, deleteAdmin, getTeam }));

import { AdminAccessLevel } from "@/src/domain/enums";
import type { TeamMember } from "@/src/actions/admin";
import { TeamPanel } from "@/app/admin/team-panel";

const me: TeamMember = {
  id: 1,
  names: "Mario",
  lastnames: "Dueño",
  dni: 30111222,
  email: "mario@quento.com",
  accessLevel: AdminAccessLevel.OWNER,
  isSelf: true,
};
const worker: TeamMember = {
  id: 2,
  names: "Tomás",
  lastnames: "Recepción",
  dni: 35123456,
  email: "tomas@quento.com",
  accessLevel: AdminAccessLevel.STAFF,
  isSelf: false,
};

function row(name: RegExp) {
  return within(screen.getByRole("row", { name }));
}

describe("TeamPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getTeam.mockResolvedValue({ success: true, data: [me, worker] });
  });

  afterEach(() => {
    cleanup();
  });

  it("lista a los administradores con su nivel", () => {
    render(<TeamPanel team={[me, worker]} />);

    expect(row(/Mario Dueño/).getByText("Dueño")).toBeTruthy();
    expect(row(/Mario Dueño/).getByText("mario@quento.com")).toBeTruthy();
    expect(row(/Tomás Recepción/).getByText("Trabajador")).toBeTruthy();
    expect(row(/Tomás Recepción/).getByText("35123456")).toBeTruthy();
  });

  it("al propio dueño no le ofrece editarse ni darse de baja", () => {
    render(<TeamPanel team={[me, worker]} />);

    expect(row(/Mario Dueño/).queryByRole("button")).toBeNull();
    expect(row(/Mario Dueño/).getByText("Vos")).toBeTruthy();
    expect(row(/Tomás Recepción/).getByRole("button", { name: "Editar a Tomás Recepción" })).toBeTruthy();
  });

  it("da de alta un trabajador por defecto y recarga el equipo", async () => {
    createAdmin.mockResolvedValue({ success: true, data: { id: 3 } });
    render(<TeamPanel team={[me, worker]} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar administrador" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Lucía" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Caja" } });
    fireEvent.change(screen.getByLabelText("DNI"), { target: { value: "40111222" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "lucia@quento.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secreto123" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(getTeam).toHaveBeenCalled());
    expect(createAdmin).toHaveBeenCalledWith({
      names: "Lucía",
      lastnames: "Caja",
      dni: 40111222,
      email: "lucia@quento.com",
      password: "secreto123",
      accessLevel: AdminAccessLevel.STAFF,
    });
    expect(screen.queryByRole("heading", { name: "Nuevo administrador" })).toBeNull();
  });

  it("puede dar de alta a otro dueño", async () => {
    createAdmin.mockResolvedValue({ success: true, data: { id: 3 } });
    render(<TeamPanel team={[me]} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar administrador" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Socia" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Dueña" } });
    fireEvent.change(screen.getByLabelText("DNI"), { target: { value: "28111222" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "socia@quento.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secreto123" } });
    fireEvent.change(screen.getByLabelText("Nivel"), { target: { value: AdminAccessLevel.OWNER } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(createAdmin).toHaveBeenCalled());
    expect(createAdmin.mock.calls[0][0].accessLevel).toBe(AdminAccessLevel.OWNER);
  });

  it("muestra el error si no se pudo dar de alta", async () => {
    createAdmin.mockResolvedValue({ success: false, error: "Ya hay un administrador con ese DNI." });
    render(<TeamPanel team={[me]} />);

    fireEvent.click(screen.getByRole("button", { name: "Agregar administrador" }));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "X" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Y" } });
    fireEvent.change(screen.getByLabelText("DNI"), { target: { value: "30111222" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "x@quento.com" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "secreto123" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Ya hay un administrador con ese DNI.")).toBeTruthy();
    expect(getTeam).not.toHaveBeenCalled();
  });

  it("edita a un trabajador y lo pasa a dueño, sin cambiarle la contraseña si se deja vacía", async () => {
    updateAdmin.mockResolvedValue({ success: true, data: { id: 2 } });
    render(<TeamPanel team={[me, worker]} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar a Tomás Recepción" }));
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("tomas@quento.com");
    fireEvent.change(screen.getByLabelText("Nivel"), { target: { value: AdminAccessLevel.OWNER } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(getTeam).toHaveBeenCalled());
    expect(updateAdmin).toHaveBeenCalledWith(2, {
      names: "Tomás",
      lastnames: "Recepción",
      dni: 35123456,
      email: "tomas@quento.com",
      accessLevel: AdminAccessLevel.OWNER,
    });
  });

  it("da de baja a un trabajador después de confirmar", async () => {
    deleteAdmin.mockResolvedValue({ success: true, data: null });
    render(<TeamPanel team={[me, worker]} />);

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja a Tomás Recepción" }));
    expect(deleteAdmin).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));

    await waitFor(() => expect(getTeam).toHaveBeenCalled());
    expect(deleteAdmin).toHaveBeenCalledWith(2);
  });
});
