"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, RefreshCw } from "lucide-react";
import { BookingState, CourtState } from "@/src/domain/enums";
import { getScheduleBoardData } from "@/src/actions/scheduleBoard";
import {
  SLOT_DURATION_MINUTES,
  buildSlotDate,
  dayOfWeekFromDate,
  formatLongDate,
  minutesToTimeLabel,
  parseISODate,
  rangesOverlap,
  timeStringToMinutes,
  toISODate,
} from "@/app/bookings/slot-utils";
import type { CourtProp, OutOfServiceProp, ScheduleProp } from "@/app/bookings/types";
import { mapBookingToAdminProp, type AdminBookingProp } from "@/app/admin/types";
import { AttendanceModal } from "@/app/admin/attendance-modal";

const DEFAULT_REFRESH_INTERVAL_MS = 15_000;
const MIN_REFRESH_INTERVAL_MS = 5_000;

/**
 * Configurable por env var para poder subir el intervalo en producción sin
 * tocar código: un refresco cada 15s en desarrollo no pesa, pero en un plan
 * gratuito puede acercarse rápido al límite de requests.
 */
function getRefreshIntervalMs(): number {
  const raw = Number(process.env.NEXT_PUBLIC_SCHEDULE_BOARD_REFRESH_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_REFRESH_INTERVAL_MS;
  return Math.max(raw, MIN_REFRESH_INTERVAL_MS);
}

const REFRESH_INTERVAL_MS = getRefreshIntervalMs();

type CellState = "available" | "reserved" | "pending" | "blocked" | "closed";

const CELL_STYLES: Record<CellState, string> = {
  available: "border border-line bg-card text-foreground/70",
  reserved: "bg-blue-500 text-white",
  pending: "bg-amber-500 text-white",
  blocked: "bg-danger text-white",
  closed: "bg-line/40 text-foreground/30",
};

const LEGEND: { state: Exclude<CellState, "closed">; label: string; swatch: string }[] = [
  { state: "available", label: "Disponible", swatch: "border border-line bg-card" },
  { state: "reserved", label: "Reservado", swatch: "bg-blue-500" },
  { state: "pending", label: "Partido abierto", swatch: "bg-amber-500" },
  { state: "blocked", label: "Bloqueado", swatch: "bg-danger" },
];

type BoardData = {
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: AdminBookingProp[];
  outOfServices: OutOfServiceProp[];
};

export function ScheduleBoard({ initialData }: { initialData: BoardData }) {
  const [data, setData] = useState<BoardData>(initialData);
  const [dateInput, setDateInput] = useState(() => toISODate(new Date()));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingProp | null>(null);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    async function refresh() {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsRefreshing(true);
      try {
        const result = await getScheduleBoardData();
        if (result.success) {
          setData({
            courts: result.data.courts.map((c) => ({ id: c.id, number: c.number, state: c.state, price: c.price })),
            schedules: result.data.schedules.map((s) => ({
              id: s.id,
              dayOfWeek: s.dayOfWeek,
              openingTime: String(s.openingTime),
              closingTime: String(s.closingTime),
              courtId: s.court?.id,
            })),
            bookings: result.data.bookings.map(mapBookingToAdminProp),
            outOfServices: result.data.outOfServices.map((o) => ({
              id: o.id,
              fromDateTime: new Date(o.fromDateTime),
              toDateTime: new Date(o.toDateTime),
              courtId: o.court?.id,
            })),
          });
          setLastUpdated(new Date());
          setRefreshError(null);
        } else {
          setRefreshError(result.error);
        }
      } catch {
        setRefreshError("No se pudo actualizar la turnera.");
      } finally {
        isFetchingRef.current = false;
        setIsRefreshing(false);
      }
    }

    refresh();
    const intervalId = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, []);

  const selectedDate = useMemo(() => parseISODate(dateInput), [dateInput]);
  const dayOfWeek = useMemo(() => dayOfWeekFromDate(selectedDate), [selectedDate]);

  const { courts, schedules, bookings, outOfServices } = data;

  const courtSchedules = useMemo(() => {
    return courts.map((court) => {
      const schedule = schedules.find((s) => s.courtId === court.id && s.dayOfWeek === dayOfWeek);
      return {
        court,
        openMinutes: schedule ? timeStringToMinutes(schedule.openingTime) : null,
        closeMinutes: schedule ? timeStringToMinutes(schedule.closingTime) : null,
      };
    });
  }, [courts, schedules, dayOfWeek]);

  const timeAxis = useMemo(() => {
    const opens = courtSchedules.map((c) => c.openMinutes).filter((v): v is number => v !== null);
    const closes = courtSchedules.map((c) => c.closeMinutes).filter((v): v is number => v !== null);
    if (opens.length === 0 || closes.length === 0) return [];

    const earliestOpen = Math.min(...opens);
    const latestClose = Math.max(...closes);
    const slots: number[] = [];
    for (
      let minutesOfDay = earliestOpen;
      minutesOfDay + SLOT_DURATION_MINUTES <= latestClose;
      minutesOfDay += SLOT_DURATION_MINUTES
    ) {
      slots.push(minutesOfDay);
    }
    return slots;
  }, [courtSchedules]);

  function cellInfo(
    court: CourtProp,
    openMinutes: number | null,
    closeMinutes: number | null,
    minutesOfDay: number,
  ): { state: CellState; booking?: AdminBookingProp } {
    if (openMinutes === null || closeMinutes === null) return { state: "closed" };
    if (minutesOfDay < openMinutes || minutesOfDay + SLOT_DURATION_MINUTES > closeMinutes) {
      return { state: "closed" };
    }

    const start = buildSlotDate(selectedDate, minutesOfDay);
    const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60_000);

    if (court.state !== CourtState.AVAILABLE) return { state: "blocked" };

    const isBlockedByOutOfService = outOfServices.some(
      (o) =>
        o.courtId === court.id &&
        rangesOverlap(start, end, new Date(o.fromDateTime), new Date(o.toDateTime)),
    );
    if (isBlockedByOutOfService) return { state: "blocked" };

    const overlappingBooking = bookings.find((b) => {
      if (b.courtId !== court.id || b.bookingState === BookingState.CANCELLED) return false;
      const bookingStart = new Date(b.fromDateTime);
      const bookingEnd = new Date(bookingStart.getTime() + b.durationMinutes * 60_000);
      return rangesOverlap(start, end, bookingStart, bookingEnd);
    });

    if (overlappingBooking?.needPlayers) return { state: "pending", booking: overlappingBooking };
    if (
      overlappingBooking?.bookingState === BookingState.RESERVED ||
      overlappingBooking?.bookingState === BookingState.PAID
    ) {
      return { state: "reserved", booking: overlappingBooking };
    }

    return { state: "available" };
  }

  function handleAttendanceUpdated(updated: AdminBookingProp) {
    setSelectedBooking(updated);
    setData((prev) => ({
      ...prev,
      bookings: prev.bookings.map((b) => (b.id === updated.id ? updated : b)),
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex items-center gap-3 rounded-xl border border-line bg-background px-4 py-2.5">
          <Calendar className="h-5 w-5 text-foreground/50" />
          <div className="flex flex-col">
            <span className="text-xs text-foreground/50">Fecha</span>
            <span className="text-sm font-semibold text-foreground">{formatLongDate(selectedDate)}</span>
          </div>
          <input
            type="date"
            value={dateInput}
            onClick={(event) => {
              event.currentTarget.showPicker?.();
            }}
            onChange={(event) => {
              if (!event.target.value) return;
              setDateInput(event.target.value);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-foreground/60">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full bg-emerald-500 ${
                isRefreshing ? "animate-ping" : "opacity-0"
              }`}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          En vivo{lastUpdated ? ` · actualizado ${lastUpdated.toLocaleTimeString("es-AR")}` : null}
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        </div>
      </div>

      {refreshError ? (
        <div className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm font-medium text-danger">
          {refreshError}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-line bg-background/60 px-4 py-3 text-left font-semibold text-foreground/70">
                Horario
              </th>
              {courtSchedules.map(({ court }) => (
                <th
                  key={court.id}
                  className="min-w-[120px] border-b border-line bg-background/60 px-3 py-3 text-center font-semibold text-foreground/70"
                >
                  Cancha {court.number}
                  {court.state !== CourtState.AVAILABLE ? (
                    <span className="mt-1 block text-[10px] font-bold uppercase tracking-wide text-danger">
                      Fuera de servicio
                    </span>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {timeAxis.length === 0 ? (
              <tr>
                <td colSpan={courtSchedules.length + 1} className="px-4 py-6 text-center text-foreground/60">
                  No hay horarios configurados para este día.
                </td>
              </tr>
            ) : (
              timeAxis.map((minutesOfDay) => (
                <tr key={minutesOfDay}>
                  <td className="sticky left-0 z-10 bg-card px-4 py-2.5 font-semibold text-foreground/70">
                    {minutesToTimeLabel(minutesOfDay)}
                  </td>
                  {courtSchedules.map(({ court, openMinutes, closeMinutes }) => {
                    const { state, booking } = cellInfo(court, openMinutes, closeMinutes, minutesOfDay);
                    const isClickable = booking !== undefined;
                    return (
                      <td key={court.id} className="px-2 py-1.5 text-center">
                        <span
                          role={isClickable ? "button" : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          onClick={isClickable ? () => setSelectedBooking(booking) : undefined}
                          title={isClickable ? "Ver y marcar asistencia" : undefined}
                          className={`inline-flex h-9 w-full items-center justify-center rounded-lg text-xs font-semibold ${CELL_STYLES[state]} ${isClickable ? "cursor-pointer" : ""}`}
                        >
                          {state === "closed" ? "—" : LEGEND.find((l) => l.state === state)?.label}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
            {courtSchedules.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-foreground/60">No hay canchas registradas.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-5 text-sm text-foreground/70">
        {LEGEND.map(({ state, label, swatch }) => (
          <span key={state} className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-full ${swatch}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full bg-line/40" />
          Fuera de horario
        </span>
      </div>

      {selectedBooking ? (
        <AttendanceModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={handleAttendanceUpdated}
        />
      ) : null}
    </div>
  );
}
