"use server";

import "reflect-metadata";
import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getBookings } from "@/src/actions/booking";
import { getOutOfServices } from "@/src/actions/outOfService";
import type { Court } from "@/src/entities/Court";
import type { Schedule } from "@/src/entities/Schedule";
import type { Booking } from "@/src/entities/Booking";
import type { OutOfService } from "@/src/entities/OutOfService";
import type { ActionResult } from "@/src/lib/action-result";
import { findFixedBookingDates } from "@/src/lib/fixed-booking-dates";
import { adminOnly } from "@/src/lib/rbac";

export type ScheduleBoardData = {
  courts: Court[];
  schedules: Schedule[];
  bookings: Booking[];
  outOfServices: OutOfService[];
  /** Turnos que son una fecha de un turno fijo (HU-41), para marcarlos en la turnera. */
  fixedBookingDates: Array<{ bookingId: number; fixedBookingDateId: number }>;
};

/**
 * Trae los cuatro recursos de la turnera en un solo round-trip para que el
 * refresco en tiempo real del panel admin reemplace el snapshot completo de
 * una vez, en lugar de ir actualizando cada recurso por separado y mostrar
 * estados a medio mezclar (RNF-08).
 */
export async function getScheduleBoardData(): Promise<ActionResult<ScheduleBoardData>> {
  const denied = await adminOnly();
  if (denied) return denied;

  const [courtsResult, schedulesResult, bookingsResult, outOfServicesResult] = await Promise.all([
    getCourts(),
    getSchedules(),
    getBookings(),
    getOutOfServices(),
  ]);

  if (!courtsResult.success) return { success: false, error: courtsResult.error };
  if (!schedulesResult.success) return { success: false, error: schedulesResult.error };
  if (!bookingsResult.success) return { success: false, error: bookingsResult.error };
  if (!outOfServicesResult.success) return { success: false, error: outOfServicesResult.error };

  const fixedDates = await findFixedBookingDates(bookingsResult.data.map((booking) => booking.id));

  return {
    success: true,
    data: {
      courts: courtsResult.data,
      schedules: schedulesResult.data,
      bookings: bookingsResult.data,
      outOfServices: outOfServicesResult.data,
      fixedBookingDates: [...fixedDates].map(([bookingId, fixedBookingDateId]) => ({ bookingId, fixedBookingDateId })),
    },
  };
}
