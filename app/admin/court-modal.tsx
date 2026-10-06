"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { CourtState, OutOfServiceReason } from "@/src/domain/enums";
import { updateCourt } from "@/src/actions/court";
import { createOutOfService, endOutOfService } from "@/src/actions/outOfService";
import { isOutOfServiceActive } from "@/src/domain/out-of-service";
import {
  EDITABLE_COURT_STATES,
  OUT_OF_SERVICE_REASON_LABELS,
  STATE_LABELS,
  courtStatus,
  type CourtItem,
} from "@/app/admin/court-status";

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
    const { label, style } = courtStatus(court);
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
                {label}
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

  if (mode === "outOfService") {
    return <OutOfServiceForm court={court} onClose={onClose} onSaved={props.onSaved} />;
  }

  return <EnableConfirm court={court} onClose={onClose} onSaved={props.onSaved} />;
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
  // Una cancha con un estado que ya no se edita a mano (p. ej. mantenimiento) arranca en Disponible.
  const [state, setState] = useState<CourtState>(
    EDITABLE_COURT_STATES.includes(court.state) ? court.state : CourtState.AVAILABLE,
  );
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
    onSaved({ ...court, number: result.data.number, state: result.data.state, price: result.data.price });
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
            {EDITABLE_COURT_STATES.map((s) => (
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

const FIELD_CLASS =
  "w-full rounded-xl border border-line bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const LABEL_CLASS = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-foreground/70";

/**
 * Crea un bloqueo (OutOfService) de la cancha: desde este momento o programado
 * para un período futuro. Los turnos que caen dentro del período se cancelan.
 */
function OutOfServiceForm({
  court,
  onClose,
  onSaved,
}: {
  court: CourtItem;
  onClose: () => void;
  onSaved: (court: CourtItem) => void;
}) {
  const [isScheduled, setIsScheduled] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState<OutOfServiceReason>(OutOfServiceReason.MAINTENANCE);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const result = await createOutOfService({
      courtId: court.id,
      fromDateTime: isScheduled ? new Date(from) : new Date(),
      toDateTime: new Date(to),
      reason,
      description: description.trim() || null,
    });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // Un bloqueo programado no cambia el estado de la cancha hasta que empiece.
    const created = result.data;
    onSaved(
      isOutOfServiceActive(created)
        ? { ...court, activeOutOfService: { id: created.id, reason: created.reason, toDateTime: created.toDateTime } }
        : court,
    );
  }

  return (
    <ModalShell title={`Poner fuera de servicio la cancha ${court.number}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="flex gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="period" checked={!isScheduled} onChange={() => setIsScheduled(false)} />
            Desde ahora
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="period" checked={isScheduled} onChange={() => setIsScheduled(true)} />
            Programado
          </label>
        </fieldset>

        {isScheduled ? (
          <div>
            <label htmlFor="oos-from" className={LABEL_CLASS}>
              Desde
            </label>
            <input
              id="oos-from"
              type="datetime-local"
              required
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={FIELD_CLASS}
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="oos-to" className={LABEL_CLASS}>
            Hasta
          </label>
          <input
            id="oos-to"
            type="datetime-local"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <div>
          <label htmlFor="oos-reason" className={LABEL_CLASS}>
            Motivo
          </label>
          <select
            id="oos-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as OutOfServiceReason)}
            className={FIELD_CLASS}
          >
            {Object.values(OutOfServiceReason).map((r) => (
              <option key={r} value={r}>
                {OUT_OF_SERVICE_REASON_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="oos-description" className={LABEL_CLASS}>
            Descripción (opcional)
          </label>
          <input
            id="oos-description"
            type="text"
            maxLength={255}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={FIELD_CLASS}
          />
        </div>

        <p className="text-xs text-foreground/60">Los turnos reservados dentro de este período se cancelarán.</p>

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
            className="cursor-pointer rounded-xl bg-danger px-4 py-2 text-sm font-semibold text-white shadow hover:bg-danger/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Guardando..." : "Guardar bloqueo"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/** Habilita la cancha finalizando en este momento su bloqueo activo. */
function EnableConfirm({
  court,
  onClose,
  onSaved,
}: {
  court: CourtItem;
  onClose: () => void;
  onSaved: (court: CourtItem) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleConfirm() {
    if (!court.activeOutOfService) return;
    setError(null);
    setIsSaving(true);

    const result = await endOutOfService(court.activeOutOfService.id);

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved({ ...court, activeOutOfService: null });
  }

  return (
    <ModalShell title={`Habilitar la cancha ${court.number}`} onClose={onClose}>
      <p className="text-sm text-foreground/70">
        ¿Estás seguro de que querés volver a habilitar la{" "}
        <span className="font-semibold text-foreground">Cancha {court.number}</span>? Su bloqueo actual finalizará en
        este momento.
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
          className="cursor-pointer rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Guardando..." : "Confirmar"}
        </button>
      </div>
    </ModalShell>
  );
}
