"use client";

import { useState } from "react";
import { X, UserCheck, UserX } from "lucide-react";
import { setBookingAttendance, setMatchPlayerAttendance } from "@/src/actions/attendance";
import type { AdminBookingProp } from "@/app/admin/types";
import { Avatar, getInitials } from "@/app/components/ui/avatar";

/**
 * Turno abierto en la turnera global para marcar asistencia (ver
 * src/actions/attendance.ts). Por defecto todos los participantes figuran
 * presentes: el admin solo interviene para marcar la ausencia, antes de que
 * corra el job que acredita los puntos de fidelidad al finalizar el turno.
 */
export function AttendanceModal({
  booking,
  onClose,
  onUpdated,
}: {
  booking: AdminBookingProp;
  onClose: () => void;
  onUpdated: (booking: AdminBookingProp) => void;
}) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

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
