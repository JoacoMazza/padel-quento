"use client";

import { useState } from "react";
import { CalendarX, Repeat, X, UserCheck, UserX } from "lucide-react";
import { setBookingAttendance, setMatchPlayerAttendance } from "@/src/actions/attendance";
import { releaseFixedBookingDate } from "@/src/actions/fixedBooking";
import type { AdminBookingProp } from "@/app/admin/types";
import { Avatar, getInitials } from "@/app/components/ui/avatar";

/**
 * Turno abierto en la turnera global para marcar asistencia (ver
 * src/actions/attendance.ts). Por defecto todos los participantes figuran
 * presentes: el admin solo interviene para marcar la ausencia, antes de que
 * corra el job que acredita los puntos de fidelidad al finalizar el turno.
 * Si el turno es una fecha futura de un turno fijo (HU-41), también permite
 * liberar solo esa fecha.
 */
export function AttendanceModal({
  booking,
  onClose,
  onUpdated,
  onReleased,
}: {
  booking: AdminBookingProp;
  onClose: () => void;
  onUpdated: (booking: AdminBookingProp) => void;
  onReleased?: () => void;
}) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // La hora se toma al abrir el modal: alcanza para no ofrecer liberar una fecha que ya pasó.
  const [openedAt] = useState(() => Date.now());
  const canRelease = booking.fixedBookingDateId !== null && booking.fromDateTime.getTime() > openedAt;

  async function handleRelease() {
    if (booking.fixedBookingDateId === null) return;
    setError(null);
    setIsReleasing(true);
    const result = await releaseFixedBookingDate(booking.fixedBookingDateId);
    setIsReleasing(false);
    if (!result.success) {
      setError(result.error);
      setConfirmingRelease(false);
      return;
    }
    onReleased?.();
  }

  const isOpenMatch = booking.matchPlayers.length > 0;

  async function handleToggleBookingPlayer() {
    setError(null);
    setPendingId(booking.id);
    const result = await setBookingAttendance(booking.id, !booking.attended);
    setPendingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onUpdated({ ...booking, attended: !booking.attended });
  }

  async function handleToggleMatchPlayer(matchPlayerId: number, attended: boolean) {
    setError(null);
    setPendingId(matchPlayerId);
    const result = await setMatchPlayerAttendance(matchPlayerId, !attended);
    setPendingId(null);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onUpdated({
      ...booking,
      matchPlayers: booking.matchPlayers.map((mp) =>
        mp.id === matchPlayerId ? { ...mp, attended: !attended } : mp,
      ),
    });
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-panel">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Asistencia del turno</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="icon-btn border-transparent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {booking.fixedBookingDateId !== null ? (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            <Repeat className="h-3.5 w-3.5" />
            Turno fijo
          </span>
        ) : null}

        <p className="mb-4 text-xs text-foreground/60">
          Por defecto todos figuran presentes. Marcá como ausente solo a quien no haya asistido; el
          resto acredita los puntos de fidelidad al finalizar el turno.
        </p>

        <ul className="divide-y divide-line/60">
          {isOpenMatch ? (
            booking.matchPlayers.map((matchPlayer) => (
              <li key={matchPlayer.id} className="flex items-center justify-between py-3">
                <PlayerName name={matchPlayer.playerName} />
                <button
                  type="button"
                  disabled={pendingId === matchPlayer.id}
                  onClick={() => handleToggleMatchPlayer(matchPlayer.id, matchPlayer.attended)}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    matchPlayer.attended
                      ? "bg-success/10 text-success hover:bg-danger/10 hover:text-danger"
                      : "bg-danger/10 text-danger hover:bg-success/10 hover:text-success"
                  }`}
                >
                  {matchPlayer.attended ? (
                    <UserCheck className="h-3.5 w-3.5" />
                  ) : (
                    <UserX className="h-3.5 w-3.5" />
                  )}
                  {matchPlayer.attended ? "Presente" : "Ausente"}
                </button>
              </li>
            ))
          ) : (
            <li className="flex items-center justify-between py-3">
              <PlayerName name={booking.bookerName} />
              <button
                type="button"
                disabled={pendingId === booking.id}
                onClick={handleToggleBookingPlayer}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  booking.attended
                    ? "bg-success/10 text-success hover:bg-danger/10 hover:text-danger"
                    : "bg-danger/10 text-danger hover:bg-success/10 hover:text-success"
                }`}
              >
                {booking.attended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                {booking.attended ? "Presente" : "Ausente"}
              </button>
            </li>
          )}
        </ul>

        {canRelease ? (
          <div className="mt-4 border-t border-line pt-4">
            {confirmingRelease ? (
              <div className="flex flex-wrap items-center gap-2">
                <p className="flex-1 text-xs text-foreground/70">
                  Se libera solo esta fecha; las demás del turno fijo siguen reservadas.
                </p>
                <button
                  type="button"
                  disabled={isReleasing}
                  onClick={handleRelease}
                  className="cursor-pointer rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isReleasing ? "Liberando..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  disabled={isReleasing}
                  onClick={() => setConfirmingRelease(false)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-line/40"
                >
                  Volver
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingRelease(true)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
              >
                <CalendarX className="h-3.5 w-3.5" />
                Liberar esta fecha
              </button>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}
      </div>
    </div>
  );
}

function PlayerName({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-3">
      <Avatar initials={getInitials(name)} size="sm" />
      <span className="text-sm font-semibold text-foreground">{name}</span>
    </span>
  );
}
