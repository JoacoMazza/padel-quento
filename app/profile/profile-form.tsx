"use client";

import { useActionState, useState } from "react";
import { Save } from "lucide-react";
import { updatePlayerProfile, type ProfileState } from "@/src/actions/profile";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";

interface ProfileFormProps {
  initialData: {
    names: string;
    lastnames: string;
    category: string;
  };
}

const initialState: ProfileState = {};

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updatePlayerProfile, initialState);

  const [names, setNames] = useState(initialData.names);
  const [lastnames, setLastnames] = useState(initialData.lastnames);
  const [category, setCategory] = useState(initialData.category);

  const initials = `${names[0] ?? ""}${lastnames[0] ?? ""}`.toUpperCase() || "J";

  return (
    <form action={formAction} className="space-y-5">
      {state?.success && <div className="alert-success">{state.message}</div>}

      {state?.message && !state.success && <div className="alert-error">{state.message}</div>}

      <div className="flex items-center gap-4 rounded-xl bg-background p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink">
          <span className="text-lg font-bold text-white">{initials}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {names || "Nombre"} {lastnames || "Apellido"}
          </p>
          <p className="text-xs text-foreground/60">
            Categoría actual:{" "}
            <span className="font-medium text-primary">
              {PLAYER_CATEGORY_LABELS[category as keyof typeof PLAYER_CATEGORY_LABELS] || category}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="names" className="field-label">
            Nombre
          </label>
          <input
            id="names"
            name="names"
            type="text"
            required
            value={names}
            onChange={(e) => setNames(e.target.value)}
            className="field"
            placeholder="Tu nombre"
          />
          {state?.errors?.names && <p className="mt-1 text-xs text-danger">{state.errors.names}</p>}
        </div>

        <div>
          <label htmlFor="lastnames" className="field-label">
            Apellido
          </label>
          <input
            id="lastnames"
            name="lastnames"
            type="text"
            required
            value={lastnames}
            onChange={(e) => setLastnames(e.target.value)}
            className="field"
            placeholder="Tu apellido"
          />
          {state?.errors?.lastnames && <p className="mt-1 text-xs text-danger">{state.errors.lastnames}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="field-label">
            Categoría
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="field cursor-pointer"
          >
            {Object.entries(PLAYER_CATEGORY_LABELS).map(([catKey, label]) => (
              <option key={catKey} value={catKey}>
                {label}
              </option>
            ))}
          </select>
          {state?.errors?.category && <p className="mt-1 text-xs text-danger">{state.errors.category}</p>}
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={isPending} className="btn btn-dark">
          <Save className="h-4 w-4" />
          {isPending ? "Guardando..." : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
