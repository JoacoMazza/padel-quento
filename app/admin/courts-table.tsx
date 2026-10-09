"use client";

import { useState } from "react";
import { Ban, CircleCheck, Eye, Pencil } from "lucide-react";
import { courtStatus, type CourtItem } from "@/app/admin/court-status";
import { CourtModal } from "@/app/admin/court-modal";

type ModalState =
  | { mode: "view" | "edit" | "outOfService" | "enable"; court: CourtItem }
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
              const { label: stateLabel, style } = courtStatus(court);

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
                      {stateLabel}
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
                      {court.activeOutOfService ? (
                        <button
                          type="button"
                          aria-label={`Habilitar la cancha ${court.number}`}
                          title="Habilitar"
                          onClick={() => setModal({ mode: "enable", court })}
                          className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:bg-emerald-500/10 hover:text-emerald-600"
                        >
                          <CircleCheck className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Poner fuera de servicio la cancha ${court.number}`}
                          title="Poner fuera de servicio"
                          onClick={() => setModal({ mode: "outOfService", court })}
                          className="cursor-pointer rounded-lg p-2 text-foreground/60 hover:bg-danger/10 hover:text-danger"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
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
      {modal?.mode === "outOfService" || modal?.mode === "enable" ? (
        <CourtModal mode={modal.mode} court={modal.court} onClose={closeModal} onSaved={handleSaved} />
      ) : null}
    </>
  );
}
