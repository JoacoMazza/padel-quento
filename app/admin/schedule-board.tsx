"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { getNextSlotChange } from "@/app/admin/schedule-refresh";
import { dateToClockLabel } from "@/src/domain/time-format";

type CellState = "available" | "reserved" | "fixed" | "pending" | "blocked" | "closed";

const CELL_STYLES: Record<CellState, string> = {
  available: "border border-line bg-card text-success",
  reserved: "bg-ink text-white hover:bg-ink-soft",
  fixed: "bg-occupied text-white hover:bg-occupied/85",
  pending: "border border-primary/25 bg-primary-light text-primary hover:border-primary/60",
  blocked: "bg-danger-light text-danger",
  closed: "border border-dashed border-line text-foreground/30",
};

const LEGEND: { state: Exclude<CellState, "closed">; label: string; swatch: string }[] = [
  { state: "available", label: "Disponible", swatch: "border border-line bg-card" },
  { state: "reserved", label: "Reservado", swatch: "bg-ink" },
  { state: "fixed", label: "Turno fijo", swatch: "bg-occupied" },
  { state: "pending", label: "Partido abierto", swatch: "border border-primary/40 bg-primary-light" },
  { state: "blocked", label: "Bloqueado", swatch: "bg-danger-light border border-danger/30" },
];

type BoardData = {
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: AdminBookingProp[];
  outOfServices: OutOfServiceProp[];
};

const EMPTY_BOARD: BoardData = { courts: [], schedules: [], bookings: [], outOfServices: [] };

/**
 * Pide sus datos al montarse y, mientras está visible (isActive), los refresca
 * solo cuando cambia de turno (ver getNextSlotChange) o cuando el admin hace
 * click en Actualizar: oculta en el panel conserva lo último obtenido sin seguir consultando.
 * También se refresca cuando cambia refreshKey (por ejemplo, al crear o liberar
 * un turno fijo). toolbarActions se muestra junto al botón Actualizar. Con
 * onFixedBookingDateReleased avisa cuando se libera una fecha de turno fijo
 * desde el detalle de un turno. Con onAvailableSlotClick, las celdas disponibles que todavía no empezaron se
 * pueden clickear para agendar un turno en esa cancha, día y hora.
 */
