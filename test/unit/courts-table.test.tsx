// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { updateCourt, setCourtOutOfService } = vi.hoisted(() => ({
  updateCourt: vi.fn(),
  setCourtOutOfService: vi.fn(),
}));

vi.mock("@/src/actions/court", () => ({ updateCourt, setCourtOutOfService }));

import { CourtState } from "@/src/domain/enums";
import { CourtsTable } from "@/app/admin/courts-table";
import type { CourtItem } from "@/app/admin/court-status";

const court: CourtItem = { id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 };

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

  it("pone la cancha fuera de servicio tras confirmar y actualiza su estado", async () => {
    setCourtOutOfService.mockResolvedValueOnce({
      success: true,
      data: { ...court, state: CourtState.OUT_OF_SERVICE },
    });
    render(<CourtsTable courts={[court]} />);

    fireEvent.click(screen.getByRole("button", { name: "Poner fuera de servicio la cancha 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(setCourtOutOfService).toHaveBeenCalledWith(1));
    await waitFor(() => expect(screen.getByText("Fuera de Servicio")).toBeTruthy());
    expect(screen.getByText("Cancha 3")).toBeTruthy();
  });

  it("muestra el error si no se pudo poner la cancha fuera de servicio", async () => {
    setCourtOutOfService.mockResolvedValueOnce({
      success: false,
      error: "No se pudo poner la cancha fuera de servicio.",
    });
    render(<CourtsTable courts={[court]} />);

    fireEvent.click(screen.getByRole("button", { name: "Poner fuera de servicio la cancha 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("No se pudo poner la cancha fuera de servicio.")).toBeTruthy();
  });

  it("ofrece habilitar la cancha en lugar de ponerla fuera de servicio si ya lo está", () => {
    render(<CourtsTable courts={[{ ...court, state: CourtState.OUT_OF_SERVICE }]} />);

    expect(screen.queryByRole("button", { name: "Poner fuera de servicio la cancha 3" })).toBeNull();
    expect(screen.getByRole("button", { name: "Habilitar la cancha 3" })).toBeTruthy();
  });

  it("habilita una cancha fuera de servicio tras confirmar y la muestra disponible", async () => {
    updateCourt.mockResolvedValueOnce({ success: true, data: court });
    render(<CourtsTable courts={[{ ...court, state: CourtState.OUT_OF_SERVICE }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Habilitar la cancha 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(updateCourt).toHaveBeenCalledWith(1, { state: CourtState.AVAILABLE }));
    await waitFor(() => expect(screen.getByText("Disponible")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Poner fuera de servicio la cancha 3" })).toBeTruthy();
  });

  it("muestra el error si no se pudo habilitar la cancha", async () => {
    updateCourt.mockResolvedValueOnce({ success: false, error: "No se pudo actualizar la cancha." });
    render(<CourtsTable courts={[{ ...court, state: CourtState.OUT_OF_SERVICE }]} />);

    fireEvent.click(screen.getByRole("button", { name: "Habilitar la cancha 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("No se pudo actualizar la cancha.")).toBeTruthy();
  });
});
