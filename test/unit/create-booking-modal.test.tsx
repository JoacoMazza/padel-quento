// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { createBookingAdmin } = vi.hoisted(() => ({ createBookingAdmin: vi.fn() }));
vi.mock("@/src/actions/adminBooking", () => ({ createBookingAdmin }));

import { CreateBookingModal } from "@/app/admin/create-booking-modal";

const courts = [
  { id: 10, number: 3, price: 20000 },
  { id: 11, number: 4, price: 25000 },
];
const players = [{ id: 7, name: "Ana Gómez", phoneNumber: "2215550102" }];

const onClose = vi.fn();
const onCreated = vi.fn();

function renderModal(initial = {}) {
  return render(
    <CreateBookingModal courts={courts} players={players} initial={initial} onClose={onClose} onCreated={onCreated} />,
  );
}

describe("CreateBookingModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("viene con la cancha, el día y la hora de la celda elegida y el precio de esa cancha", () => {
    renderModal({ courtId: 11, date: "2026-10-20", startTime: "19:30" });

    expect(screen.getByRole("heading", { name: "Nuevo turno" })).toBeTruthy();
    expect((screen.getByLabelText("Cancha") as HTMLSelectElement).value).toBe("11");
    expect((screen.getByLabelText("Fecha") as HTMLInputElement).value).toBe("2026-10-20");
    expect((screen.getByLabelText("Hora") as HTMLInputElement).value).toBe("19:30");
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("25000");
  });

  it("al cambiar de cancha usa su precio, salvo que el admin lo haya cambiado", () => {
    renderModal();

    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("20000");
    fireEvent.change(screen.getByLabelText("Cancha"), { target: { value: "11" } });
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("25000");

    fireEvent.change(screen.getByLabelText("Precio"), { target: { value: "18000" } });
    fireEvent.change(screen.getByLabelText("Cancha"), { target: { value: "10" } });
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe("18000");
  });

  it("agenda el turno a nombre de un jugador registrado", async () => {
    createBookingAdmin.mockResolvedValue({ success: true, data: { id: 1 } });
    renderModal({ courtId: 10, date: "2026-10-20", startTime: "18:00" });

    fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar turno" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createBookingAdmin).toHaveBeenCalledWith({
      courtId: 10,
      date: "2026-10-20",
      startTime: "18:00",
      price: 20000,
      holder: { playerId: 7 },
    });
  });

  it("agenda el turno a nombre de alguien sin cuenta", async () => {
    createBookingAdmin.mockResolvedValue({ success: true, data: { id: 1 } });
    renderModal({ courtId: 10, date: "2026-10-20", startTime: "18:00" });

    fireEvent.click(screen.getByLabelText("Sin cuenta"));
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Carla" } });
    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Mostrador" } });
    fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "2215559999" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar turno" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createBookingAdmin.mock.calls[0][0].holder).toEqual({
      names: "Carla",
      lastnames: "Mostrador",
      phoneNumber: "2215559999",
    });
  });

  it("muestra el error y no cierra si no se pudo agendar", async () => {
    createBookingAdmin.mockResolvedValue({ success: false, error: "Ese horario ya está ocupado en esta cancha." });
    renderModal({ courtId: 10, date: "2026-10-20", startTime: "18:00" });

    fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar turno" }));

    expect(await screen.findByText("Ese horario ya está ocupado en esta cancha.")).toBeTruthy();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("se cierra con Cancelar sin agendar nada", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalled();
    expect(createBookingAdmin).not.toHaveBeenCalled();
  });
});
