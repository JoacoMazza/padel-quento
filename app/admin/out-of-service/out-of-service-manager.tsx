"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BellOff,
  CalendarClock,
  CalendarOff,
  CircleCheck,
  FileDown,
  LayoutGrid,
  Lock,
  Trash2,
  TriangleAlert,
  Unlock,
  X,
} from "lucide-react";
import { OutOfServiceReason } from "@/src/domain/enums";
import { createOutOfService, deleteOutOfService } from "@/src/actions/outOfService";
import { outOfServiceStatusLabel } from "@/app/admin/out-of-service/derive";
import { minutesToTimeLabel } from "@/app/bookings/slot-utils";
import type {
  CourtMonitorItem,
  CourtOption,
  OutOfServiceItem,
  OutOfServiceStats,
} from "@/app/admin/out-of-service/types";

const REASON_LABELS: Record<OutOfServiceReason, string> = {
  [OutOfServiceReason.MAINTENANCE]: "Mantenimiento",
  [OutOfServiceReason.FREE_DAY]: "Día libre / feriado",
  [OutOfServiceReason.CLEANING]: "Limpieza",
  [OutOfServiceReason.OTHER]: "Otro",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });

function formatRange(from: Date, to: Date) {
  return `${DATE_TIME_FORMATTER.format(from)} – ${DATE_TIME_FORMATTER.format(to)}`;
}

function timeLabel(date: Date) {
  return minutesToTimeLabel(date.getHours() * 60 + date.getMinutes());
}

type Feedback = { type: "error" | "success"; message: string };

