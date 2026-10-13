"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarPlus, Check, UserPlus } from "lucide-react";
import { formatPrice } from "@/app/bookings/slot-utils";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { PlayerDots, missingPlayersLabel } from "@/app/components/ui/player-dots";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import {
  matchesOpenMatchFilter,
  type OpenMatchFilter,
  type OpenMatchItem,
} from "@/app/open-matches/open-matches";

const FILTERS: { value: OpenMatchFilter; label: string }[] = [
  { value: "all", label: "Todos los partidos" },
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
];

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "short" });
const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });

/** "Hoy, 12 oct" o "Mié, 14 oct". */
function shortDate(date: Date, now: Date) {
  const weekday = WEEKDAY_FORMATTER.format(date).replace(".", "");
  const prefix = date.toDateString() === now.toDateString() ? "Hoy" : weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${prefix}, ${DAY_MONTH_FORMATTER.format(date)}`;
}

export function OpenMatchesList({ matches }: { matches: OpenMatchItem[] }) {
  const [filter, setFilter] = useState<OpenMatchFilter>("all");
  const now = new Date();
  const visible = matches.filter((m) => matchesOpenMatchFilter(m.start, now, filter));

  return (
    <>
      <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={`chip ${filter === option.value ? "chip-active" : ""}`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {visible.length === 0 ? (
          <div className="card p-10 text-center text-sm text-foreground/60">
            No hay partidos abiertos para este filtro. ¡Armá el tuyo desde la reserva de turnos!
          </div>
        ) : (
          visible.map((match) => (
            <article
              key={match.bookingId}
              className="card flex flex-col gap-5 p-6 transition-shadow hover:shadow-md md:flex-row md:items-center"
            >
              <div className="md:w-28 md:shrink-0 md:border-r md:border-line md:pr-6">
                <p className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                  {dateToTimeLabel(match.start)}
                </p>
                <p className="text-sm text-foreground/50" suppressHydrationWarning>
                  {shortDate(match.start, now)}
                </p>
              </div>

              <div className="flex-1">
                <p className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Cancha {match.courtNumber}
                </p>
                <p className="text-sm text-foreground/50">Organiza {match.organizerName}</p>
                <span className="badge badge-primary mt-2">{PLAYER_CATEGORY_LABELS[match.category]}</span>
              </div>

              <div className="flex items-center gap-3">
                <PlayerDots confirmed={match.confirmedPlayers} />
                <div>
                  <p className="text-sm font-bold text-foreground">{missingPlayersLabel(match.remainingSpots)}</p>
                  <p className="text-xs text-foreground/50">
                    {match.confirmedPlayers} confirmado{match.confirmedPlayers === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="md:text-right">
                <p className="text-xl font-extrabold text-foreground">{formatPrice(match.price)}</p>
                <p className="text-xs text-foreground/50">total cancha</p>
              </div>

              <Link
                href={`/open-matches/${match.bookingId}`}
                className={`btn ${match.alreadyJoined ? "btn-outline" : "btn-dark"} md:w-36`}
              >
                {match.alreadyJoined ? (
                  <>
                    <Check className="h-4 w-4" />
                    Anotado
                  </>
                ) : (
                  <>
                    Sumarme
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Link>
            </article>
          ))
        )}
      </div>

      <div className="card mt-8 flex flex-col gap-5 p-7 md:flex-row md:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
          <UserPlus className="h-6 w-6" />
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-extrabold tracking-tight text-foreground">¿Querés armar tu propio partido abierto?</h2>
          <p className="mt-1 text-sm text-foreground/60">
            Reservá cualquier turno disponible y elegí buscar jugadores para que otros socios del club se sumen.
          </p>
        </div>
        <Link href="/bookings" className="btn btn-primary">
          Reservar turno
          <CalendarPlus className="h-4 w-4" />
        </Link>
      </div>
    </>
  );
}
