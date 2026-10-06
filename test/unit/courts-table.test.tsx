// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { updateCourt, createOutOfService, endOutOfService } = vi.hoisted(() => ({
  updateCourt: vi.fn(),
  createOutOfService: vi.fn(),
  endOutOfService: vi.fn(),
}));

vi.mock("@/src/actions/court", () => ({ updateCourt }));
vi.mock("@/src/actions/outOfService", () => ({ createOutOfService, endOutOfService }));

import { CourtState, OutOfServiceReason } from "@/src/domain/enums";
import { CourtsTable } from "@/app/admin/courts-table";
import type { CourtItem } from "@/app/admin/court-status";

const court: CourtItem = { id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000, activeOutOfService: null };

const blockedCourt: CourtItem = {
  ...court,
  activeOutOfService: { id: 20, reason: OutOfServiceReason.MAINTENANCE, toDateTime: new Date("2099-01-01T12:00:00") },
};

function openOutOfServiceModal() {
  fireEvent.click(screen.getByRole("button", { name: "Poner fuera de servicio la cancha 3" }));
}

describe("CourtsTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("no ofrece la opción de eliminar canchas", () => {
    render(<CourtsTable courts={[court]} />);

    expect(screen.queryByRole("button", { name: /eliminar/i })).toBeNull();
  });

  it("muestra la cancha con un bloqueo activo como fuera de servicio, con su motivo", () => {
    render(<CourtsTable courts={[blockedCourt]} />);

    expect(screen.getByText("Fuera de Servicio (Mantenimiento)")).toBeTruthy();
  });

  it("el modal ofrece como motivos Mantenimiento, Día libre, Limpieza y Otro", () => {
    render(<CourtsTable courts={[court]} />);
    openOutOfServiceModal();

    const options = Array.from((screen.getByLabelText("Motivo") as HTMLSelectElement).options).map((o) => o.text);
    expect(options).toEqual(["Mantenimiento", "Día libre", "Limpieza", "Otro"]);
  });

  it("crea un bloqueo desde ahora y muestra la cancha fuera de servicio", async () => {
    createOutOfService.mockResolvedValueOnce({
      success: true,
      data: {
        id: 30,
        fromDateTime: new Date(Date.now() - 1000),
        toDateTime: new Date("2099-01-01T20:00:00"),
        reason: OutOfServiceReason.CLEANING,
      },
    });
    render(<CourtsTable courts={[court]} />);
    openOutOfServiceModal();

    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2099-01-01T20:00" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: OutOfServiceReason.CLEANING } });
    fireEvent.change(screen.getByLabelText("Descripción (opcional)"), { target: { value: "Limpieza de vidrios" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar bloqueo" }));

    await waitFor(() =>
      expect(createOutOfService).toHaveBeenCalledWith({
        courtId: 1,
        fromDateTime: expect.any(Date),
        toDateTime: new Date("2099-01-01T20:00"),
        reason: OutOfServiceReason.CLEANING,
        description: "Limpieza de vidrios",
      }),
    );
    expect(await screen.findByText("Fuera de Servicio (Limpieza)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Habilitar la cancha 3" })).toBeTruthy();
  });

  it("programa un bloqueo a futuro sin cambiar el estado actual de la cancha", async () => {
    createOutOfService.mockResolvedValueOnce({
      success: true,
      data: {
        id: 31,
        fromDateTime: new Date("2099-01-01T09:00"),
        toDateTime: new Date("2099-01-01T12:00"),
        reason: OutOfServiceReason.FREE_DAY,
      },
    });
    render(<CourtsTable courts={[court]} />);
    openOutOfServiceModal();

    fireEvent.click(screen.getByLabelText("Programado"));
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2099-01-01T09:00" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2099-01-01T12:00" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: OutOfServiceReason.FREE_DAY } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar bloqueo" }));

    await waitFor(() =>
      expect(createOutOfService).toHaveBeenCalledWith({
        courtId: 1,
        fromDateTime: new Date("2099-01-01T09:00"),
        toDateTime: new Date("2099-01-01T12:00"),
        reason: OutOfServiceReason.FREE_DAY,
        description: null,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Guardar bloqueo" })).toBeNull());
    expect(screen.getByText("Disponible")).toBeTruthy();
  });

  it("muestra el error si no se pudo crear el bloqueo", async () => {
    createOutOfService.mockResolvedValueOnce({
      success: false,
      error: "La fecha de fin del bloqueo debe ser posterior a la de inicio.",
    });
    render(<CourtsTable courts={[court]} />);
    openOutOfServiceModal();

    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2000-01-01T20:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar bloqueo" }));

    expect(await screen.findByText("La fecha de fin del bloqueo debe ser posterior a la de inicio.")).toBeTruthy();
  });

  it("ofrece habilitar la cancha en lugar de ponerla fuera de servicio si tiene un bloqueo activo", () => {
    render(<CourtsTable courts={[blockedCourt]} />);

    expect(screen.queryByRole("button", { name: "Poner fuera de servicio la cancha 3" })).toBeNull();
    expect(screen.getByRole("button", { name: "Habilitar la cancha 3" })).toBeTruthy();
  });

  it("habilita la cancha finalizando el bloqueo activo y la muestra disponible", async () => {
    endOutOfService.mockResolvedValueOnce({ success: true, data: { id: 20 } });
    render(<CourtsTable courts={[blockedCourt]} />);

    fireEvent.click(screen.getByRole("button", { name: "Habilitar la cancha 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(endOutOfService).toHaveBeenCalledWith(20));
    await waitFor(() => expect(screen.getByText("Disponible")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Poner fuera de servicio la cancha 3" })).toBeTruthy();
  });

  it("muestra el error si no se pudo habilitar la cancha", async () => {
    endOutOfService.mockResolvedValueOnce({ success: false, error: "No se pudo habilitar la cancha." });
    render(<CourtsTable courts={[blockedCourt]} />);

    fireEvent.click(screen.getByRole("button", { name: "Habilitar la cancha 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("No se pudo habilitar la cancha.")).toBeTruthy();
  });

  it("al editar solo permite elegir entre Disponible y Dada de Baja", () => {
    render(<CourtsTable courts={[court]} />);

    fireEvent.click(screen.getByRole("button", { name: "Editar cancha 3" }));

    const options = Array.from((screen.getByLabelText("Estado") as HTMLSelectElement).options).map((o) => o.text);
    expect(options).toEqual(["Disponible", "Dada de Baja"]);
  });
});
