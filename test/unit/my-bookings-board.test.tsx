// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("@/app/my-bookings/booking-row", () => ({
  BookingRow: ({ booking }: { booking: { id: number } }) => <div>Turno {booking.id}</div>,
}));

import { BookingState } from "@/src/domain/enums";
import { MyBookingsBoard } from "@/app/my-bookings/my-bookings-board";
import type { MyBookingItem } from "@/app/my-bookings/types";

function booking(id: number, daysFromNow: number): MyBookingItem {
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
    isFixed: false,
  };
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
});
