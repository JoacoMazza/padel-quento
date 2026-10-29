import { timingSafeEqual } from "node:crypto";
import { cancelExpiredMatches } from "@/src/actions/match";
import { awardAttendancePoints } from "@/src/actions/attendance";
import { extendFixedBookings } from "@/src/actions/fixedBooking";
import type { ActionResult } from "@/src/lib/action-result";

/**
 * Procesos en segundo plano que, en un hosting serverless como Vercel (donde
 * no hay un servidor prendido todo el tiempo para los setInterval de
 * src/jobs), corre un programador externo llamando a /api/cron/<proceso>
 * (ver .github/workflows/cron.yml).
 */
const CRON_JOBS: Record<string, () => Promise<ActionResult<number>>> = {
  "open-match-expiration": cancelExpiredMatches,
  "attendance-points": awardAttendancePoints,
  "fixed-booking-extension": extendFixedBookings,
};

export type CronResult = { status: number; body: Record<string, unknown> };

/** El encabezado Authorization es "Bearer <CRON_SECRET>"; sin CRON_SECRET configurado no se acepta ninguno. */
function isAuthorized(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorization) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function runCronJob(job: string, authorization: string | null): Promise<CronResult> {
  if (!isAuthorized(authorization)) {
    return { status: 401, body: { error: "No autorizado" } };
  }

  const run = Object.hasOwn(CRON_JOBS, job) ? CRON_JOBS[job] : undefined;
  if (!run) {
    return { status: 404, body: { error: `No existe el proceso ${job}` } };
  }

  const result = await run();
  return result.success
    ? { status: 200, body: { job, processed: result.data } }
    : { status: 500, body: { job, error: result.error } };
}
