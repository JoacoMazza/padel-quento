"use client";

import { useEffect, useState } from "react";
import { Pencil, X } from "lucide-react";
import { ProfileForm } from "@/app/profile/profile-form";

/** Botón "Editar perfil" que abre la información personal en un modal. */
export function EditProfileModal({ initialData }: { initialData: React.ComponentProps<typeof ProfileForm>["initialData"] }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="btn btn-soft">
        <Pencil className="h-4 w-4" />
        Editar perfil
      </button>

      {isOpen ? (
        <div className="modal-backdrop" onClick={() => setIsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="modal-panel max-h-[90vh] max-w-2xl overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 id="edit-profile-title" className="text-lg font-bold text-foreground">
                Información personal
              </h2>
              <button type="button" onClick={() => setIsOpen(false)} aria-label="Cerrar" className="icon-btn">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ProfileForm initialData={initialData} />
          </div>
        </div>
      ) : null}
    </>
  );
}
