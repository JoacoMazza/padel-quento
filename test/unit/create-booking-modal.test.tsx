// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { createBookingAdmin, getAvailableSlotsAdmin } = vi.hoisted(() => ({
  createBookingAdmin: vi.fn(),
  getAvailableSlotsAdmin: vi.fn(),
}));
vi.mock("@/src/actions/adminBooking", () => ({ createBookingAdmin, getAvailableSlotsAdmin }));

import { CreateBookingModal } from "@/app/admin/create-booking-modal";
import { formatPrice } from "@/app/bookings/slot-utils";

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

function timeOptions() {
  return within(screen.getByLabelText("Hora"))
    .getAllByRole("option")
    .map((option) => option.textContent);
}

describe("CreateBookingModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAvailableSlotsAdmin.mockResolvedValue({ success: true, data: ["18:00", "19:30"] });
  });

  afterEach(() => {
    cleanup();
  });

  it("viene con la cancha, el día y la hora de la celda elegida y el precio de esa cancha", async () => {
    renderModal({ courtId: 11, date: "2026-10-20", startTime: "19:30" });

    expect(screen.getByRole("heading", { name: "Nuevo turno" })).toBeTruthy();
    expect((screen.getByLabelText("Cancha") as HTMLSelectElement).value).toBe("11");
    expect((screen.getByLabelText("Fecha") as HTMLInputElement).value).toBe("2026-10-20");
    await waitFor(() => expect((screen.getByLabelText("Hora") as HTMLSelectElement).value).toBe("19:30"));
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe(formatPrice(25000));
  });

  it("el precio es el de la cancha y no se puede cambiar", () => {
    renderModal();

    const price = screen.getByLabelText("Precio") as HTMLInputElement;
    expect(price.readOnly).toBe(true);
    expect(price.value).toBe(formatPrice(20000));

    fireEvent.change(screen.getByLabelText("Cancha"), { target: { value: "11" } });
    expect((screen.getByLabelText("Precio") as HTMLInputElement).value).toBe(formatPrice(25000));
  });

  it("solo ofrece los horarios libres de la cancha y el día elegidos", async () => {
    renderModal({ courtId: 10, date: "2026-10-20" });

    await waitFor(() => expect(getAvailableSlotsAdmin).toHaveBeenCalledWith({ courtId: 10, date: "2026-10-20" }));
    await waitFor(() => expect(timeOptions()).toEqual(["Elegí un horario", "18:00", "19:30"]));

    getAvailableSlotsAdmin.mockResolvedValueOnce({ success: true, data: ["09:00"] });
    fireEvent.change(screen.getByLabelText("Cancha"), { target: { value: "11" } });
    await waitFor(() => expect(timeOptions()).toEqual(["Elegí un horario", "09:00"]));
    expect(getAvailableSlotsAdmin).toHaveBeenLastCalledWith({ courtId: 11, date: "2026-10-20" });

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-10-21" } });
    await waitFor(() => expect(getAvailableSlotsAdmin).toHaveBeenLastCalledWith({ courtId: 11, date: "2026-10-21" }));
  });

  it("si no quedan horarios libres lo avisa y no deja confirmar", async () => {
    getAvailableSlotsAdmin.mockResolvedValue({ success: true, data: [] });
    renderModal({ courtId: 10, date: "2026-10-20" });

    expect(await screen.findByText("No hay horarios libres en esa cancha ese día.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Confirmar turno" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("si la hora de la celda ya no está libre, pide elegir otra", async () => {
    renderModal({ courtId: 10, date: "2026-10-20", startTime: "12:00" });

    await waitFor(() => expect(timeOptions()).toEqual(["Elegí un horario", "18:00", "19:30"]));
    expect((screen.getByLabelText("Hora") as HTMLSelectElement).value).toBe("");
  });

  it("agenda el turno a nombre de un jugador registrado, sin mandar precio", async () => {
    createBookingAdmin.mockResolvedValue({ success: true, data: { id: 1 } });
    renderModal({ courtId: 10, date: "2026-10-20", startTime: "18:00" });
    await waitFor(() => expect((screen.getByLabelText("Hora") as HTMLSelectElement).value).toBe("18:00"));

    fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar turno" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(createBookingAdmin).toHaveBeenCalledWith({
      courtId: 10,
      date: "2026-10-20",
      startTime: "18:00",
      holder: { playerId: 7 },
    });
  });

  it("agenda el turno a nombre de alguien sin cuenta", async () => {
    createBookingAdmin.mockResolvedValue({ success: true, data: { id: 1 } });
    renderModal({ courtId: 10, date: "2026-10-20", startTime: "18:00" });
    await waitFor(() => expect((screen.getByLabelText("Hora") as HTMLSelectElement).value).toBe("18:00"));

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
    await waitFor(() => expect((screen.getByLabelText("Hora") as HTMLSelectElement).value).toBe("18:00"));

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
