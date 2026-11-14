import { ArrowRight, UserPlus, Users } from "lucide-react";
import { LATE_CANCELLATION_HOURS, OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { formatLongDate } from "@/app/bookings/slot-utils";
import {
  GroupSizePicker,
  SummaryCourt,
  SummaryFeedback,
  SummaryField,
  SummaryHeader,
  SummaryPanel,
  SummaryTotal,
} from "@/app/bookings/summary-parts";
import type { SelectedSlot } from "@/app/bookings/types";
import { MissingCategoryNotice } from "@/app/components/ui/missing-category-notice";
import { dateToTimeLabel } from "@/src/domain/time-format";

export function BookingSummary({
  selectedDate,
  selectedSlot,
  feedback,
  isPending,
  isOpenMatch = false,
  onIsOpenMatchChange,
  hasCategory = true,
  openMatchGroupSize = 1,
  onOpenMatchGroupSizeChange,
  onConfirm,
  onClose,
}: {
  selectedDate: Date;
  selectedSlot: SelectedSlot;
  feedback: { type: "error" | "success"; message: string } | null;
  isPending: boolean;
  isOpenMatch?: boolean;
  onIsOpenMatchChange?: (value: boolean) => void;
  hasCategory?: boolean;
  openMatchGroupSize?: number;
  onOpenMatchGroupSizeChange?: (value: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const openMatchGroupSizeOptions = Array.from({ length: OPEN_MATCH_MAX_PLAYERS - 1 }, (_, i) => i + 1);
  const missingCategory = isOpenMatch && !hasCategory;

  return (
    <SummaryPanel label="Resumen de tu turno">
      <SummaryHeader
        title="Resumen de tu turno"
        onClose={onClose}
      />

      <SummaryFeedback feedback={feedback} />

      <SummaryCourt courtNumber={selectedSlot.courtNumber} location={selectedSlot.location} />

      <div className="grid grid-cols-2 gap-2.5 py-4 border-b border-line">
        <SummaryField label="Día" value={formatLongDate(selectedDate)} />
        <SummaryField
          label="Horario"
          value={`${dateToTimeLabel(selectedSlot.start)} · ${dateToTimeLabel(selectedSlot.end)}`}
        />
      </div>

      <div className="border-b border-line py-4">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[10px] font-bold tracking-[0.12em] text-foreground/45 uppercase">
            Modalidad
          </legend>
          <ModeOption
            checked={!isOpenMatch}
            onChange={() => onIsOpenMatchChange?.(false)}
            icon={<Users className="h-4 w-4" />}
            title="Cancha completa"
            description={`Ya son ${OPEN_MATCH_MAX_PLAYERS} jugadores confirmados`}
          />
          <ModeOption
            checked={isOpenMatch}
            onChange={() => onIsOpenMatchChange?.(true)}
            icon={<UserPlus className="h-4 w-4" />}
            title="Buscar jugadores"
            description="Abrí el partido para que la comunidad se sume"
          />
          {missingCategory ? (
            <div className="pt-2">
              <MissingCategoryNotice message="Para crear un partido abierto necesitás cargar tu categoría." />
            </div>
          ) : isOpenMatch ? (
            <div className="pt-2">
              <GroupSizePicker
                question="¿Cuántos jugadores confirmados hay (contándote a vos)?"
                options={openMatchGroupSizeOptions}
                value={openMatchGroupSize}
                onChange={onOpenMatchGroupSizeChange ?? (() => {})}
              />
            </div>
          ) : null}
        </fieldset>
      </div>

      <div className="pt-4">
        <SummaryTotal price={selectedSlot.price} />
      </div>
      <p className="mt-2.5 text-xs text-foreground/50 text-center">
        Cancelación sin cargo hasta {LATE_CANCELLATION_HOURS} h antes. Se abona en la recepción del club.
      </p>

      <button
        type="button"
        disabled={isPending || missingCategory}
        onClick={onConfirm}
        className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-neutral-900 py-3.5 px-6 text-sm font-bold text-white shadow-xs transition-all hover:bg-black active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{isPending ? "Confirmando…" : "Reservar turno"}</span>
        {!isPending ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
    </SummaryPanel>
  );
}

function ModeOption({
  checked,
  onChange,
  icon,
  title,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl p-3 border transition-all ${
        checked
          ? "border-primary/80 bg-primary-light/40 text-foreground ring-1 ring-primary/30 shadow-xs"
          : "border-line bg-background/50 hover:bg-card hover:border-foreground/30 text-foreground/75"
      }`}
    >
      <input
        type="radio"
        name="booking-mode"
        checked={checked}
        onChange={onChange}
        className="mt-1 accent-primary"
      />
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-foreground">
          <span className={checked ? "text-primary" : "text-foreground/60"}>{icon}</span>
          {title}
        </span>
        <span className="text-xs text-foreground/55">{description}</span>
      </span>
    </label>
  );
}
