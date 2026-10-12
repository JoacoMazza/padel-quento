"use server";

import "reflect-metadata";
import { Between, In } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { Penalty } from "@/src/entities/Penalty";
import { BookingState } from "@/src/domain/enums";
import {
  computeAttendanceReport,
  type AttendanceReport,
  type AttendanceReportInput,
  type ReportPlayer,
} from "@/src/domain/attendance-report";
import { LATE_CANCELLATION_REASON, LATE_LEAVE_REASON } from "@/src/domain/late-cancellation";
import { getDataSource } from "@/src/lib/db";
import type { ActionResult } from "@/src/lib/action-result";
import { requireAdmin } from "@/src/lib/rbac";

// Solo los datos del jugador que muestra el reporte, ya como objeto plano.
function toReportPlayer(player: ReportPlayer): ReportPlayer {
  return { id: player.id, names: player.names, lastnames: player.lastnames, phoneNumber: player.phoneNumber };
}

/**
 * Reporte de asistencia efectiva, ausencias y cancelaciones tardías en un rango
 * de fechas, para monitorear el ausentismo del complejo. Cuenta la asistencia
 * (Booking.attended o, en partidos abiertos, MatchPlayer.attended de cada
 * jugador) de los turnos activos que empiezan en el rango y ya terminaron. Las
 * cancelaciones tardías se cuentan por las penalidades que generaron dentro del
 * rango (se registran aunque el jugador no tuviera puntos para descontar, ver
 * recordPointsMovement). Solo accesible por administradores.
 */
export async function getAttendanceReport(range: { from: Date; to: Date }): Promise<ActionResult<AttendanceReport>> {
  try {
    await requireAdmin();
    if (range.from.getTime() > range.to.getTime()) {
      return { success: false, error: "El rango de fechas no es válido." };
    }

    const dataSource = await getDataSource();
    const bookings = await dataSource.getRepository<Booking>("Booking").find({
      where: {
        fromDateTime: Between(range.from, range.to),
        bookingState: In([BookingState.RESERVED, BookingState.PAID]),
      },
      relations: { booker: true, match: { matchPlayers: { player: true } } },
    });
    const lateCancellations = await dataSource.getRepository<Penalty>("Penalty").find({
      where: {
        reason: In([LATE_CANCELLATION_REASON, LATE_LEAVE_REASON]),
        createdAt: Between(range.from, range.to),
      },
      relations: { player: true },
    });

    const now = Date.now();
    const attendances: AttendanceReportInput["attendances"] = [];
    for (const booking of bookings) {
      if (new Date(booking.fromDateTime).getTime() + booking.durationMinutes * 60_000 > now) continue;
      if (booking.match) {
        for (const matchPlayer of booking.match.matchPlayers ?? []) {
          attendances.push({ player: toReportPlayer(matchPlayer.player), attended: matchPlayer.attended });
        }
      } else if (booking.booker) {
        // Un turno previo a la migración puede no tener quien reservó.
        attendances.push({ player: toReportPlayer(booking.booker), attended: booking.attended });
      }
    }

    return {
      success: true,
      data: computeAttendanceReport({
        attendances,
        lateCancellations: lateCancellations.map((c) => ({ player: toReportPlayer(c.player) })),
      }),
    };
  } catch (error) {
    console.error("getAttendanceReport", error);
    return { success: false, error: "No se pudo generar el reporte de asistencia." };
  }
}
