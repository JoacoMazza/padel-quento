import { describe, expect, it } from "vitest";
import { BookingState } from "@/src/domain/enums";
import { getAdminBookingStatus } from "@/app/admin/admin-booking-status";

// Turno de 18:00 a 19:30 del lunes 2026-10-12.
const booking = (bookingState: BookingState = BookingState.RESERVED) => ({
  fromDateTime: new Date(2026, 9, 12, 18, 0),
  durationMinutes: 90,
  bookingState,
});

const at = (hours: number, minutes = 0) => new Date(2026, 9, 12, hours, minutes);

describe("getAdminBookingStatus", () => {
  it("un turno futuro sigue activo", () => {
    expect(getAdminBookingStatus(booking(), at(17, 0))).toBe("active");
  });

  it("un turno en curso sigue activo", () => {
    expect(getAdminBookingStatus(booking(), at(19, 0))).toBe("active");
  });

  it("justo al terminar el turno todavía no está finalizado", () => {
    expect(getAdminBookingStatus(booking(), at(19, 30))).toBe("active");
  });

  it("un turno cuyo horario de fin ya pasó está finalizado", () => {
    expect(getAdminBookingStatus(booking(), at(19, 31))).toBe("finished");
  });

  it("un turno pagado que ya terminó también está finalizado", () => {
    expect(getAdminBookingStatus(booking(BookingState.PAID), at(20, 0))).toBe("finished");
  });

  it("un turno cancelado sigue cancelado aunque su horario ya haya pasado", () => {
    expect(getAdminBookingStatus(booking(BookingState.CANCELLED), at(20, 0))).toBe("cancelled");
  });

  it("un turno cancelado futuro está cancelado", () => {
    expect(getAdminBookingStatus(booking(BookingState.CANCELLED), at(17, 0))).toBe("cancelled");
  });
});
