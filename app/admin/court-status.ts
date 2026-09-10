import { CourtState } from "@/src/domain/enums";

export const STATE_LABELS: Record<CourtState, string> = {
  [CourtState.AVAILABLE]: "Disponible",
  [CourtState.OUT_OF_SERVICE]: "Fuera de Servicio",
  [CourtState.MAINTENANCE]: "Mantenimiento",
  [CourtState.CLOSED_DOWN]: "Dada de Baja",
};

export const STATE_BADGE_STYLES: Record<CourtState, { badge: string; dot: string }> = {
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

export type CourtItem = { id: number; number: number; state: CourtState };
