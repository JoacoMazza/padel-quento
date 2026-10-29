"use client";

import type { BookingHolder } from "@/src/lib/court-booking";

export type HolderPlayerOption = { id: number; name: string; phoneNumber: string };

/** Lo que va cargando el admin en los campos del titular. */
export type HolderValue = {
  type: "player" | "guest";
  playerId: string;
  names: string;
  lastnames: string;
  phoneNumber: string;
};

export const EMPTY_HOLDER: HolderValue = { type: "player", playerId: "", names: "", lastnames: "", phoneNumber: "" };

export function toBookingHolder(value: HolderValue): BookingHolder {
  return value.type === "player"
    ? { playerId: Number(value.playerId) }
    : { names: value.names, lastnames: value.lastnames, phoneNumber: value.phoneNumber };
}

export const INPUT_CLASS =
  "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary touch-target";
export const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70";

/**
 * Titular de un turno que agenda el admin (turno común o fijo): un jugador
 * registrado, o alguien sin cuenta con su nombre y teléfono.
 */
export function HolderFields({
  idPrefix,
  players,
  value,
  onChange,
}: {
  idPrefix: string;
  players: HolderPlayerOption[];
  value: HolderValue;
  onChange: (value: HolderValue) => void;
}) {
  const set = (changes: Partial<HolderValue>) => onChange({ ...value, ...changes });

  return (
    <fieldset>
      <legend className={LABEL_CLASS}>Titular</legend>
      <div className="mb-3 flex gap-4 text-sm">
        <label className="flex items-center gap-2 touch-target">
          <input
            type="radio"
            name={`${idPrefix}-holder-type`}
            checked={value.type === "player"}
            onChange={() => set({ type: "player" })}
          />
          Jugador registrado
        </label>
        <label className="flex items-center gap-2 touch-target">
          <input
            type="radio"
            name={`${idPrefix}-holder-type`}
            checked={value.type === "guest"}
            onChange={() => set({ type: "guest" })}
          />
          Sin cuenta
        </label>
      </div>

      {value.type === "player" ? (
        <div>
          <label htmlFor={`${idPrefix}-player`} className={LABEL_CLASS}>
            Jugador
          </label>
          <select
            id={`${idPrefix}-player`}
            required
            value={value.playerId}
            onChange={(e) => set({ playerId: e.target.value })}
            className={INPUT_CLASS}
          >
            <option value="">Elegí un jugador</option>
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name} ({player.phoneNumber})
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${idPrefix}-names`} className={LABEL_CLASS}>
                Nombre
              </label>
              <input
                id={`${idPrefix}-names`}
                required
                value={value.names}
                onChange={(e) => set({ names: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-lastnames`} className={LABEL_CLASS}>
                Apellido
              </label>
              <input
                id={`${idPrefix}-lastnames`}
                required
                value={value.lastnames}
                onChange={(e) => set({ lastnames: e.target.value })}
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`${idPrefix}-phone`} className={LABEL_CLASS}>
              Teléfono
            </label>
            <input
              id={`${idPrefix}-phone`}
              type="tel"
              required
              value={value.phoneNumber}
              onChange={(e) => set({ phoneNumber: e.target.value })}
              className={INPUT_CLASS}
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}
