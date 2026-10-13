"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createBookingAdmin } from "@/src/actions/adminBooking";
import { todayISO } from "@/src/domain/fixed-booking";
import {
  EMPTY_HOLDER,
  HolderFields,
  INPUT_CLASS,
  LABEL_CLASS,
  toBookingHolder,
  type HolderPlayerOption,
} from "@/app/admin/holder-fields";

export type BookingCourtOption = { id: number; number: number; price: number };

/** Datos que trae el formulario al abrirse desde una celda libre de la grilla. */
export type BookingDraft = { courtId?: number; date?: string; startTime?: string };

/**
 * Alta de un turno común por el admin (por ejemplo, alguien que llama o se
 * acerca al mostrador): queda reservado completo a nombre de un jugador o de
 * alguien sin cuenta, con el precio de la cancha salvo que el admin lo cambie.
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
  const [startTime, setStartTime] = useState(initial.startTime ?? "18:00");
  const [price, setPrice] = useState(String(initialCourt?.price ?? ""));
  const [priceEdited, setPriceEdited] = useState(false);
  const [holder, setHolder] = useState(EMPTY_HOLDER);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function handleCourtChange(id: number) {
    setCourtId(id);
    // Mientras el admin no lo cambie, el precio sigue al de la cancha elegida.
    const court = courts.find((c) => c.id === id);
    if (court && !priceEdited) setPrice(String(court.price));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await createBookingAdmin({
      courtId,
      date,
      startTime,
      price: Number(price),
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
                onChange={(e) => handleCourtChange(Number(e.target.value))}
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
              <input
                id="booking-price"
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setPriceEdited(true);
                }}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="booking-date" className={LABEL_CLASS}>
                Fecha
              </label>
              <input
                id="booking-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor="booking-time" className={LABEL_CLASS}>
                Hora
              </label>
              <input
                id="booking-time"
                type="time"
                step={1800}
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

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
              disabled={isSaving}
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
