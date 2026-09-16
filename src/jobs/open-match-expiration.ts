import { cancelExpiredMatches } from "@/src/actions/match";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const globalForJob = globalThis as unknown as {
  openMatchExpirationInterval?: NodeJS.Timeout;
};

/**
 * Arranca el chequeo periódico que cancela los partidos abiertos sin cupo
 * completo a horas de su inicio. Se guarda el interval en globalThis para que
 * el hot-reload de Next en desarrollo no lo duplique en cada recompilación.
 */
export function startOpenMatchExpirationJob() {
  if (globalForJob.openMatchExpirationInterval) {
    return;
  }

  const runCheck = () => {
    cancelExpiredMatches().catch((error) => {
      console.error("openMatchExpirationJob", error);
    });
  };

  // Corre una vez al arrancar: con setInterval solo, un partido ya vencido
  // queda visible hasta 5 minutos (o más, si el server se reinicia antes de
  // que el interval llegue a disparar, algo común en desarrollo).
  runCheck();

  globalForJob.openMatchExpirationInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
  globalForJob.openMatchExpirationInterval.unref?.();
}
