"use client";

import { useState, useTransition } from "react";
import { CourtState } from "@/src/domain/enums";
import { updateCourt } from "@/src/actions/court";

const STATE_LABELS: Record<CourtState, string> = {
  [CourtState.AVAILABLE]: "Disponible",
  [CourtState.OUT_OF_SERVICE]: "Fuera de Servicio",
  [CourtState.MAINTENANCE]: "Mantenimiento",
  [CourtState.CLOSED_DOWN]: "Dada de Baja",
};

const STATE_BADGE_STYLES: Record<CourtState, { badge: string; dot: string }> = {
  [CourtState.AVAILABLE]: {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  [CourtState.OUT_OF_SERVICE]: {
    badge: "bg-danger/10 text-danger",
    dot: "bg-danger",
  },
  [CourtState.MAINTENANCE]: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  [CourtState.CLOSED_DOWN]: {
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
    dot: "bg-slate-500",
  },
};

type CourtItem = { id: number; number: number; state: CourtState };

export function CourtsManager({ courts: initialCourts }: { courts: CourtItem[] }) {
  const [courts, setCourts] = useState(initialCourts);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<
    { id: number; type: "success" | "error"; message: string } | null
  >(null);
  const [isPending, startTransition] = useTransition();

  function handleStateChange(courtId: number, nextState: CourtState) {
    const previousCourts = courts;
    setFeedback(null);
    setPendingId(courtId);
    setCourts((prev) => prev.map((c) => (c.id === courtId ? { ...c, state: nextState } : c)));

    startTransition(async () => {
      const result = await updateCourt(courtId, { state: nextState });

      if (!result.success) {
        setCourts(previousCourts);
        setFeedback({ id: courtId, type: "error", message: result.error });
      } else {
        setFeedback({ id: courtId, type: "success", message: "Estado actualizado correctamente." });
      }
      setPendingId(null);
    });
  }

  if (courts.length === 0) {
    return <p className="text-sm text-foreground/60">No hay canchas registradas todavía.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courts.map((court) => {
        const style = STATE_BADGE_STYLES[court.state];
        const isSaving = isPending && pendingId === court.id;
        const rowFeedback = feedback?.id === court.id ? feedback : null;

        return (
          <div key={court.id} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-foreground">Cancha {court.number}</h3>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                {STATE_LABELS[court.state]}
              </span>
            </div>

            <div className="mt-4 border-t border-line pt-4">
              <label
                htmlFor={`court-state-${court.id}`}
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-foreground/70"
              >
                Cambiar estado
              </label>
              <select
                id={`court-state-${court.id}`}
                value={court.state}
                disabled={isSaving}
                onChange={(e) => handleStateChange(court.id, e.target.value as CourtState)}
                className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
              >
                {Object.values(CourtState).map((state) => (
                  <option key={state} value={state}>
                    {STATE_LABELS[state]}
                  </option>
                ))}
              </select>

              {isSaving ? (
                <p className="mt-2 text-xs text-foreground/50">Guardando...</p>
              ) : rowFeedback ? (
                <p
                  className={`mt-2 text-xs font-medium ${
                    rowFeedback.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-danger"
                  }`}
                >
                  {rowFeedback.message}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
