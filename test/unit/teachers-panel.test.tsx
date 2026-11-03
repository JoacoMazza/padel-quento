// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const {
  getTeachersAdmin,
  createTeacher,
  assignTeacherRole,
  setTeacherActive,
  removeTeacherRole,
  getPlayersAdmin,
  getTeacherClassesAdmin,
} = vi.hoisted(() => ({
  getTeachersAdmin: vi.fn(),
  createTeacher: vi.fn(),
  assignTeacherRole: vi.fn(),
  setTeacherActive: vi.fn(),
  removeTeacherRole: vi.fn(),
  getPlayersAdmin: vi.fn(),
  getTeacherClassesAdmin: vi.fn(),
}));

vi.mock("@/src/actions/teacher", () => ({
  getTeachersAdmin,
  createTeacher,
  assignTeacherRole,
  setTeacherActive,
  removeTeacherRole,
  getTeacherClassesAdmin,
}));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin }));

import { PlayerCategory } from "@/src/domain/enums";
import { TeachersPanel } from "@/app/admin/teachers-panel";

const lucia = {
  id: 1,
  playerId: 10,
  names: "Lucía",
  lastnames: "Profe",
  email: "lucia@test.com",
  phoneNumber: "2215550001",
  isActive: true,
};
const pablo = { ...lucia, id: 2, playerId: 11, names: "Pablo", lastnames: "Inactivo", email: "pablo@test.com", isActive: false };

function player(id: number, names: string, email: string) {
  return {
    id,
    names,
    lastnames: "Jugador",
    email,
    phoneNumber: `22155500${id}`,
    category: PlayerCategory.FOURTH,
    scoring: 0,
    isBlocked: false,
  };
}

function rowOf(name: string) {
  return screen.getByText(name).closest("tr")!;
}

