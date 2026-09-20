import { Banknote, Calendar, Clock, LayoutGrid, MapPin, Users } from "lucide-react";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { formatLongDate, minutesToTimeLabel } from "@/app/bookings/slot-utils";
import type { SelectedOpenMatch } from "@/app/bookings/types";

export function JoinMatchPanel({
  selectedDate,
  selectedMatch,
  feedback,
  isPending,
  alreadyJoined,
  groupSize,
  onGroupSizeChange,
  onConfirm,
}: {
  selectedDate: Date;
  selectedMatch: SelectedOpenMatch;
  feedback: { type: "error" | "success"; message: string } | null;
  isPending: boolean;
  alreadyJoined: boolean;
  groupSize: number;
  onGroupSizeChange: (value: number) => void;
  onConfirm: () => void;
}) {
  const remainingSpots = OPEN_MATCH_MAX_PLAYERS - selectedMatch.confirmedPlayers;
  const groupSizeOptions = Array.from({ length: remainingSpots }, (_, i) => i + 1);

  return (
    <aside className="h-fit rounded-2xl border border-amber-300 bg-card p-6 shadow-sm">
      <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-foreground">
        <Users className="h-5 w-5 text-amber-600" />
        Sumarte al partido
      </h2>

      {feedback ? (
        <p
          role="alert"
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            feedback.type === "error"
              ? "border border-danger/30 bg-danger-light text-danger"
              : "border border-primary/30 bg-primary-light text-primary"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        <SummaryRow icon={<Calendar className="h-5 w-5" />} label="Fecha" value={formatLongDate(selectedDate)} />
        <SummaryRow
          icon={<LayoutGrid className="h-5 w-5" />}
          label="Cancha"
          value={`Cancha ${selectedMatch.courtNumber}`}
        />
        <SummaryRow
          icon={<MapPin className="h-5 w-5" />}
          label="Ubicación"
          value={selectedMatch.courtLocation ?? "Cam. Centenario 8907, Villa Elisa"}
        />
        <SummaryRow
          icon={<Clock className="h-5 w-5" />}
          label="Horario"
          value={`${minutesToTimeLabel(selectedMatch.start.getHours() * 60 + selectedMatch.start.getMinutes())} – ${minutesToTimeLabel(selectedMatch.end.getHours() * 60 + selectedMatch.end.getMinutes())}`}
        />
        <SummaryRow
          icon={<Users className="h-5 w-5" />}
          label="Jugadores anotados"
          value={`${selectedMatch.confirmedPlayers}/${OPEN_MATCH_MAX_PLAYERS}`}
        />
        <SummaryRow icon={<Banknote className="h-5 w-5" />} label="Lugares libres" value={`${remainingSpots}`} />

        {alreadyJoined ? (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-center text-sm font-medium text-foreground/70">
            Ya formás parte de este partido.
          </p>
        ) : (
          <>
            {remainingSpots > 1 ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                <p className="text-xs font-medium text-foreground/70">
                  ¿Cuántos jugadores se suman (contándote a vos)?
                </p>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {groupSizeOptions.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => onGroupSizeChange(size)}
                      className={`h-9 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                        groupSize === size
                          ? "bg-amber-500 text-white shadow-sm"
                          : "border border-amber-300 bg-white text-foreground hover:border-amber-500"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={isPending}
              onClick={onConfirm}
              className="mt-2 h-11 rounded-full bg-amber-500 text-sm font-semibold text-white transition-all hover:bg-amber-600 active:scale-[0.99] disabled:opacity-60 shadow-sm cursor-pointer"
            >
              {isPending ? "Sumándote…" : "Sumarme al partido"}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-foreground/40">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-foreground/50">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}
