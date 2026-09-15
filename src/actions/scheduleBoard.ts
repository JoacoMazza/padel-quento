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

export type ScheduleBoardData = {
  courts: Court[];
  schedules: Schedule[];
  bookings: Booking[];
  outOfServices: OutOfService[];
};

/**
 * Trae los cuatro recursos de la turnera en un solo round-trip para que el
 * refresco en tiempo real del panel admin reemplace el snapshot completo de
 * una vez, en lugar de ir actualizando cada recurso por separado y mostrar
 * estados a medio mezclar (RNF-08).
 */
export async function getScheduleBoardData(): Promise<ActionResult<ScheduleBoardData>> {
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

  return {
    success: true,
    data: {
      courts: courtsResult.data,
      schedules: schedulesResult.data,
      bookings: bookingsResult.data,
      outOfServices: outOfServicesResult.data,
    },
  };
}