export function OutOfServiceManager({
  courts,
  outOfServices,
  courtMonitorItems,
  stats,
}: {
  courts: CourtOption[];
  outOfServices: OutOfServiceItem[];
  courtMonitorItems: CourtMonitorItem[];
  stats: OutOfServiceStats;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const now = new Date();

  const [courtId, setCourtId] = useState<string>(courts[0] ? String(courts[0].id) : "");
  const [reason, setReason] = useState<OutOfServiceReason>(OutOfServiceReason.MAINTENANCE);
  const [description, setDescription] = useState("");
  const [fromLocal, setFromLocal] = useState("");
  const [toLocal, setToLocal] = useState("");

  function resetForm() {
    setDescription("");
    setFromLocal("");
    setToLocal("");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);

    if (!courtId || !fromLocal || !toLocal) {
      setFeedback({ type: "error", message: "Completá la cancha y el rango de fechas." });
      return;
    }

    const fromDateTime = new Date(fromLocal);
    const toDateTime = new Date(toLocal);
    if (toDateTime <= fromDateTime) {
      setFeedback({ type: "error", message: "La fecha de fin tiene que ser posterior a la de inicio." });
      return;
    }

    startTransition(async () => {
      const result = await createOutOfService({
        fromDateTime,
        toDateTime,
        reason,
        description: description.trim() || null,
        courtId: Number(courtId),
      });

      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      const cancelledCount = result.data.cancelledBookings.length;
      setFeedback({
        type: "success",
        message:
          cancelledCount > 0
            ? `Bloqueo creado. Se cancelaron ${cancelledCount} turno${cancelledCount === 1 ? "" : "s"} afectado${cancelledCount === 1 ? "" : "s"}, sin penalizar a los jugadores.`
            : "Bloqueo creado correctamente.",
      });
      resetForm();
      router.refresh();
    });
  }

  function handleDelete(id: number) {
    setFeedback(null);
    setDeletingId(null);
    startTransition(async () => {
      const result = await deleteOutOfService(id);
      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {feedback ? (
        <div
          className={`rounded-xl border p-4 text-sm font-medium ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-danger/30 bg-danger/10 text-danger"
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<LayoutGrid className="h-5 w-5" />}
          label="Canchas habilitadas"
          value={`${stats.courtsAvailable}/${stats.totalCourts}`}
          hint="en servicio"
        />
        <StatCard
          icon={<Lock className="h-5 w-5" />}
          label="Bloqueos activos"
          value={String(stats.activeBlocks)}
          hint={stats.activeBlocks === 1 ? "cancha en reparación" : "canchas en reparación"}
          tone={stats.activeBlocks > 0 ? "danger" : "default"}
        />
        <StatCard
          icon={<CalendarClock className="h-5 w-5" />}
          label="Turnos afectados hoy"
          value={String(stats.bookingsAffectedToday)}
          hint="cancelados sin penalización"
        />
        <StatCard
          icon={<CalendarOff className="h-5 w-5" />}
          label="Próximo mantenimiento"
          value={stats.nextService ? DATE_FORMATTER.format(stats.nextService.fromDateTime) : "—"}
          hint={stats.nextService ? `Cancha ${stats.nextService.courtNumber}` : "Sin bloqueos programados"}
        />
      </div>

      {/* Monitor visual de canchas */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Monitor Visual de Canchas</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {courtMonitorItems.map((court) => (
            <div key={court.id} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 text-sm font-bold text-foreground">
                  {String(court.number).padStart(2, "0")}
                </span>
                {court.activeBlock ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2.5 py-0.5 text-xs font-semibold text-danger">
                    <Lock className="h-3 w-3" />
                    Bloqueada
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CircleCheck className="h-3 w-3" />
                    Operativa
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm font-semibold text-foreground">Cancha {court.number}</p>

              {court.activeBlock ? (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-medium text-danger">
                    {REASON_LABELS[court.activeBlock.reason]}
                  </p>
                  <p className="text-xs text-foreground/60">{formatRange(court.activeBlock.fromDateTime, court.activeBlock.toDateTime)}</p>
                  {court.activeBlock.description ? (
                    <p className="text-xs text-foreground/60">{court.activeBlock.description}</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleDelete(court.activeBlock!.id)}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-xs font-semibold text-background transition-colors hover:opacity-90 disabled:opacity-50 cursor-pointer"
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    Desbloquear y habilitar
                  </button>
                </div>
              ) : (
                <div className="mt-2 space-y-1">
                  {court.currentBooking ? (
                    <p className="text-xs text-foreground/60">
                      Turno actual: {timeLabel(court.currentBooking.fromDateTime)} – {timeLabel(new Date(court.currentBooking.fromDateTime.getTime() + court.currentBooking.durationMinutes * 60_000))}
                    </p>
                  ) : court.nextBooking ? (
                    <p className="text-xs text-foreground/60">
                      Próximo turno: {timeLabel(court.nextBooking.fromDateTime)} hs
                    </p>
                  ) : (
                    <p className="text-xs text-foreground/60">Sin turnos en curso</p>
                  )}
                  {court.nextService ? (
                    <p className="text-xs text-foreground/50">
                      Próximo service: {DATE_TIME_FORMATTER.format(court.nextService.fromDateTime)}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          ))}
          {courtMonitorItems.length === 0 ? (
            <p className="text-sm text-foreground/60">No hay canchas cargadas.</p>
          ) : null}
        </div>
      </div>

      {/* Formulario de nuevo bloqueo */}
      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-line bg-card p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-foreground">Programar bloqueo por mantenimiento</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="courtId" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
              Cancha
            </label>
            <select
              id="courtId"
              value={courtId}
              onChange={(event) => setCourtId(event.target.value)}
              className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {courts.length === 0 ? <option value="">Sin canchas cargadas</option> : null}
              {courts.map((court) => (
                <option key={court.id} value={String(court.id)}>
                  Cancha {court.number}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reason" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
              Motivo
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as OutOfServiceReason)}
              className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {Object.entries(REASON_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fromLocal" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
              Desde
            </label>
            <input
              id="fromLocal"
              type="datetime-local"
              required
              value={fromLocal}
              onChange={(event) => setFromLocal(event.target.value)}
              className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="toLocal" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
              Hasta
            </label>
            <input
              id="toLocal"
              type="datetime-local"
              required
              value={toLocal}
              onChange={(event) => setToLocal(event.target.value)}
              className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="description" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Ej: cambio de red y luminarias"
            className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-line bg-background/60 p-4 opacity-60">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-foreground/40">
              <BellOff className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground/70">
                Notificación y Reubicación Inteligente
              </p>
              <p className="text-xs text-foreground/50">
                Avisar por WhatsApp/Email a los jugadores afectados y ofrecerles reasignación. Requiere el canal de WhatsApp (RF-02).
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            Próximamente
          </span>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || courts.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <CalendarOff className="h-4 w-4" />
            {isPending ? "Guardando…" : "Confirmar bloqueo"}
          </button>
        </div>
      </form>

      {/* Historial */}
      <div className="rounded-2xl border border-line bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Historial reciente</h2>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-foreground/40 cursor-not-allowed"
          >
            <FileDown className="h-3.5 w-3.5" />
            Descargar informe (PDF)
          </button>
        </div>

        {outOfServices.length === 0 ? (
          <p className="px-6 py-8 text-sm text-foreground/60">Todavía no hay bloqueos cargados.</p>
        ) : (
          <ul className="divide-y divide-line">
            {outOfServices.map((entry) => {
              const status = outOfServiceStatusLabel(entry, now);
              return (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                      <TriangleAlert className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Cancha {entry.courtNumber} · {REASON_LABELS[entry.reason]}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            status === "Activo ahora"
                              ? "bg-danger/10 text-danger"
                              : status === "Programado"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-line/60 text-foreground/60"
                          }`}
                        >
                          {status}
                        </span>
                      </p>
                      <p className="text-xs text-foreground/60">{formatRange(entry.fromDateTime, entry.toDateTime)}</p>
                      {entry.description ? (
                        <p className="mt-0.5 text-xs text-foreground/60">{entry.description}</p>
                      ) : null}
                    </div>
                  </div>

                  {deletingId === entry.id ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-foreground/60">¿Eliminar bloqueo?</span>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(entry.id)}
                        className="h-8 rounded-full bg-danger px-3 text-xs font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60 cursor-pointer"
                      >
                        Sí, eliminar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => setDeletingId(null)}
                        className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-foreground/60 hover:bg-line/40 cursor-pointer"
                        aria-label="Cancelar"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeletingId(entry.id)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-foreground/60 transition-colors hover:border-danger hover:text-danger cursor-pointer"
                      aria-label="Eliminar bloqueo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">{label}</span>
        <span className={tone === "danger" ? "text-danger" : "text-foreground/40"}>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone === "danger" ? "text-danger" : "text-foreground"}`}>
        {value}
      </p>
      <p className="mt-0.5 text-xs text-foreground/60">{hint}</p>
    </div>
  );
}
