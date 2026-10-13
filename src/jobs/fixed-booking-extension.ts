import { extendFixedBookings } from "@/src/actions/fixedBooking";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

const globalForJob = globalThis as unknown as {
  fixedBookingExtensionInterval?: NodeJS.Timeout;
};

/**
 * Arranca el chequeo periódico que genera las fechas nuevas de los turnos fijos
 * a medida que entran en el horizonte de 6 meses (ver extendFixedBookings).
 * Mismo patrón que src/jobs/attendance-points.ts: el interval se guarda en
 * globalThis para que el hot-reload de Next en desarrollo no lo duplique.
 */
export function startFixedBookingExtensionJob() {
  if (globalForJob.fixedBookingExtensionInterval) {
    return;
  }

  const runCheck = () => {
    extendFixedBookings().catch((error) => {
      console.error("fixedBookingExtensionJob", error);
    });
  };

  // Corre una vez al arrancar: si el server estuvo apagado, se ponen al día las fechas.
  runCheck();

  globalForJob.fixedBookingExtensionInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
  globalForJob.fixedBookingExtensionInterval.unref?.();
}
