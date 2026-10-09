import { CourtState, OutOfServiceReason } from "@/src/domain/enums";

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

export const OUT_OF_SERVICE_REASON_LABELS: Record<OutOfServiceReason, string> = {
  [OutOfServiceReason.MAINTENANCE]: "Mantenimiento",
  [OutOfServiceReason.FREE_DAY]: "Día libre",
  [OutOfServiceReason.CLEANING]: "Limpieza",
  [OutOfServiceReason.OTHER]: "Otro",
};

/**
 * Estados que se eligen al editar una cancha. Fuera de servicio y mantenimiento
 * no se setean a mano: surgen de un bloqueo (OutOfService) activo.
 */
export const EDITABLE_COURT_STATES = [CourtState.AVAILABLE, CourtState.CLOSED_DOWN];

/** Bloqueo vigente de la cancha (ver isOutOfServiceActive), si lo tiene. */
export type ActiveOutOfService = { id: number; reason: OutOfServiceReason; toDateTime: Date };

export type CourtItem = {
  id: number;
  number: number;
  state: CourtState;
  price: number;
  activeOutOfService: ActiveOutOfService | null;
};

/** Etiqueta y estilo del estado a mostrar: un bloqueo activo manda sobre el estado guardado. */
export function courtStatus(court: CourtItem): { label: string; style: { badge: string; dot: string } } {
  if (court.activeOutOfService) {
    return {
      label: `${STATE_LABELS[CourtState.OUT_OF_SERVICE]} (${OUT_OF_SERVICE_REASON_LABELS[court.activeOutOfService.reason]})`,
      style: STATE_BADGE_STYLES[CourtState.OUT_OF_SERVICE],
    };
  }
  return { label: STATE_LABELS[court.state], style: STATE_BADGE_STYLES[court.state] };
}
