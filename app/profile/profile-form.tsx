"use client";

import { useActionState, useState } from "react";
import { PlayerCategory } from "@/src/domain/enums";
import { updatePlayerProfile, type ProfileState } from "@/src/actions/profile";

const CATEGORY_LABELS: Record<PlayerCategory, string> = {
  [PlayerCategory.FIRST]: "1ª Categoría",
  [PlayerCategory.SECOND]: "2ª Categoría",
  [PlayerCategory.THIRD]: "3ª Categoría",
  [PlayerCategory.FOURTH]: "4ª Categoría",
  [PlayerCategory.FIFTH]: "5ª Categoría",
  [PlayerCategory.SIXTH]: "6ª Categoría",
  [PlayerCategory.SEVENTH]: "7ª Categoría",
  [PlayerCategory.WITHOUT_CATEGORY]: "Sin Categoría",
};

interface ProfileFormProps {
  initialData: {
    names: string;
    lastnames: string;
    category: string;
    photoUrl: string | null;
  };
}

const initialState: ProfileState = {};

export function ProfileForm({ initialData }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updatePlayerProfile, initialState);

  const [names, setNames] = useState(initialData.names);
  const [lastnames, setLastnames] = useState(initialData.lastnames);
  const [category, setCategory] = useState(initialData.category);
  const [photoUrl, setPhotoUrl] = useState(initialData.photoUrl ?? "");

  const initials = `${names[0] ?? ""}${lastnames[0] ?? ""}`.toUpperCase() || "J";

  return (
    <form action={formAction} className="space-y-6">
      {state?.success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-400">
          {state.message}
        </div>
      )}

      {state?.message && !state.success && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-medium text-red-400">
          {state.message}
        </div>
      )}

      {/* Avatar Preview */}
      <div className="flex items-center gap-5">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary/40 bg-card shadow-inner">
          {photoUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Avatar de perfil"
              className="h-full w-full object-cover"
              onError={(e) => {
                // If image fails to load, clear image to show fallback initials
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          <span className="text-xl font-bold text-primary">{initials}</span>
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">
            {names || "Nombre"} {lastnames || "Apellido"}
          </h3>
          <p className="text-xs text-foreground/60">
            Categoría actual: <span className="font-medium text-primary">{CATEGORY_LABELS[category as PlayerCategory] || category}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {/* Nombres */}
        <div>
          <label htmlFor="names" className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">
            Nombre
          </label>
          <input
            id="names"
            name="names"
            type="text"
            required
            value={names}
            onChange={(e) => setNames(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Tu nombre"
          />
          {state?.errors?.names && (
            <p className="mt-1 text-xs text-red-400">{state.errors.names}</p>
          )}
        </div>

        {/* Apellidos */}
        <div>
          <label htmlFor="lastnames" className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">
            Apellido
          </label>
          <input
            id="lastnames"
            name="lastnames"
            type="text"
            required
            value={lastnames}
            onChange={(e) => setLastnames(e.target.value)}
            className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Tu apellido"
          />
          {state?.errors?.lastnames && (
            <p className="mt-1 text-xs text-red-400">{state.errors.lastnames}</p>
          )}
        </div>
      </div>

      {/* Categoría */}
      <div>
        <label htmlFor="category" className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">
          Categoría
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => (
            <option key={catKey} value={catKey}>
              {label}
            </option>
          ))}
        </select>
        {state?.errors?.category && (
          <p className="mt-1 text-xs text-red-400">{state.errors.category}</p>
        )}
      </div>

      {/* Foto de perfil */}
      <div>
        <label htmlFor="photoUrl" className="block text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-2">
          URL de Foto de Perfil
        </label>
        <input
          id="photoUrl"
          name="photoUrl"
          type="text"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="https://ejemplo.com/mi-foto.jpg"
        />
        {state?.errors?.photoUrl && (
          <p className="mt-1 text-xs text-red-400">{state.errors.photoUrl}</p>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}

