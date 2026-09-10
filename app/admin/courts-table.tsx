"use client";

import { useState } from "react";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { STATE_LABELS, STATE_BADGE_STYLES, type CourtItem } from "@/app/admin/court-status";
import { CourtModal } from "@/app/admin/court-modal";

type ModalState =
  | { mode: "view" | "edit" | "delete"; court: CourtItem }
  | null;

export function CourtsTable({ courts: initialCourts }: { courts: CourtItem[] }) {
  const [courts, setCourts] = useState(initialCourts);
  const [modal, setModal] = useState<ModalState>(null);

  function closeModal() {
    setModal(null);
  }

  function handleSaved(updated: CourtItem) {
    setCourts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    closeModal();
  }

  function handleDeleted(id: number) {
    setCourts((prev) => prev.filter((c) => c.id !== id));
    closeModal();
  }

  if (courts.length === 0) {
    return <p className="text-sm text-foreground/60">No hay canchas registradas todavía.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-background/60">
            <tr>
              <th className="px-5 py-3 font-semibold text-foreground/70">ID</th>
              <th className="px-5 py-3 font-semibold text-foreground/70">Número</th>
              <th className="px-5 py-3 font-semibold text-foreground/70">Estado</th>
              <th className="px-5 py-3 text-right font-semibold text-foreground/70">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {courts.map((court) => {
              const style = STATE_BADGE_STYLES[court.state];

              return (
                <tr key={court.id}>
                  <td className="whitespace-nowrap px-5 py-3.5 text-foreground/70">{court.id}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">
                    Cancha {court.number}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      {STATE_LABELS[court.state]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Ver cancha ${court.number}`}
                        title="Ver"
                        onClick={() => setModal({ mode: "view", court })}
                        className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:bg-line/40 hover:text-foreground"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Editar cancha ${court.number}`}
                        title="Editar"
                        onClick={() => setModal({ mode: "edit", court })}
                        className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:text-blue-500/80 hover:bg-blue-500/20"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Eliminar cancha ${court.number}`}
                        title="Eliminar"
                        onClick={() => setModal({ mode: "delete", court })}
                        className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal?.mode === "view" ? <CourtModal mode="view" court={modal.court} onClose={closeModal} /> : null}
      {modal?.mode === "edit" ? (
        <CourtModal mode="edit" court={modal.court} onClose={closeModal} onSaved={handleSaved} />
      ) : null}
      {modal?.mode === "delete" ? (
        <CourtModal mode="delete" court={modal.court} onClose={closeModal} onDeleted={handleDeleted} />
      ) : null}
    </>
  );
}
