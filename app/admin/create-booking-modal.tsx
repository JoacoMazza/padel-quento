"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createBookingAdmin, getAvailableSlotsAdmin } from "@/src/actions/adminBooking";
import { formatPrice } from "@/app/bookings/slot-utils";
import { todayISO } from "@/src/domain/fixed-booking";
import {
  EMPTY_HOLDER,
  HolderFields,
  INPUT_CLASS,
  LABEL_CLASS,
  toBookingHolder,
  type HolderPlayerOption,
} from "@/app/admin/holder-fields";
import { DateField } from "@/app/admin/date-field";

export type BookingCourtOption = { id: number; number: number; price: number };

/** Datos que trae el formulario al abrirse desde una celda libre de la grilla. */
export type BookingDraft = { courtId?: number; date?: string; startTime?: string };

/**
 * Alta de un turno común por el admin (por ejemplo, alguien que llama o se
 * acerca al mostrador): queda reservado completo a nombre de un jugador o de
 * alguien sin cuenta, con el precio de la cancha (no se puede cambiar). Solo
 * ofrece los horarios libres de la cancha y el día elegidos.
 */
export function CreateBookingModal({
  courts,
  players,
  initial,
  onClose,
  onCreated,
}: {
  courts: BookingCourtOption[];
  players: HolderPlayerOption[];
  initial: BookingDraft;
  onClose: () => void;
  onCreated: () => void;
}) {
  const initialCourt = courts.find((c) => c.id === initial.courtId) ?? courts[0];
  const [courtId, setCourtId] = useState(initialCourt?.id ?? 0);
  const [date, setDate] = useState(initial.date ?? todayISO());
  const [startTime, setStartTime] = useState(initial.startTime ?? "");
  // Horarios libres de la última cancha y día consultados.
  const [loadedSlots, setLoadedSlots] = useState<{ key: string; slots: string[] } | null>(null);
  const [holder, setHolder] = useState(EMPTY_HOLDER);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const price = courts.find((c) => c.id === courtId)?.price;
  const slotsKey = `${courtId}|${date}`;
  // null mientras se consultan los de la cancha y el día elegidos.
  const slots = loadedSlots?.key === slotsKey ? loadedSlots.slots : null;

  // Al cambiar la cancha o el día se vuelven a pedir los horarios libres; si el
  // horario elegido ya no está libre, hay que elegir otro.
  useEffect(() => {
    let cancelled = false;
    getAvailableSlotsAdmin({ courtId, date }).then((result) => {
      if (cancelled) return;
      const free = result.success ? result.data : [];
      if (!result.success) setError(result.error);
      setLoadedSlots({ key: `${courtId}|${date}`, slots: free });
      setStartTime((current) => (free.includes(current) ? current : ""));
    });
    return () => {
      cancelled = true;
    };
  }, [courtId, date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await createBookingAdmin({
      courtId,
      date,
      startTime,
      holder: toBookingHolder(holder),
    });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Nuevo turno</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="booking-court" className={LABEL_CLASS}>
                Cancha
              </label>
              <select
                id="booking-court"
                value={courtId}
                onChange={(e) => setCourtId(Number(e.target.value))}
                className={INPUT_CLASS}
              >
                {courts.map((court) => (
                  <option key={court.id} value={court.id}>
                    Cancha {court.number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="booking-price" className={LABEL_CLASS}>
                Precio
              </label>
              {/* El precio sale de la cancha: se muestra, pero no se puede cambiar. */}
              <input
                id="booking-price"
                readOnly
                value={price !== undefined ? formatPrice(price) : ""}
                className={`${INPUT_CLASS} cursor-not-allowed bg-line/30 text-foreground/70`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateField id="booking-date" label="Fecha" required value={date} onChange={setDate} />
            <div>
              <label htmlFor="booking-time" className={LABEL_CLASS}>
                Hora
              </label>
              <select
                id="booking-time"
                required
                disabled={!slots || slots.length === 0}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">{slots ? "Elegí un horario" : "Cargando horarios…"}</option>
                {slots?.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {slots && slots.length === 0 ? (
            <p className="-mt-2 text-xs font-medium text-danger">No hay horarios libres en esa cancha ese día.</p>
          ) : null}

          <HolderFields idPrefix="booking" players={players} value={holder} onChange={setHolder} />

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-line/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || !slots || slots.length === 0}
              className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Agendando..." : "Confirmar turno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
