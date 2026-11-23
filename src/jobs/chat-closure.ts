import { closeFinishedChats } from "@/src/actions/chat";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const globalForJob = globalThis as unknown as {
  chatClosureInterval?: NodeJS.Timeout;
};

/**
 * Arranca el chequeo periódico que cierra las salas de chat de los partidos
 * cuyo turno ya terminó o fue cancelado (ver closeFinishedChats). Mismo patrón
 * que src/jobs/open-match-expiration.ts: el interval se guarda en globalThis
 * para que el hot-reload de Next en desarrollo no lo duplique.
 */
export function startChatClosureJob() {
  if (globalForJob.chatClosureInterval) {
    return;
  }

  const runCheck = () => {
    closeFinishedChats().catch((error) => {
      console.error("chatClosureJob", error);
    });
  };

  runCheck();

  globalForJob.chatClosureInterval = setInterval(runCheck, CHECK_INTERVAL_MS);
  globalForJob.chatClosureInterval.unref?.();
}
