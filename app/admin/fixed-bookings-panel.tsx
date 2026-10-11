"use client";

import { Fragment, useState } from "react";
import { CalendarDays, CalendarX, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { DayOfWeek, FixedBookingDateState, FixedBookingFrequency } from "@/src/domain/enums";
import { dayOfWeekOfISO } from "@/src/domain/fixed-booking";
import {
  cancelFixedBooking,
  createFixedBooking,
  getFixedBookingsAdmin,
  releaseFixedBookingDate,
  restoreFixedBookingDate,
  type FixedBookingAdminItem,
  type FixedBookingHolder,
} from "@/src/actions/fixedBooking";

export type FixedBookingCourtOption = { id: number; number: number };
export type FixedBookingPlayerOption = { id: number; name: string; phoneNumber: string };

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

const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70";

function formatDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${DAY_LABELS[dayOfWeekOfISO(iso)]} ${day}/${month}`;
}

function formatShortDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Sección "Turnos Fijos" del panel (HU-41): alta de turnos fijos semanales o
 * quincenales, y gestión de sus próximas fechas (liberar o restaurar una sola
 * fecha) o baja del turno fijo completo.
 */
export function FixedBookingsPanel({
  fixedBookings: initialFixedBookings,
  courts,
  players,
}: {
  fixedBookings: FixedBookingAdminItem[];
  courts: FixedBookingCourtOption[];
  players: FixedBookingPlayerOption[];
}) {
  const [fixedBookings, setFixedBookings] = useState(initialFixedBookings);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [confirmingCancelId, setConfirmingCancelId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function reload() {
    const result = await getFixedBookingsAdmin();
    if (result.success) setFixedBookings(result.data);
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
    setIsCreating(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">
          Turnos que se reservan solos todas las semanas o cada dos semanas. Los jugadores solo ven el horario como
          reservado.
        </p>
        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Nuevo turno fijo
        </button>
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
                              className="cursor-pointer rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:opacity-50"
                            >
                              Sí, dar de baja
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmingCancelId(null)}
                              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-line/40"
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
                              className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:bg-line/40 hover:text-foreground"
                            >
                              <CalendarDays className="h-4 w-4" />
                            </button>
                            {fixed.isActive ? (
                              <button
                                type="button"
                                aria-label={`Dar de baja el turno fijo de la cancha ${fixed.courtNumber}`}
                                title="Dar de baja"
                                onClick={() => setConfirmingCancelId(fixed.id)}
                                className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:bg-danger/10 hover:text-danger"
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
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
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
                                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
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
          onClose={() => setIsCreating(false)}
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
  const [startTime, setStartTime] = useState("18:00");
  const [frequency, setFrequency] = useState(FixedBookingFrequency.WEEKLY);
  const [endDate, setEndDate] = useState("");
  const [holderType, setHolderType] = useState<"player" | "guest">("player");
  const [playerId, setPlayerId] = useState("");
  const [names, setNames] = useState("");
  const [lastnames, setLastnames] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const holder: FixedBookingHolder =
      holderType === "player" ? { playerId: Number(playerId) } : { names, lastnames, phoneNumber };
    const result = await createFixedBooking({
      courtId,
      startDate,
      startTime,
      frequency,
      endDate: endDate || null,
      holder,
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
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Nuevo turno fijo</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
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
            <div>
              <label htmlFor="fixed-start-date" className={LABEL_CLASS}>
                Fecha de inicio
              </label>
              <input
                id="fixed-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="fixed-start-time" className={LABEL_CLASS}>
                Hora
              </label>
              <input
                id="fixed-start-time"
                type="time"
                step={1800}
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>
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
            <div>
              <label htmlFor="fixed-end-date" className={LABEL_CLASS}>
                Fecha de fin (opcional)
              </label>
              <input
                id="fixed-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <fieldset>
            <legend className={LABEL_CLASS}>Titular</legend>
            <div className="mb-3 flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="holder-type"
                  checked={holderType === "player"}
                  onChange={() => setHolderType("player")}
                />
                Jugador registrado
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="holder-type"
                  checked={holderType === "guest"}
                  onChange={() => setHolderType("guest")}
                />
                Sin cuenta
              </label>
            </div>

            {holderType === "player" ? (
              <div>
                <label htmlFor="fixed-player" className={LABEL_CLASS}>
                  Jugador
                </label>
                <select
                  id="fixed-player"
                  required
                  value={playerId}
                  onChange={(e) => setPlayerId(e.target.value)}
                  className={INPUT_CLASS}
                >
                  <option value="">Elegí un jugador</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} ({player.phoneNumber})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fixed-names" className={LABEL_CLASS}>
                      Nombre
                    </label>
                    <input
                      id="fixed-names"
                      required
                      value={names}
                      onChange={(e) => setNames(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="fixed-lastnames" className={LABEL_CLASS}>
                      Apellido
                    </label>
                    <input
                      id="fixed-lastnames"
                      required
                      value={lastnames}
                      onChange={(e) => setLastnames(e.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="fixed-phone" className={LABEL_CLASS}>
                    Teléfono
                  </label>
                  <input
                    id="fixed-phone"
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}
          </fieldset>

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-line/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Creando..." : "Crear turno fijo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
