"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CalendarDays, CalendarX, RotateCcw, Trash2, X } from "lucide-react";
import { DayOfWeek, FixedBookingDateState, FixedBookingFrequency } from "@/src/domain/enums";
import { dayOfWeekOfISO } from "@/src/domain/fixed-booking";
import {
  cancelFixedBooking,
  createFixedBooking,
  getFixedBookingsAdmin,
  releaseFixedBookingDate,
  restoreFixedBookingDate,
  type FixedBookingAdminItem,
} from "@/src/actions/fixedBooking";
import { getAvailableSlotsAdmin } from "@/src/actions/adminBooking";
import {
  EMPTY_HOLDER,
  HolderFields,
  INPUT_CLASS,
  LABEL_CLASS,
  toBookingHolder,
  type HolderPlayerOption,
} from "@/app/admin/holder-fields";
import { DateField } from "@/app/admin/date-field";

export type FixedBookingCourtOption = { id: number; number: number };
export type FixedBookingPlayerOption = HolderPlayerOption;

const DAY_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: "Lunes",
  [DayOfWeek.TUESDAY]: "Martes",
  [DayOfWeek.WEDNESDAY]: "Miércoles",
  [DayOfWeek.THURSDAY]: "Jueves",
  [DayOfWeek.FRIDAY]: "Viernes",
  [DayOfWeek.SATURDAY]: "Sábado",
  [DayOfWeek.SUNDAY]: "Domingo",
};

const FREQUENCY_LABELS: Record<FixedBookingFrequency, string> = {
  [FixedBookingFrequency.WEEKLY]: "Semanal",
  [FixedBookingFrequency.BIWEEKLY]: "Quincenal",
};

const DATE_STATE_LABELS: Record<FixedBookingDateState, { label: string; style: string }> = {
  [FixedBookingDateState.BOOKED]: { label: "Reservada", style: "bg-blue-500/10 text-blue-600" },
  [FixedBookingDateState.RELEASED]: { label: "Liberada", style: "bg-line/60 text-foreground/70" },
  [FixedBookingDateState.CONFLICT]: { label: "Ocupada por otro turno", style: "bg-amber-500/10 text-amber-600" },
};

function formatDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${DAY_LABELS[dayOfWeekOfISO(iso)]} ${day}/${month}`;
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Turnos fijos (HU-41), debajo de la grilla de la Turnera Global: listado con
 * sus próximas fechas (liberar o restaurar una sola fecha) y baja del turno
 * fijo completo. El alta se abre desde el botón junto a Actualizar
 * (isCreating), y onChanged avisa para refrescar la grilla. El listado se
 * vuelve a pedir cuando cambia refreshKey (por ejemplo, al liberar una fecha
 * desde la grilla).
 */
export function FixedBookingsPanel({
  fixedBookings: initialFixedBookings,
  courts,
  players,
  isCreating,
  onCloseCreate,
  onChanged,
  refreshKey = 0,
}: {
  fixedBookings: FixedBookingAdminItem[];
  courts: FixedBookingCourtOption[];
  players: FixedBookingPlayerOption[];
  isCreating: boolean;
  onCloseCreate: () => void;
  onChanged: () => void;
  refreshKey?: number;
}) {
  const [fixedBookings, setFixedBookings] = useState(initialFixedBookings);
  const lastRefreshKeyRef = useRef(refreshKey);
  const lastRequestIdRef = useRef(0);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Si se superponen dos pedidos del listado, solo cuenta la respuesta del último.
  async function fetchFixedBookings() {
    const requestId = ++lastRequestIdRef.current;
    try {
      const result = await getFixedBookingsAdmin();
      if (requestId !== lastRequestIdRef.current) return;
      if (result.success) setFixedBookings(result.data);
      else setError(result.error);
    } catch {
      if (requestId === lastRequestIdRef.current) setError("No se pudo actualizar el listado de turnos fijos.");
    }
  }

  useEffect(() => {
    if (refreshKey === lastRefreshKeyRef.current) return;
    lastRefreshKeyRef.current = refreshKey;
    fetchFixedBookings();
  }, [refreshKey]);

  async function reload() {
    onChanged();
    await fetchFixedBookings();
  }

  async function run(action: () => Promise<{ success: boolean; error?: string }>) {
    setError(null);
    setNotice(null);
    setPending(true);
    const result = await action();
    setPending(false);
    if (!result.success) {
      setError(result.error ?? "No se pudo completar la operación.");
      return;
    }
    await reload();
  }

  async function handleCancel(id: number) {
    setConfirmingCancelId(null);
    await run(() => cancelFixedBooking(id));
  }

  async function handleCreated(conflicts: string[]) {
    onCloseCreate();
    setError(null);
    setNotice(
      conflicts.length > 0
        ? `Turno fijo creado. No se reservaron estas fechas porque ya estaban ocupadas: ${conflicts.join(", ")}.`
        : "Turno fijo creado.",
    );
    await reload();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">Turnos fijos</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Turnos que se reservan solos todas las semanas o cada dos semanas. Los jugadores solo ven el horario como
          reservado.
        </p>
      </div>

      {notice ? <p className="text-sm font-medium text-success">{notice}</p> : null}
      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      {fixedBookings.length === 0 ? (
        <p className="text-sm text-foreground/60">Todavía no hay turnos fijos.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-background/60">
              <tr>
                <th className="px-5 py-3 font-semibold text-foreground/70">Cancha</th>
                <th className="px-5 py-3 font-semibold text-foreground/70">Día y hora</th>
                <th className="px-5 py-3 font-semibold text-foreground/70">Frecuencia</th>
                <th className="px-5 py-3 font-semibold text-foreground/70">Titular</th>
                <th className="px-5 py-3 font-semibold text-foreground/70">Vigencia</th>
                <th className="px-5 py-3 font-semibold text-foreground/70">Estado</th>
                <th className="px-5 py-3 text-right font-semibold text-foreground/70">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {fixedBookings.map((fixed) => (
                <Fragment key={fixed.id}>
                  <tr>
                    <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">
                      Cancha {fixed.courtNumber}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {DAY_LABELS[dayOfWeekOfISO(fixed.startDate)]} {fixed.startTime}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">{FREQUENCY_LABELS[fixed.frequency]}</td>
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-foreground">{fixed.holderName}</span>
                      <span className="block text-xs text-foreground/60">{fixed.holderPhoneNumber}</span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/70">
                      Desde {formatShortDate(fixed.startDate)}
                      {fixed.endDate ? ` hasta ${formatShortDate(fixed.endDate)}` : ""}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                          fixed.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-line/60 text-foreground/60"
                        }`}
                      >
                        {fixed.isActive ? "Activo" : "Dado de baja"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        {confirmingCancelId === fixed.id ? (
                          <>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => handleCancel(fixed.id)}
                              className="cursor-pointer rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold touch-target text-white hover:bg-danger/90 disabled:opacity-50"
                            >
                              Sí, dar de baja
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingCancelId(null)}
                              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold touch-target text-foreground/70 hover:bg-line/40"
                            >
                              Volver
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              aria-label={`Ver fechas del turno fijo de la cancha ${fixed.courtNumber}`}
                              title="Próximas fechas"
                              onClick={() => setExpandedId(expandedId === fixed.id ? null : fixed.id)}
                              className="cursor-pointer rounded-lg p-2 text-foreground/60 touch-target hover:bg-line/40 hover:text-foreground"
                            >
                              <CalendarDays className="h-4 w-4" />
                            </button>
                            {fixed.isActive ? (
                              <button
                                type="button"
                                aria-label={`Dar de baja el turno fijo de la cancha ${fixed.courtNumber}`}
                                title="Dar de baja"
                                onClick={() => setConfirmingCancelId(fixed.id)}
                                className="cursor-pointer rounded-lg p-2 text-foreground/60 touch-target hover:bg-danger/10 hover:text-danger"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === fixed.id ? (
                    <tr>
                      <td colSpan={7} className="bg-background/40 px-5 py-3">
                        {fixed.upcomingDates.length === 0 ? (
                          <p className="text-xs text-foreground/60">No hay próximas fechas.</p>
                        ) : (
                          <ul className="divide-y divide-line/60">
                            {fixed.upcomingDates.map((date) => {
                              const { label, style } = DATE_STATE_LABELS[date.state];
                              return (
                                <li key={date.id} className="flex items-center justify-between gap-3 py-2">
                                  <span className="text-sm text-foreground">{formatDate(date.date)}</span>
                                  <span className="flex items-center gap-2">
                                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>
                                      {label}
                                    </span>
                                    {fixed.isActive && date.state === FixedBookingDateState.BOOKED ? (
                                      <button
                                        type="button"
                                        disabled={pending}
                                        aria-label={`Liberar la fecha ${date.date}`}
                                        onClick={() => run(() => releaseFixedBookingDate(date.id))}
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold touch-target text-danger hover:bg-danger/10 disabled:opacity-50"
                                      >
                                        <CalendarX className="h-3.5 w-3.5" />
                                        Liberar
                                      </button>
                                    ) : null}
                                    {fixed.isActive && date.state !== FixedBookingDateState.BOOKED ? (
                                      <button
                                        type="button"
                                        disabled={pending}
                                        aria-label={`Restaurar la fecha ${date.date}`}
                                        onClick={() => run(() => restoreFixedBookingDate(date.id))}
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold touch-target text-primary hover:bg-primary/10 disabled:opacity-50"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Restaurar
                                      </button>
                                    ) : null}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreating ? (
        <CreateFixedBookingModal
          courts={courts}
          players={players}
          onClose={onCloseCreate}
          onCreated={handleCreated}
        />
      ) : null}
    </div>
  );
}

function CreateFixedBookingModal({
  courts,
  players,
  onClose,
  onCreated,
}: {
  courts: FixedBookingCourtOption[];
  players: FixedBookingPlayerOption[];
  onClose: () => void;
  onCreated: (conflicts: string[]) => void;
}) {
  const [courtId, setCourtId] = useState(courts[0]?.id ?? 0);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  // Horarios libres de la última cancha y fecha de inicio consultadas.
  const [loadedSlots, setLoadedSlots] = useState<{ key: string; slots: string[] } | null>(null);
  const [frequency, setFrequency] = useState(FixedBookingFrequency.WEEKLY);
  const [endDate, setEndDate] = useState("");
  const [holder, setHolder] = useState(EMPTY_HOLDER);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // null mientras se consultan los de la cancha y la fecha elegidas (o si falta la fecha).
  const slots = loadedSlots?.key === `${courtId}|${startDate}` ? loadedSlots.slots : null;

  // Solo se ofrecen las horas de los turnos de la grilla (cada 90 minutos desde
  // la apertura) que están libres la fecha de inicio; al cambiar la cancha o la
  // fecha se vuelven a pedir.
  useEffect(() => {
    if (!startDate) return;
    let cancelled = false;
    getAvailableSlotsAdmin({ courtId, date: startDate }).then((result) => {
      if (cancelled) return;
      const free = result.success ? result.data : [];
      if (!result.success) setError(result.error);
      setLoadedSlots({ key: `${courtId}|${startDate}`, slots: free });
      setStartTime((current) => (free.includes(current) ? current : ""));
    });
    return () => {
      cancelled = true;
    };
  }, [courtId, startDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await createFixedBooking({
      courtId,
      startDate,
      startTime,
      frequency,
      endDate: endDate || null,
      holder: toBookingHolder(holder),
    });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onCreated(result.data.conflicts);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Nuevo turno fijo</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 touch-target hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fixed-court" className={LABEL_CLASS}>
              Cancha
            </label>
            <select
              id="fixed-court"
              value={courtId}
              onChange={(e) => setCourtId(Number(e.target.value))}
              className={INPUT_CLASS}
            >
              {courts.map((court) => (
                <option key={court.id} value={court.id}>
                  Cancha {court.number}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateField id="fixed-start-date" label="Fecha de inicio" required value={startDate} onChange={setStartDate} />
            <div>
              <label htmlFor="fixed-start-time" className={LABEL_CLASS}>
                Hora
              </label>
              <select
                id="fixed-start-time"
                required
                disabled={!slots || slots.length === 0}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">
                  {!startDate ? "Elegí la fecha de inicio" : slots ? "Elegí un horario" : "Cargando horarios…"}
                </option>
                {slots?.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {slots && slots.length === 0 ? (
            <p className="-mt-2 text-xs font-medium text-danger">No hay horarios libres en esa cancha ese día.</p>
          ) : null}
          {startDate ? (
            <p className="-mt-2 text-xs text-foreground/60">
              Se repite los {DAY_LABELS[dayOfWeekOfISO(startDate)].toLowerCase()}.
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="fixed-frequency" className={LABEL_CLASS}>
                Frecuencia
              </label>
              <select
                id="fixed-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as FixedBookingFrequency)}
                className={INPUT_CLASS}
              >
                <option value={FixedBookingFrequency.WEEKLY}>Semanal</option>
                <option value={FixedBookingFrequency.BIWEEKLY}>Quincenal (cada 2 semanas)</option>
              </select>
            </div>
            <DateField id="fixed-end-date" label="Fecha de fin (opcional)" value={endDate} onChange={setEndDate} />
          </div>

          <HolderFields idPrefix="fixed" players={players} value={holder} onChange={setHolder} />

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm touch-target font-medium hover:bg-line/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !slots || slots.length === 0}
              className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm touch-target font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Creando..." : "Crear turno fijo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
