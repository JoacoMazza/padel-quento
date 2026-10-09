"use client";

import { useEffect, useState } from "react";
import { Mail, MessageCircle, ShieldCheck, ShieldOff, X } from "lucide-react";
import {
  getPlayerRecordAdmin,
  type PlayerAdminItem,
  type PlayerRecordAdmin,
  type PlayerRecordBooking,
} from "@/src/actions/player";
import { BookingState } from "@/src/domain/enums";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import { mailtoUrl, whatsappUrl } from "@/app/admin/player-contact";

function attendanceLabel(booking: PlayerRecordBooking, now: Date): { text: string; className: string } {
  if (booking.bookingState === BookingState.CANCELLED) {
    return { text: "Cancelado", className: "bg-line/60 text-foreground/60" };
  }
  const end = new Date(booking.fromDateTime).getTime() + booking.durationMinutes * 60_000;
  if (end > now.getTime()) {
    return { text: "Próximo", className: "bg-blue-50 text-blue-700" };
  }
  return booking.attended
    ? { text: "Asistió", className: "bg-success/10 text-success" }
    : { text: "Ausente", className: "bg-danger/10 text-danger" };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Ficha del jugador abierta desde Gestión de Usuarios: historial de turnos,
 * inasistencias y puntos, con contacto directo y bloqueo de la cuenta. El
 * estado de bloqueo lo maneja la tabla (player), así queda sincronizado al cerrar.
 */
export function PlayerRecordModal({
  player,
  isTogglePending,
  toggleError,
  onToggleBlock,
  onClose,
}: {
  player: PlayerAdminItem;
  isTogglePending: boolean;
  toggleError: string | null;
  onToggleBlock: () => void;
  onClose: () => void;
}) {
  const [record, setRecord] = useState<PlayerRecordAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPlayerRecordAdmin(player.id).then((result) => {
      if (cancelled) return;
      if (result.success) setRecord(result.data);
      else setError(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [player.id]);

  const fullName = `${player.names} ${player.lastnames}`;
  const now = new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ficha de ${fullName}`}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-line bg-card p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">{fullName}</h2>
            <p className="text-xs text-foreground/60">
              {PLAYER_CATEGORY_LABELS[player.category] ?? player.category} · {player.email} · {player.phoneNumber}
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contacto directo y ajuste de estado */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <a
            href={whatsappUrl(player.phoneNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/20"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <a
            href={mailtoUrl(player.email)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
          <button
            type="button"
            disabled={isTogglePending}
            aria-label={player.isBlocked ? `Desbloquear a ${player.names}` : `Bloquear a ${player.names}`}
            onClick={onToggleBlock}
            className={`ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              player.isBlocked
                ? "bg-success/10 text-success hover:bg-success/20"
                : "bg-danger/10 text-danger hover:bg-danger/20"
            }`}
          >
            {player.isBlocked ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            {isTogglePending ? "Procesando…" : player.isBlocked ? "Desbloquear" : "Bloquear"}
          </button>
        </div>
        {toggleError ? <p className="mb-3 text-xs font-medium text-danger">{toggleError}</p> : null}

        <div className="flex-1 space-y-5 overflow-y-auto">
          {error ? (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger">
              {error}
            </div>
          ) : !record ? (
            <p className="text-sm text-foreground/60">Cargando...</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs text-foreground/60">Reservas</p>
                  <p className="text-xl font-bold text-foreground">{record.bookings.length}</p>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs text-foreground/60">Inasistencias</p>
                  <p data-testid="no-shows" className="text-xl font-bold text-danger">
                    {record.noShows}
                  </p>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-xs text-foreground/60">Puntos</p>
                  <p data-testid="scoring" className="text-xl font-bold text-primary">
                    {record.scoring}
                  </p>
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-sm font-bold text-foreground">Historial de reservas</h3>
                {record.bookings.length === 0 ? (
                  <p className="text-sm text-foreground/60">El jugador todavía no tiene reservas.</p>
                ) : (
                  <ul className="divide-y divide-line/60">
                    {record.bookings.map((booking) => {
                      const status = attendanceLabel(booking, now);
                      return (
                        <li key={booking.id} className="flex items-center justify-between py-2.5 text-sm">
                          <div>
                            <p className="font-medium text-foreground">
                              {booking.courtNumber !== null ? `Cancha ${booking.courtNumber}` : "Cancha sin asignar"}
                              {booking.isOpenMatch ? (
                                <span className="ml-2 text-xs text-foreground/50">Partido abierto</span>
                              ) : null}
                            </p>
                            <p className="text-xs text-foreground/50">{formatDateTime(booking.fromDateTime)}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-sm font-bold text-foreground">Movimientos de puntos</h3>
                {record.movements.length === 0 ? (
                  <p className="text-sm text-foreground/60">Sin movimientos de puntos.</p>
                ) : (
                  <ul className="divide-y divide-line/60">
                    {record.movements.map((movement) => (
                      <li key={movement.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{movement.description}</p>
                          <p className="text-xs text-foreground/50">{formatDateTime(movement.createdAt)}</p>
                        </div>
                        <span className={`font-bold ${movement.amount >= 0 ? "text-success" : "text-danger"}`}>
                          {movement.amount > 0 ? `+${movement.amount}` : movement.amount} pts
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
