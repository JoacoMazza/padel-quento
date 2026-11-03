import { CourtState, OutOfServiceReason } from "@/src/domain/enums";
import type { ComplexLocation } from "@/src/domain/complex";

export const STATE_LABELS: Record<CourtState, string> = {
  [CourtState.AVAILABLE]: "Disponible",
  [CourtState.OUT_OF_SERVICE]: "Fuera de Servicio",
  [CourtState.MAINTENANCE]: "Mantenimiento",
  [CourtState.CLOSED_DOWN]: "Dada de Baja",
};

export const STATE_BADGE_STYLES: Record<CourtState, { badge: string; dot: string }> = {
  [CourtState.AVAILABLE]: {
    badge: "badge-success",
    dot: "bg-success",
  },
  [CourtState.OUT_OF_SERVICE]: {
    badge: "badge-danger",
    dot: "bg-danger",
  },
  [CourtState.MAINTENANCE]: {
    badge: "badge-warning",
    dot: "bg-amber-500",
  },
  [CourtState.CLOSED_DOWN]: {
    badge: "badge-neutral",
    dot: "bg-foreground/40",
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
  /** Complejo donde está la cancha. */
  location?: ComplexLocation;
};

/** Totales del tablero de canchas: habilitadas (disponibles y sin bloqueo activo) y bloqueos vigentes. */
export function summarizeCourts(courts: CourtItem[]): { total: number; enabled: number; activeBlocks: number } {
  return {
    total: courts.length,
    enabled: courts.filter((c) => c.state === CourtState.AVAILABLE && !c.activeOutOfService).length,
    activeBlocks: courts.filter((c) => c.activeOutOfService).length,
  };
}

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
