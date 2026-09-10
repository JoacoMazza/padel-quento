"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CourtState } from "@/src/domain/enums";
import { updateCourt, deleteCourt } from "@/src/actions/court";
import { STATE_LABELS, STATE_BADGE_STYLES, type CourtItem } from "@/app/admin/court-status";

type CourtModalProps =
  | { mode: "view"; court: CourtItem; onClose: () => void }
  | { mode: "edit"; court: CourtItem; onClose: () => void; onSaved: (court: CourtItem) => void }
  | { mode: "delete"; court: CourtItem; onClose: () => void; onDeleted: (id: number) => void };

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CourtModal(props: CourtModalProps) {
  const { mode, court, onClose } = props;

  if (mode === "view") {
    const style = STATE_BADGE_STYLES[court.state];
    return (
      <ModalShell title={`Cancha ${court.number}`} onClose={onClose}>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between border-b border-line pb-2">
            <dt className="font-medium text-foreground/60">ID</dt>
            <dd className="font-semibold text-foreground">{court.id}</dd>
          </div>
          <div className="flex justify-between border-b border-line pb-2">
            <dt className="font-medium text-foreground/60">Número</dt>
            <dd className="font-semibold text-foreground">{court.number}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="font-medium text-foreground/60">Estado</dt>
            <dd>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}
              >
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                {STATE_LABELS[court.state]}
              </span>
            </dd>
          </div>
        </dl>
      </ModalShell>
    );
  }

  if (mode === "edit") {
    return <EditForm court={court} onClose={onClose} onSaved={props.onSaved} />;
  }

  return <DeleteConfirm court={court} onClose={onClose} onDeleted={props.onDeleted} />;
}

function EditForm({
  court,
  onClose,
  onSaved,
}: {
  court: CourtItem;
  onClose: () => void;
  onSaved: (court: CourtItem) => void;
}) {
  const [number, setNumber] = useState(court.number);
  const [state, setState] = useState<CourtState>(court.state);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await updateCourt(court.id, { number, state });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved({ id: result.data.id, number: result.data.number, state: result.data.state });
  }

  return (
    <ModalShell title={`Editar cancha ${court.number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="edit-number" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Número
          </label>
          <input
            id="edit-number"
            type="number"
            min={1}
            required
            value={number}
            onChange={(e) => setNumber(Number(e.target.value))}
            className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="edit-state" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Estado
          </label>
          <select
            id="edit-state"
            value={state}
            onChange={(e) => setState(e.target.value as CourtState)}
            className="w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.values(CourtState).map((s) => (
              <option key={s} value={s}>
                {STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>

        {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-line/40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DeleteConfirm({
  court,
  onClose,
  onDeleted,
}: {
  court: CourtItem;
  onClose: () => void;
  onDeleted: (id: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setError(null);
    setIsDeleting(true);

    const result = await deleteCourt(court.id);

    setIsDeleting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDeleted(court.id);
  }

  return (
    <ModalShell title={`Eliminar cancha ${court.number}`} onClose={onClose}>
      <p className="text-sm text-foreground/70">
        ¿Estás seguro de que querés eliminar la <span className="font-semibold text-foreground">Cancha {court.number}</span>?
        Esta acción no se puede deshacer.
      </p>

      {error ? <p className="mt-3 text-sm font-medium text-danger">{error}</p> : null}

      <div className="flex justify-end gap-3 pt-5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-line/40"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow hover:bg-danger/90 disabled:opacity-50"
        >
          {isDeleting ? "Eliminando..." : "Eliminar"}
        </button>
      </div>
    </ModalShell>
  );
}
