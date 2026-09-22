import { awardAttendancePoints } from "@/src/actions/attendance";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const globalForJob = globalThis as unknown as {
  attendancePointsInterval?: NodeJS.Timeout;
};

/**
 * Arranca el chequeo periódico que acredita los puntos de fidelidad por
 * asistencia a los turnos ya finalizados (ver awardAttendancePoints). Mismo
 * patrón que src/jobs/open-match-expiration.ts: el interval se guarda en
 * globalThis para que el hot-reload de Next en desarrollo no lo duplique.
 */
export function startAttendancePointsJob() {
  if (globalForJob.attendancePointsInterval) {
    return;
  }

  const runCheck = () => {
    awardAttendancePoints().catch((error) => {
      console.error("attendancePointsJob", error);
    });
  };

  // Corre una vez al arrancar: con setInterval solo, un turno ya finalizado
  // queda sin puntos hasta 5 minutos (o más, si el server se reinicia antes de
  // que el interval llegue a disparar, algo común en desarrollo).
  runCheck();

  globalForJob.attendancePointsInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
  globalForJob.attendancePointsInterval.unref?.();
}
