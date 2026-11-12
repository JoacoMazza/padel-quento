/**
 * Inasistencias de un turno: el administrador las marca y se descuentan en el
 * momento, ligadas al turno (penalties.booking_id). No es una Server Action:
 * la llama src/actions/attendance.ts después de verificar que es un admin.
 */
import "reflect-metadata";
import type { Penalty } from "@/src/entities/Penalty";
import type { Player } from "@/src/entities/Player";
import { PENALTY_POINTS } from "@/src/domain/constants";
import { NO_SHOW_PENALTY_REASON } from "@/src/domain/attendance";
import { getDataSource } from "@/src/lib/db";
import { recordPointsMovement } from "@/src/actions/profile";

/**
 * Deja al jugador con la penalización que le corresponde por los ausentes que
 * tuvo en el turno: PENALTY_POINTS por cada uno (él o alguien de su grupo).
 * Reemplaza la que ya tenía, así que marcar de nuevo no penaliza dos veces y
 * volver a marcarlo presente le devuelve los puntos.
 */
export async function syncNoShowPenalty(bookingId: number, playerId: number, absentCount: number): Promise<void> {
  const dataSource = await getDataSource();
  const penalties = dataSource.getRepository<Penalty>("Penalty");
  const previous = await penalties.find({
    where: { booking: { id: bookingId }, player: { id: playerId }, reason: NO_SHOW_PENALTY_REASON },
  });
  if (previous.length > 0) {
    await penalties.remove(previous);
    // El saldo es la suma del historial (ver recordPointsMovement).
    const remaining = await penalties.find({ where: { player: { id: playerId } } });
    const scoring = remaining.reduce((sum, penalty) => sum + Number(penalty.penalizedScoring), 0);
    await dataSource.getRepository<Player>("Player").update(playerId, { scoring });
  }
  if (absentCount > 0) {
    await recordPointsMovement(playerId, PENALTY_POINTS * absentCount, "penalty", NO_SHOW_PENALTY_REASON, bookingId);
  }
}
