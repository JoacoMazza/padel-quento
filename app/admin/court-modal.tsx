"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CourtState } from "@/src/domain/enums";
import { updateCourt, setCourtOutOfService } from "@/src/actions/court";
import { STATE_LABELS, STATE_BADGE_STYLES, type CourtItem } from "@/app/admin/court-status";

type CourtModalProps =
  | { mode: "view"; court: CourtItem; onClose: () => void }
  | { mode: "edit"; court: CourtItem; onClose: () => void; onSaved: (court: CourtItem) => void }
  | { mode: "outOfService" | "enable"; court: CourtItem; onClose: () => void; onSaved: (court: CourtItem) => void };

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
            className="cursor-pointer rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
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
          <div className="flex justify-between border-b border-line pb-2">
            <dt className="font-medium text-foreground/60">Precio</dt>
            <dd className="font-semibold text-foreground">${court.price}</dd>
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

  return <StateChangeConfirm mode={mode} court={court} onClose={onClose} onSaved={props.onSaved} />;
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
  const [price, setPrice] = useState(court.price);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await updateCourt(court.id, { number, state, price });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved({ id: result.data.id, number: result.data.number, state: result.data.state, price: result.data.price });
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
          <label htmlFor="edit-price" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70">
            Precio ($)
          </label>
          <input
            id="edit-price"
            type="number"
            min={1}
            required
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
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
            className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm font-medium hover:bg-line/40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

const STATE_CHANGE_COPY = {
  outOfService: {
    title: "Poner fuera de servicio la cancha",
    question: "¿Estás seguro de que querés poner fuera de servicio la",
  },
  enable: {
    title: "Habilitar la cancha",
    question: "¿Estás seguro de que querés volver a habilitar la",
  },
};

function StateChangeConfirm({
  mode,
  court,
  onClose,
  onSaved,
}: {
  mode: "outOfService" | "enable";
  court: CourtItem;
  onClose: () => void;
  onSaved: (court: CourtItem) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const copy = STATE_CHANGE_COPY[mode];

  async function handleConfirm() {
    setError(null);
    setIsSaving(true);

    const result =
      mode === "outOfService"
        ? await setCourtOutOfService(court.id)
        : await updateCourt(court.id, { state: CourtState.AVAILABLE });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved({ id: result.data.id, number: result.data.number, state: result.data.state, price: result.data.price });
  }

  return (
    <ModalShell title={`${copy.title} ${court.number}`} onClose={onClose}>
      <p className="text-sm text-foreground/70">
        {copy.question} <span className="font-semibold text-foreground">Cancha {court.number}</span>?
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
          onClick={handleConfirm}
          disabled={isSaving}
          className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold shadow disabled:opacity-50 disabled:cursor-not-allowed ${
            mode === "outOfService"
              ? "bg-danger text-white hover:bg-danger/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          {isSaving ? "Guardando..." : "Confirmar"}
        </button>
      </div>
    </ModalShell>
  );
}
