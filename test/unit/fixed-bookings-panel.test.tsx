// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { createFixedBooking, getFixedBookingsAdmin, releaseFixedBookingDate, restoreFixedBookingDate, cancelFixedBooking } =
  vi.hoisted(() => ({
    createFixedBooking: vi.fn(),
    getFixedBookingsAdmin: vi.fn(),
    releaseFixedBookingDate: vi.fn(),
    restoreFixedBookingDate: vi.fn(),
    cancelFixedBooking: vi.fn(),
  }));

vi.mock("@/src/actions/fixedBooking", () => ({
  createFixedBooking,
  getFixedBookingsAdmin,
  releaseFixedBookingDate,
  restoreFixedBookingDate,
  cancelFixedBooking,
}));

import { FixedBookingDateState, FixedBookingFrequency } from "@/src/domain/enums";
import { FixedBookingsPanel } from "@/app/admin/fixed-bookings-panel";
import type { FixedBookingAdminItem } from "@/src/actions/fixedBooking";

function fixedBooking(overrides: Partial<FixedBookingAdminItem> = {}): FixedBookingAdminItem {
  return {
    id: 1,
    courtId: 10,
    courtNumber: 3,
    holderName: "Fede Fijo",
    holderPhoneNumber: "2215550101",
    frequency: FixedBookingFrequency.WEEKLY,
    startDate: "2026-10-19",
    endDate: null,
    startTime: "18:00",
    durationMinutes: 90,
    isActive: true,
    upcomingDates: [
      { id: 100, date: "2026-10-19", state: FixedBookingDateState.BOOKED, bookingId: 500 },
      { id: 101, date: "2026-10-26", state: FixedBookingDateState.RELEASED, bookingId: 501 },
      { id: 102, date: "2026-11-02", state: FixedBookingDateState.CONFLICT, bookingId: null },
    ],
    ...overrides,
  };
}

const courts = [
  { id: 10, number: 3 },
  { id: 11, number: 4 },
];
const players = [{ id: 7, name: "Ana Gómez", phoneNumber: "2215550102" }];

const onCloseCreate = vi.fn();
const onChanged = vi.fn();

function renderPanel(items = [fixedBooking()], { isCreating = false } = {}) {
  return render(
    <FixedBookingsPanel
      fixedBookings={items}
      courts={courts}
      players={players}
      isCreating={isCreating}
      onCloseCreate={onCloseCreate}
      onChanged={onChanged}
    />,
  );
}

