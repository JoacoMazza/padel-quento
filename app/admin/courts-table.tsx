"use client";

import { useState } from "react";
import { Ban, CircleCheck, Eye, LayoutGrid, Lock, Pencil, Tag } from "lucide-react";
import { courtStatus, summarizeCourts, type CourtItem } from "@/app/admin/court-status";
import { AllCourtsPriceModal, CourtModal } from "@/app/admin/court-modal";
import { CourtTag } from "@/app/components/ui/court-tag";
import { StatCard } from "@/app/components/ui/stat-card";
import { formatPrice } from "@/app/bookings/slot-utils";

type ModalState =
  | { mode: "view" | "edit" | "outOfService" | "enable"; court: CourtItem }
  | { mode: "allPrices" }
  | null;

/**
 * isOwner: editar una cancha (número, precio, baja) y cambiar el precio de
 * todas es solo para el dueño; un trabajador ve las canchas y maneja los bloqueos.
 */
export function CourtsTable({ courts: initialCourts, isOwner }: { courts: CourtItem[]; isOwner: boolean }) {
  const [courts, setCourts] = useState(initialCourts);
  const [modal, setModal] = useState<ModalState>(null);

  function closeModal() {
    setModal(null);
  }

  function handleSaved(updated: CourtItem) {
    setCourts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    closeModal();
  }

  function handleAllPricesSaved(price: number) {
    setCourts((prev) => prev.map((c) => ({ ...c, price })));
    closeModal();
  }

  if (courts.length === 0) {
    return <p className="text-sm text-foreground/60">No hay canchas registradas todavía.</p>;
  }

  const summary = summarizeCourts(courts);

  return (
    <>
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label="Canchas habilitadas"
          value={summary.enabled}
          suffix={`/ ${summary.total} en servicio`}
          icon={<LayoutGrid className="h-4 w-4" />}
          progress={summary.enabled / summary.total}
          footer={`Capacidad operativa al ${Math.round((summary.enabled / summary.total) * 100)}%`}
        />
        <StatCard
          label="Bloqueos activos"
          value={summary.activeBlocks}
          suffix={summary.activeBlocks === 1 ? "cancha bloqueada" : "canchas bloqueadas"}
          icon={<Lock className="h-4 w-4" />}
          progress={summary.activeBlocks / summary.total}
          tone="primary"
          footer="Los turnos dentro de un bloqueo se cancelan"
        />
        <StatCard
          label="Total de canchas"
          value={summary.total}
          suffix="registradas"
          footer={isOwner ? "Editá precio y estado desde la tabla" : "Poné fuera de servicio o habilitá desde la tabla"}
        />
      </div>

      {isOwner ? (
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={() => setModal({ mode: "allPrices" })} className="btn btn-sm btn-outline">
            <Tag className="h-4 w-4" />
            Cambiar precio de todas
          </button>
        </div>
      ) : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-background/60">
            <tr>
              <th className="table-head">Cancha</th>
              <th className="table-head">Complejo</th>
              <th className="table-head">Precio</th>
              <th className="table-head">Estado</th>
              <th className="table-head text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {courts.map((court) => {
              const { label: stateLabel, style } = courtStatus(court);

              return (
                <tr key={court.id} className="transition-colors hover:bg-background/60">
                  <td className="table-cell">
                    <div className="flex items-center gap-3">
                      <CourtTag number={court.number} size="sm" />
                      <span className="font-semibold text-foreground">Cancha {court.number}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    {court.location ? (
                      <div>
                        <p className="font-semibold text-foreground">{court.location.name}</p>
                        <a
                          href={court.location.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Ver ubicación en Google Maps"
                          className="text-xs text-foreground/60 transition-colors hover:text-primary"
                        >
                          {court.location.address}, {court.location.city}
                        </a>
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell text-foreground/70">{formatPrice(court.price)}</td>
                  <td className="table-cell">
                    <span className={`badge ${style.badge}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                      {stateLabel}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        aria-label={`Ver cancha ${court.number}`}
                        title="Ver"
                        onClick={() => setModal({ mode: "view", court })}
                        className="icon-btn"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {isOwner ? (
                        <button
                          type="button"
                          aria-label={`Editar cancha ${court.number}`}
                          title="Editar"
                          onClick={() => setModal({ mode: "edit", court })}
                          className="icon-btn"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : null}
                      {court.activeOutOfService ? (
                        <button
                          type="button"
                          aria-label={`Habilitar la cancha ${court.number}`}
                          title="Habilitar"
                          onClick={() => setModal({ mode: "enable", court })}
                          className="btn btn-sm btn-dark"
                        >
                          <CircleCheck className="h-4 w-4" />
                          Habilitar
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Poner fuera de servicio la cancha ${court.number}`}
                          title="Poner fuera de servicio"
                          onClick={() => setModal({ mode: "outOfService", court })}
                          className="icon-btn hover:border-danger/40 hover:text-danger"
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
      {modal?.mode === "allPrices" ? (
        <AllCourtsPriceModal initialPrice={courts[0].price} onClose={closeModal} onSaved={handleAllPricesSaved} />
      ) : null}
    </>
  );
}
