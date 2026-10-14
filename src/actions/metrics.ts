"use server";

import "reflect-metadata";
import { Between, In, LessThan, MoreThan } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { Court } from "@/src/entities/Court";
import { OutOfService } from "@/src/entities/OutOfService";
import { Schedule } from "@/src/entities/Schedule";
import { BookingState } from "@/src/domain/enums";
import type { OccupancyInput } from "@/src/domain/occupancy";
import { getDataSource } from "@/src/lib/db";
import type { ActionResult } from "@/src/lib/action-result";
import { requireAdmin } from "@/src/lib/rbac";

export type OccupancyReportData = Omit<OccupancyInput, "from" | "to">;

/**
 * Datos crudos para las métricas de ocupación del panel admin en un rango de
 * fechas: canchas, horarios, turnos activos (reservados o pagos) que empiezan
 * en el rango y bloqueos que se cruzan con él. El cálculo de los porcentajes
 * (computeOccupancyMetrics) corre en el cliente con su hora local, igual que la
 * turnera. Solo accesible por administradores.
 */
export async function getOccupancyReportData(range: {
  from: Date;
  to: Date;
}): Promise<ActionResult<OccupancyReportData>> {
  try {
    await requireAdmin();
    if (range.from.getTime() > range.to.getTime()) {
      return { success: false, error: "El rango de fechas no es válido." };
    }

    const dataSource = await getDataSource();
    const courts = await dataSource.getRepository<Court>("Court").find();
    const schedules = await dataSource.getRepository<Schedule>("Schedule").find({ relations: { court: true } });
    const bookings = await dataSource.getRepository<Booking>("Booking").find({
      where: {
        fromDateTime: Between(range.from, range.to),
        bookingState: In([BookingState.RESERVED, BookingState.PAID]),
      },
      relations: { court: true },
    });
    const outOfServices = await dataSource.getRepository<OutOfService>("OutOfService").find({
      where: { fromDateTime: LessThan(range.to), toDateTime: MoreThan(range.from) },
      relations: { court: true },
    });

    // Solo los campos que usa el cálculo, ya como objetos planos (sin los registros sin cancha).
    return {
      success: true,
      data: {
        courts: courts.map((c) => ({ id: c.id, number: c.number })),
        schedules: schedules.filter((s) => s.court).map((s) => ({
          courtId: s.court.id,
          dayOfWeek: s.dayOfWeek,
          openingTime: String(s.openingTime),
          closingTime: String(s.closingTime),
        })),
        bookings: bookings.filter((b) => b.court).map((b) => ({
          courtId: b.court.id,
          fromDateTime: new Date(b.fromDateTime),
          durationMinutes: b.durationMinutes,
        })),
        outOfServices: outOfServices.filter((o) => o.court).map((o) => ({
          courtId: o.court.id,
          fromDateTime: new Date(o.fromDateTime),
          toDateTime: new Date(o.toDateTime),
        })),
      },
    };
  } catch (error) {
    console.error("getOccupancyReportData", error);
    return { success: false, error: "No se pudieron obtener las métricas de ocupación." };
  }
}
