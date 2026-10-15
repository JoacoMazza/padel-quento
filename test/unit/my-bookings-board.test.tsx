// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

vi.mock("@/app/my-bookings/booking-row", () => ({
  BookingRow: ({ booking }: { booking: { id: number } }) => <div>Turno {booking.id}</div>,
}));

import { BookingState } from "@/src/domain/enums";
import { MyBookingsBoard } from "@/app/my-bookings/my-bookings-board";
import type { MyBookingItem } from "@/app/my-bookings/types";

function booking(id: number, daysFromNow: number, overrides: Partial<MyBookingItem> = {}): MyBookingItem {
  return {
    id,
    fromDateTime: new Date(Date.now() + daysFromNow * 24 * 60 * 60_000),
    durationMinutes: 90,
    bookingState: BookingState.RESERVED,
    courtNumber: 1,
    price: 10000,
    matchId: null,
    needPlayers: false,
    confirmedPlayers: 4,
    chatId: null,
    joinedAsParticipant: false,
    canReview: false,
    isFixed: false,
    ...overrides,
  };
}

function section(name: string) {
  return screen.getByRole("heading", { name: new RegExp(name) }).closest("section")!;
}

describe("MyBookingsBoard", () => {
  afterEach(() => {
    cleanup();
  });

  it("aclara que de los turnos anteriores solo se muestran los últimos 3", () => {
    render(<MyBookingsBoard bookings={[booking(1, 2), booking(2, -2)]} playerId={7} />);

    expect(screen.getByText("Turno 2")).toBeTruthy();
    expect(screen.getByText("Se muestran tus últimos 3 turnos.")).toBeTruthy();
  });

  it("muestra primero, arriba de los próximos turnos, los partidos que se pueden calificar", () => {
    const toReview = booking(3, -1, { matchId: 30, canReview: true });
    render(<MyBookingsBoard bookings={[booking(1, 2), booking(2, -3), toReview]} playerId={7} />);

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toMatch(/Para calificar/);
    expect(within(section("Para calificar")).getByText("Turno 3")).toBeTruthy();
    // No se repite entre los turnos anteriores.
    expect(within(section("Turnos anteriores")).queryByText("Turno 3")).toBeNull();
    expect(within(section("Turnos anteriores")).getByText("Turno 2")).toBeTruthy();
  });

  it("sin partidos para calificar no muestra esa sección", () => {
    render(<MyBookingsBoard bookings={[booking(1, 2), booking(2, -3)]} playerId={7} />);

    expect(screen.queryByRole("heading", { name: /Para calificar/ })).toBeNull();
  });
});
