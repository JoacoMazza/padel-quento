import { ArrowRight, UserPlus, Users } from "lucide-react";
import { LATE_CANCELLATION_HOURS, OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import {
  SLOT_DURATION_MINUTES,
  formatLongDate,
  minutesToTimeLabel,
} from "@/app/bookings/slot-utils";
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

export function BookingSummary({
  selectedDate,
  selectedSlot,
  feedback,
  isPending,
  isOpenMatch,
  onIsOpenMatchChange,
  openMatchGroupSize,
  onOpenMatchGroupSizeChange,
  onConfirm,
  onClose,
}: {
  selectedDate: Date;
  selectedSlot: SelectedSlot;
  feedback: { type: "error" | "success"; message: string } | null;
  isPending: boolean;
  isOpenMatch: boolean;
  onIsOpenMatchChange: (value: boolean) => void;
  openMatchGroupSize: number;
  onOpenMatchGroupSizeChange: (value: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const openMatchGroupSizeOptions = Array.from({ length: OPEN_MATCH_MAX_PLAYERS - 1 }, (_, i) => i + 1);

  return (
    <SummaryPanel label="Resumen de tu turno">
      <SummaryHeader
        title="Resumen de tu turno"
        onClose={onClose}
      />

      <SummaryFeedback feedback={feedback} />

      <SummaryCourt courtNumber={selectedSlot.courtNumber}/>

      <div className="grid grid-cols-2 gap-4 border-b border-white/10 py-5">
        <SummaryField label="Día" value={formatLongDate(selectedDate)} />
        <SummaryField
          label="Horario"
          value={`${minutesToTimeLabel(selectedSlot.start.getHours() * 60 + selectedSlot.start.getMinutes())} · ${SLOT_DURATION_MINUTES} min`}
        />
      </div>

      {/* El padding va en un div: el navegador ubica el legend sobre el borde superior del fieldset e ignora su padding. */}
      <div className="border-b border-white/10 py-5">
        <fieldset className="space-y-2">
          <legend className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">Modalidad</legend>
          <ModeOption
            checked={!isOpenMatch}
            onChange={() => onIsOpenMatchChange(false)}
            icon={<Users className="h-4 w-4" />}
            title="Cancha completa"
            description={`Ya son ${OPEN_MATCH_MAX_PLAYERS} jugadores`}
          />
          <ModeOption
            checked={isOpenMatch}
            onChange={() => onIsOpenMatchChange(true)}
            icon={<UserPlus className="h-4 w-4" />}
            title="Buscar jugadores"
            description="Abrí el partido para que se sume gente"
          />
          {isOpenMatch ? (
            <div className="pt-2">
              <GroupSizePicker
                question="¿Cuántos jugadores confirmados hay (contándote a vos)?"
                options={openMatchGroupSizeOptions}
                value={openMatchGroupSize}
                onChange={onOpenMatchGroupSizeChange}
              />
            </div>
          ) : null}
        </fieldset>
      </div>

      <div className="pt-5">
        <SummaryTotal price={selectedSlot.price} />
      </div>
      <p className="mt-3 text-xs text-white/45">
        Cancelación sin cargo hasta {LATE_CANCELLATION_HOURS} h antes. El pago se abona en la recepción del club.
      </p>

      <button type="button" disabled={isPending} onClick={onConfirm} className="btn btn-primary btn-lg mt-5 w-full">
        {isPending ? "Confirmando…" : "Reservar turno"}
        {!isPending ? <ArrowRight className="h-5 w-5" /> : null}
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
      className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 transition-colors ${
        checked ? "bg-primary/15 ring-primary" : "bg-white/5 ring-white/10 hover:ring-white/25"
      }`}
    >
      <input type="radio" name="booking-mode" checked={checked} onChange={onChange} className="mt-1 accent-primary" />
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          {icon}
          {title}
        </span>
        <span className="text-xs text-white/55">{description}</span>
      </span>
    </label>
  );
}