describe("TeachersPanel (HU-42)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeachersAdmin.mockResolvedValue({ success: true, data: [lucia, pablo] });
  });

  afterEach(() => {
    cleanup();
  });

  it("lista los profesores con su contacto y si están activos", () => {
    render(<TeachersPanel teachers={[lucia, pablo]} />);

    expect(within(rowOf("Lucía Profe")).getByText("lucia@test.com")).toBeTruthy();
    expect(within(rowOf("Lucía Profe")).getByText("2215550001")).toBeTruthy();
    expect(within(rowOf("Lucía Profe")).getByText("Activo")).toBeTruthy();
    expect(within(rowOf("Pablo Inactivo")).getByText("Inactivo")).toBeTruthy();
  });

  it("sin profesores, lo dice", () => {
    render(<TeachersPanel teachers={[]} />);

    expect(screen.getByText("Todavía no hay profesores.")).toBeTruthy();
  });

  it("da de alta un profesor nuevo con sus datos y actualiza el listado", async () => {
    createTeacher.mockResolvedValue({ success: true, data: lucia });
    render(<TeachersPanel teachers={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesor" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo profesor" });
    for (const [label, value] of [
      ["Nombre", "Lucía"],
      ["Apellido", "Profe"],
      ["Email", "lucia@test.com"],
      ["Teléfono", "2215550001"],
      ["Contraseña", "secreto123"],
    ]) {
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear profesor" }));

    await waitFor(() => expect(createTeacher).toHaveBeenCalledTimes(1));
    const form = createTeacher.mock.calls[0][0] as FormData;
    expect(Object.fromEntries(form.entries())).toEqual({
      names: "Lucía",
      lastnames: "Profe",
      email: "lucia@test.com",
      phoneNumber: "2215550001",
      password: "secreto123",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("Lucía Profe")).toBeTruthy();
  });

  it("si el alta falla, muestra el error y deja el formulario abierto", async () => {
    createTeacher.mockResolvedValue({ success: false, error: "El correo ya está en uso." });
    render(<TeachersPanel teachers={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Nuevo profesor" }));
    const dialog = screen.getByRole("dialog", { name: "Nuevo profesor" });
    fireEvent.submit(within(dialog).getByRole("button", { name: "Crear profesor" }).closest("form")!);

    expect(await within(dialog).findByText("El correo ya está en uso.")).toBeTruthy();
  });

  it("le da el rol a un jugador existente, buscándolo por nombre o email, sin listar a los que ya son profesores", async () => {
    getPlayersAdmin.mockResolvedValue({
      success: true,
      data: [player(10, "Lucía", "lucia@test.com"), player(20, "Martina", "martina@test.com"), player(21, "Mateo", "mateo@test.com")],
    });
    assignTeacherRole.mockResolvedValue({ success: true, data: { ...lucia, id: 3, playerId: 20, names: "Martina" } });
    render(<TeachersPanel teachers={[lucia]} />);

    fireEvent.click(screen.getByRole("button", { name: "Asignar a un jugador" }));
    const dialog = screen.getByRole("dialog", { name: "Asignar el rol de profesor" });
    fireEvent.change(await within(dialog).findByLabelText("Buscar jugador"), { target: { value: "mar" } });

    expect(within(dialog).queryByText(/Lucía/)).toBeNull();
    expect(within(dialog).queryByText(/Mateo/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hacer profesor a Martina Jugador" }));

    await waitFor(() => expect(assignTeacherRole).toHaveBeenCalledWith(20));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("desactiva a un profesor activo y reactiva a uno inactivo", async () => {
    setTeacherActive.mockResolvedValue({ success: true, data: lucia });
    render(<TeachersPanel teachers={[lucia, pablo]} />);

    fireEvent.click(within(rowOf("Lucía Profe")).getByRole("button", { name: "Desactivar a Lucía Profe" }));
    await waitFor(() => expect(setTeacherActive).toHaveBeenCalledWith(1, false));

    fireEvent.click(within(rowOf("Pablo Inactivo")).getByRole("button", { name: "Reactivar a Pablo Inactivo" }));
    await waitFor(() => expect(setTeacherActive).toHaveBeenCalledWith(2, true));
  });

  it("le quita el rol después de confirmar", async () => {
    removeTeacherRole.mockResolvedValue({ success: true, data: null });
    render(<TeachersPanel teachers={[lucia]} />);

    fireEvent.click(within(rowOf("Lucía Profe")).getByRole("button", { name: "Quitar el rol de profesor a Lucía Profe" }));
    expect(removeTeacherRole).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, quitar el rol" }));

    await waitFor(() => expect(removeTeacherRole).toHaveBeenCalledWith(1));
  });

  it("muestra las clases de un profesor, próximas y finalizadas, con sus alumnos (HU-48)", async () => {
    getTeacherClassesAdmin.mockResolvedValue({
      success: true,
      data: [
        {
          id: 7,
          fromDateTime: new Date(2099, 9, 14, 18, 0),
          durationMinutes: 90,
          courtNumber: 3,
          classCapacity: 4,
          isFinished: false,
          students: [{ id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" }],
        },
        {
          id: 5,
          fromDateTime: new Date(2026, 9, 10, 18, 0),
          durationMinutes: 90,
          courtNumber: 1,
          classCapacity: 2,
          isFinished: true,
          students: [],
        },
      ],
    });
    render(<TeachersPanel teachers={[lucia]} />);

    fireEvent.click(within(rowOf("Lucía Profe")).getByRole("button", { name: "Ver las clases de Lucía Profe" }));

    const dialog = await screen.findByRole("dialog", { name: "Clases de Lucía Profe" });
    expect(getTeacherClassesAdmin).toHaveBeenCalledWith(1);
    const upcoming = within(dialog).getByRole("listitem", { name: /Cancha 3/ });
    expect(within(upcoming).getByText("1/4 alumnos")).toBeTruthy();
    expect(within(upcoming).getByText("Ana Alumna")).toBeTruthy();
    expect(within(within(dialog).getByRole("listitem", { name: /Cancha 1/ })).getByText("Finalizado")).toBeTruthy();
  });

  it("un profesor sin clases lo dice", async () => {
    getTeacherClassesAdmin.mockResolvedValue({ success: true, data: [] });
    render(<TeachersPanel teachers={[lucia]} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver las clases de Lucía Profe" }));

    expect(await screen.findByText("No tiene clases próximas ni de los últimos 7 días.")).toBeTruthy();
  });

  it("muestra el error si no se pudo cambiar el estado", async () => {
    setTeacherActive.mockResolvedValue({ success: false, error: "No se pudo actualizar el profesor." });
    render(<TeachersPanel teachers={[lucia]} />);

    fireEvent.click(screen.getByRole("button", { name: "Desactivar a Lucía Profe" }));

    expect(await screen.findByText("No se pudo actualizar el profesor.")).toBeTruthy();
  });
});
