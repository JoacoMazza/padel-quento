import Link from "next/link";
import { ArrowRight, CircleCheck, UserPlus } from "lucide-react";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { formatLongDate } from "@/app/bookings/slot-utils";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { PlayerDots } from "@/app/components/ui/player-dots";
import {
  GroupSizePicker,
  SummaryCourt,
  SummaryFeedback,
  SummaryField,
  SummaryHeader,
  SummaryPanel,
  SummaryTotal,
} from "@/app/bookings/summary-parts";
import type { SelectedOpenMatch } from "@/app/bookings/types";
import { MissingCategoryNotice } from "@/app/components/ui/missing-category-notice";

export function JoinMatchPanel({
  selectedDate,
  selectedMatch,
  feedback,
  isPending,
  alreadyJoined,
  hasCategory,
  groupSize,
  onGroupSizeChange,
  onConfirm,
  onClose,
}: {
  selectedDate: Date;
  selectedMatch: SelectedOpenMatch;
  feedback: { type: "error" | "success"; message: string } | null;
  isPending: boolean;
  alreadyJoined: boolean;
  /** Sin categoría cargada no puede sumarse: se lo manda a completarla en su perfil. */
  hasCategory: boolean;
  groupSize: number;
  onGroupSizeChange: (value: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const remainingSpots = OPEN_MATCH_MAX_PLAYERS - selectedMatch.confirmedPlayers;
  const groupSizeOptions = Array.from({ length: remainingSpots }, (_, i) => i + 1);
  const timeRange = `${dateToTimeLabel(selectedMatch.start)} – ${dateToTimeLabel(selectedMatch.end)}`;

  return (
    <SummaryPanel label="Partido abierto">
      <SummaryHeader title="Partido abierto" onClose={onClose} />

      <SummaryFeedback feedback={feedback} />

      <SummaryCourt courtNumber={selectedMatch.courtNumber} location={selectedMatch.location} />

      <div className="grid grid-cols-2 gap-4 border-b border-white/10 py-5">
        <SummaryField label="Día" value={formatLongDate(selectedDate)} />
        <SummaryField label="Horario" value={timeRange} />
      </div>

      <div className="flex items-center justify-between border-b border-white/10 py-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">Jugadores anotados</p>
          <p className="mt-0.5 text-sm font-semibold">
            {selectedMatch.confirmedPlayers} de {OPEN_MATCH_MAX_PLAYERS}
          </p>
        </div>
        <PlayerDots confirmed={selectedMatch.confirmedPlayers} tone="primary" />
      </div>

      <div className="pt-5">
        <SummaryTotal price={selectedMatch.price} />
      </div>

      {alreadyJoined ? (
        <p className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-success/15 px-4 py-3 text-sm font-semibold text-emerald-300">
          <CircleCheck className="h-4 w-4" />
          Ya formás parte de este partido.
        </p>
      ) : !hasCategory ? (
        <div className="mt-5">
          <MissingCategoryNotice message="Para sumarte a un partido abierto necesitás cargar tu categoría." />
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {remainingSpots > 1 ? (
            <GroupSizePicker
              question="¿Cuántos jugadores se suman (contándote a vos)?"
              options={groupSizeOptions}
              value={groupSize}
              onChange={onGroupSizeChange}
            />
          ) : null}
          <button type="button" disabled={isPending} onClick={onConfirm} className="btn btn-primary btn-lg w-full">
            <UserPlus className="h-5 w-5" />
            {isPending ? "Sumándote…" : "Sumarme al partido"}
          </button>
        </div>
      )}

      <Link
        href={`/open-matches/${selectedMatch.bookingId}`}
        className="mt-4 flex items-center justify-center gap-1.5 text-xs font-semibold text-white/60 transition-colors hover:text-white"
      >
        Ver detalle del partido
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </SummaryPanel>
  );
}