describe("FixedBookingsPanel", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getFixedBookingsAdmin.mockResolvedValue({ success: true, data: [fixedBooking()] });
  });

  afterEach(() => {
    cleanup();
  });

  it("lista cada turno fijo con su cancha, día y hora, frecuencia y titular", () => {
    renderPanel();

    const row = screen.getByRole("row", { name: /Cancha 3/ });
    expect(within(row).getByText("Lunes 18:00")).toBeTruthy();
    expect(within(row).getByText("Semanal")).toBeTruthy();
    expect(within(row).getByText("Fede Fijo")).toBeTruthy();
    expect(within(row).getByText("2215550101")).toBeTruthy();
    expect(within(row).getByText("Activo")).toBeTruthy();
  });

  it("muestra un mensaje cuando no hay turnos fijos", () => {
    renderPanel([]);

    expect(screen.getByText("Todavía no hay turnos fijos.")).toBeTruthy();
  });

  it("tiene su título y no su propio botón de alta (está junto a Actualizar en la turnera)", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Turnos fijos" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Nuevo turno fijo" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Nuevo turno fijo" })).toBeNull();
  });

  describe("próximas fechas", () => {
    it("muestra el estado de cada fecha", () => {
      renderPanel();

      fireEvent.click(screen.getByRole("button", { name: "Ver fechas del turno fijo de la cancha 3" }));

      expect(screen.getByText("Reservada")).toBeTruthy();
      expect(screen.getByText("Liberada")).toBeTruthy();
      expect(screen.getByText("Ocupada por otro turno")).toBeTruthy();
    });

    it("libera solo una fecha reservada y actualiza el listado", async () => {
      releaseFixedBookingDate.mockResolvedValue({ success: true, data: null });
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Ver fechas del turno fijo de la cancha 3" }));

      fireEvent.click(screen.getByRole("button", { name: "Liberar la fecha 2026-10-19" }));

      await waitFor(() => expect(getFixedBookingsAdmin).toHaveBeenCalled());
      expect(releaseFixedBookingDate).toHaveBeenCalledWith(100);
      // La grilla de la turnera también tiene que mostrar el horario libre.
      expect(onChanged).toHaveBeenCalled();
    });

    it("restaura una fecha liberada o salteada", async () => {
      restoreFixedBookingDate.mockResolvedValue({ success: true, data: null });
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Ver fechas del turno fijo de la cancha 3" }));

      fireEvent.click(screen.getByRole("button", { name: "Restaurar la fecha 2026-10-26" }));

      await waitFor(() => expect(getFixedBookingsAdmin).toHaveBeenCalled());
      expect(restoreFixedBookingDate).toHaveBeenCalledWith(101);
    });

    it("muestra el error si no se pudo restaurar", async () => {
      restoreFixedBookingDate.mockResolvedValue({ success: false, error: "Ese horario ya fue reservado por otra persona." });
      renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Ver fechas del turno fijo de la cancha 3" }));

      fireEvent.click(screen.getByRole("button", { name: "Restaurar la fecha 2026-11-02" }));

      expect(await screen.findByText("Ese horario ya fue reservado por otra persona.")).toBeTruthy();
    });
  });

  it("da de baja el turno fijo después de confirmar", async () => {
    cancelFixedBooking.mockResolvedValue({ success: true, data: null });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja el turno fijo de la cancha 3" }));
    expect(cancelFixedBooking).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));

    await waitFor(() => expect(getFixedBookingsAdmin).toHaveBeenCalled());
    expect(cancelFixedBooking).toHaveBeenCalledWith(1);
    expect(onChanged).toHaveBeenCalled();
  });

  it("un turno fijo dado de baja no ofrece acciones", () => {
    renderPanel([fixedBooking({ isActive: false })]);

    expect(screen.getByText("Dado de baja")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Dar de baja el turno fijo de la cancha 3" })).toBeNull();
  });

  describe("alta", () => {
    function fillCommonFields() {
      fireEvent.change(screen.getByLabelText("Cancha"), { target: { value: "11" } });
      fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-10-20" } });
      fireEvent.change(screen.getByLabelText("Hora"), { target: { value: "19:30" } });
      fireEvent.change(screen.getByLabelText("Frecuencia"), { target: { value: FixedBookingFrequency.BIWEEKLY } });
      fireEvent.change(screen.getByLabelText("Fecha de fin (opcional)"), { target: { value: "2026-12-31" } });
    }

    it("crea un turno fijo para un jugador registrado y avisa qué fechas se saltearon", async () => {
      createFixedBooking.mockResolvedValue({ success: true, data: { id: 2, conflicts: ["2026-11-03"] } });
      renderPanel(undefined, { isCreating: true });

      fillCommonFields();
      fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
      fireEvent.click(screen.getByRole("button", { name: "Crear turno fijo" }));

      await waitFor(() => expect(getFixedBookingsAdmin).toHaveBeenCalled());
      expect(createFixedBooking).toHaveBeenCalledWith({
        courtId: 11,
        startDate: "2026-10-20",
        startTime: "19:30",
        frequency: FixedBookingFrequency.BIWEEKLY,
        endDate: "2026-12-31",
        holder: { playerId: 7 },
      });
      expect(screen.getByText(/No se reservaron estas fechas porque ya estaban ocupadas: 2026-11-03/)).toBeTruthy();
      expect(onCloseCreate).toHaveBeenCalled();
      expect(onChanged).toHaveBeenCalled();
    });

    it("crea un turno fijo para alguien sin cuenta con su nombre y teléfono", async () => {
      createFixedBooking.mockResolvedValue({ success: true, data: { id: 2, conflicts: [] } });
      renderPanel(undefined, { isCreating: true });

      fillCommonFields();
      fireEvent.click(screen.getByLabelText("Sin cuenta"));
      fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Grupo" } });
      fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "De Los Martes" } });
      fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "2215559999" } });
      fireEvent.click(screen.getByRole("button", { name: "Crear turno fijo" }));

      await waitFor(() => expect(createFixedBooking).toHaveBeenCalled());
      expect(createFixedBooking.mock.calls[0][0].holder).toEqual({
        names: "Grupo",
        lastnames: "De Los Martes",
        phoneNumber: "2215559999",
      });
      expect(await screen.findByText("Turno fijo creado.")).toBeTruthy();
    });

    it("muestra el error si no se pudo crear", async () => {
      createFixedBooking.mockResolvedValue({ success: false, error: "La cancha no está abierta en ese horario ese día." });
      renderPanel(undefined, { isCreating: true });

      fillCommonFields();
      fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
      fireEvent.click(screen.getByRole("button", { name: "Crear turno fijo" }));

      expect(await screen.findByText("La cancha no está abierta en ese horario ese día.")).toBeTruthy();
      expect(getFixedBookingsAdmin).not.toHaveBeenCalled();
      expect(onCloseCreate).not.toHaveBeenCalled();
    });

    it("cierra el alta con Cancelar sin crear nada", () => {
      renderPanel(undefined, { isCreating: true });

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(onCloseCreate).toHaveBeenCalled();
      expect(createFixedBooking).not.toHaveBeenCalled();
    });
  });
});