export function ScheduleBoard({
  isActive = true,
  refreshKey = 0,
  toolbarActions,
  onAvailableSlotClick,
  onFixedBookingDateReleased,
}: {
  isActive?: boolean;
  refreshKey?: number;
  toolbarActions?: ReactNode;
  onAvailableSlotClick?: (slot: { courtId: number; date: string; startTime: string }) => void;
  onFixedBookingDateReleased?: () => void;
}) {
  const [data, setData] = useState<BoardData>(EMPTY_BOARD);
  const [dateInput, setDateInput] = useState(() => toISODate(new Date()));
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingProp | null>(null);
  const isFetchingRef = useRef(false);
  // Pedido de refresco que llegó con otro en curso (por ejemplo, al crear un
  // turno fijo): se repite al terminar para no mostrar datos de antes del cambio.
  const pendingRefreshRef = useRef(false);
  const hasLoadedRef = useRef(false);
  const lastAttemptRef = useRef<Date | null>(null);
  const lastRefreshKeyRef = useRef(refreshKey);

  const refresh = useCallback(async () => {
    if (isFetchingRef.current) {
      pendingRefreshRef.current = true;
      return;
    }
    isFetchingRef.current = true;
    setIsRefreshing(true);
    do {
      pendingRefreshRef.current = false;
      lastAttemptRef.current = new Date();
      try {
        const result = await getScheduleBoardData();
        if (result.success) {
          const fixedDates = new Map(
            result.data.fixedBookingDates.map(({ bookingId, fixedBookingDateId }) => [bookingId, fixedBookingDateId]),
          );
          setData({
            courts: result.data.courts.map((c) => ({ id: c.id, number: c.number, state: c.state, price: c.price })),
            schedules: result.data.schedules.map((s) => ({
              id: s.id,
              dayOfWeek: s.dayOfWeek,
              openingTime: String(s.openingTime),
              closingTime: String(s.closingTime),
              courtId: s.court?.id,
            })),
            bookings: result.data.bookings.map((b) => mapBookingToAdminProp(b, fixedDates.get(b.id) ?? null)),
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
      }
    } while (pendingRefreshRef.current);
    isFetchingRef.current = false;
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    if (!isActive || hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    refresh();
  }, [isActive, refresh]);

  useEffect(() => {
    if (refreshKey === lastRefreshKeyRef.current) return;
    lastRefreshKeyRef.current = refreshKey;
    refresh();
  }, [refreshKey, refresh]);

  // Se reprograma tras cada intento de refresco (isRefreshing vuelve a false) y
  // al volver a la sección. El próximo cambio se cuenta desde el último intento:
  // si ya pasó mientras la sección estaba oculta, se actualiza en el acto.
  useEffect(() => {
    if (!isActive || isRefreshing) return;
    const nextChange = getNextSlotChange(lastAttemptRef.current ?? new Date(), data.schedules);
    if (!nextChange) return;
    const timeoutId = setTimeout(refresh, Math.max(nextChange.getTime() - Date.now(), 0));
    return () => clearTimeout(timeoutId);
  }, [isActive, isRefreshing, data.schedules, refresh]);

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
      return { state: overlappingBooking.fixedBookingDateId ? "fixed" : "reserved", booking: overlappingBooking };
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
      <div className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex items-center gap-3 rounded-xl border border-line bg-background px-4 py-2.5">
          <Calendar className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <span className="label-caps">Fecha</span>
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
          En vivo{lastUpdated ? ` · actualizado ${dateToClockLabel(lastUpdated)}` : null}
          <button
            type="button"
            aria-label="Actualizar turnera"
            title="Actualizar"
            disabled={isRefreshing}
            onClick={refresh}
            className="btn btn-sm btn-dark ml-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Actualizar
          </button>
          {toolbarActions}
        </div>
      </div>

      {refreshError ? (
        <div className="alert-error">
          {refreshError}
        </div>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="table-head sticky left-0 z-10 border-b border-line bg-background">Horario</th>
              {courtSchedules.map(({ court }) => (
                <th
                  key={court.id}
                  className="min-w-[120px] border-b border-line bg-background px-3 py-3 text-center text-sm font-bold text-foreground"
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
                  <td className="sticky left-0 z-10 bg-card px-5 py-2.5 font-extrabold text-foreground tabular-nums">
                    {minutesToTimeLabel(minutesOfDay)}
                  </td>
                  {courtSchedules.map(({ court, openMinutes, closeMinutes }) => {
                    const { state, booking } = cellInfo(court, openMinutes, closeMinutes, minutesOfDay);
                    const canSchedule =
                      state === "available" &&
                      onAvailableSlotClick !== undefined &&
                      buildSlotDate(selectedDate, minutesOfDay).getTime() > Date.now();
                    const isClickable = booking !== undefined || canSchedule;
                    const handleClick = booking
                      ? () => setSelectedBooking(booking)
                      : canSchedule
                        ? () =>
                            onAvailableSlotClick({
                              courtId: court.id,
                              date: dateInput,
                              startTime: minutesToTimeLabel(minutesOfDay),
                            })
                        : undefined;
                    return (
                      <td key={court.id} className="px-2 py-1.5 text-center">
                        <span
                          role={isClickable ? "button" : undefined}
                          tabIndex={isClickable ? 0 : undefined}
                          data-state={state}
                          onClick={handleClick}
                          title={booking ? "Ver y marcar asistencia" : canSchedule ? "Agendar turno" : undefined}
                          className={`inline-flex h-10 w-full items-center justify-center rounded-lg text-xs font-semibold transition-colors ${CELL_STYLES[state]} ${isClickable ? "cursor-pointer" : ""} ${canSchedule ? "group hover:border-success hover:bg-success-light" : ""}`}
                        >
                          {state === "closed" ? (
                            "—"
                          ) : canSchedule ? (
                            // Al pasar el mouse, la celda libre indica que se puede agendar ahí.
                            <>
                              <span className="group-hover:hidden">Disponible</span>
                              <span className="hidden group-hover:inline">+ Agendar</span>
                            </>
                          ) : (
                            LEGEND.find((l) => l.state === state)?.label
                          )}
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
          <span className="h-3.5 w-3.5 rounded-full border border-dashed border-foreground/30" />
          Fuera de horario
        </span>
      </div>

      {selectedBooking ? (
        <AttendanceModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onUpdated={handleAttendanceUpdated}
          onReleased={() => {
            setSelectedBooking(null);
            refresh();
            onFixedBookingDateReleased?.();
          }}
        />
      ) : null}
    </div>
  );
}
