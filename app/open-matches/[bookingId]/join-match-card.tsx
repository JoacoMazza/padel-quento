"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleCheck, MessageCircle, UserPlus } from "lucide-react";
import { joinOpenMatch } from "@/src/actions/booking";
import { formatPrice } from "@/app/bookings/slot-utils";
import { GroupSizePicker } from "@/app/bookings/summary-parts";
import type { OpenMatchStatus } from "@/app/open-matches/open-matches";

const CLOSED_MESSAGES: Record<Exclude<OpenMatchStatus, "open">, string> = {
  full: "Este partido ya está completo.",
  cancelled: "Este turno fue cancelado.",
  past: "Este partido ya empezó.",
};

/** Panel lateral del detalle de un partido abierto para sumarse (ver joinOpenMatch). */
export function JoinMatchCard({
  bookingId,
  playerId,
  courtNumber,
  timeRange,
  dateLabel,
  price,
  remainingSpots,
  status,
  alreadyJoined,
  chatId,
}: {
  bookingId: number;
  playerId: number | null;
  courtNumber: number;
  timeRange: string;
  dateLabel: string;
  price: number;
  remainingSpots: number;
  status: OpenMatchStatus;
  alreadyJoined: boolean;
  chatId: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [groupSize, setGroupSize] = useState(1);
  const [error, setError] = useState<string | null>(null);

  function handleJoin() {
    if (!playerId) {
      setError("Tu cuenta no puede sumarse a partidos.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await joinOpenMatch({ bookingId, playerId, groupSize });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/my-bookings");
    });
  }

  return (
    <aside className="card-dark h-fit p-7">
      <p className="label-caps text-white/50">Asistencia al turno</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Sumarte al partido</h2>
      <p className="mt-2 text-sm text-white/60">Confirmá tu lugar sin pagar por este medio.</p>

      <dl className="mt-6 space-y-3 border-t border-white/10 pt-6 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="font-medium">Cancha {courtNumber} · Turno completo</dt>
          <dd className="font-bold">{formatPrice(price)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-white/60">
          <dt>{dateLabel}</dt>
          <dd>{timeRange}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 text-white/60">
          <dt>Lugares libres</dt>
          <dd>{remainingSpots}</dd>
        </div>
      </dl>

      <div className="mt-6 flex items-end justify-between border-t border-white/10 pt-6">
        <span className="font-semibold">Total cancha</span>
        <span className="text-4xl font-extrabold tracking-tight">{formatPrice(price)}</span>
      </div>

      {error ? (
        <p role="alert" className="mt-5 rounded-xl bg-primary/15 px-3.5 py-2.5 text-sm font-medium text-red-200">
          {error}
        </p>
      ) : null}

      {alreadyJoined ? (
        <div className="mt-6 space-y-3">
          <p className="flex items-center justify-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-emerald-300">
            <CircleCheck className="h-4 w-4" />
            Ya formás parte de este partido.
          </p>
          {chatId !== null ? (
            <Link href={`/chats/${chatId}`} className="btn w-full bg-white text-ink hover:bg-white/90">
              <MessageCircle className="h-4 w-4" />
              Ir al chat del partido
            </Link>
          ) : null}
        </div>
      ) : status !== "open" ? (
        <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-center text-sm font-medium text-white/70">
          {CLOSED_MESSAGES[status]}
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {remainingSpots > 1 ? (
            <GroupSizePicker
              question="¿Cuántos se suman (contándote a vos)?"
              options={Array.from({ length: remainingSpots }, (_, i) => i + 1)}
              value={groupSize}
              onChange={setGroupSize}
            />
          ) : null}

          <button type="button" disabled={isPending} onClick={handleJoin} className="btn btn-primary btn-lg w-full">
            <UserPlus className="h-5 w-5" />
            {isPending ? "Sumándote…" : "Sumarme al partido"}
          </button>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-white/40">El pago del turno se abona en la recepción del club.</p>
    </aside>
  );
}
