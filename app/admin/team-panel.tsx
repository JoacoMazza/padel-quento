"use client";

import { useState } from "react";
import { Pencil, Trash2, UserPlus, X } from "lucide-react";
import { AdminAccessLevel } from "@/src/domain/enums";
import { createAdmin, deleteAdmin, getTeam, updateAdmin, type TeamMember } from "@/src/actions/admin";
import { INPUT_CLASS, LABEL_CLASS } from "@/app/admin/holder-fields";

const ACCESS_LEVEL_LABELS: Record<AdminAccessLevel, { label: string; style: string }> = {
  [AdminAccessLevel.OWNER]: { label: "Dueño", style: "bg-primary-light text-primary" },
  [AdminAccessLevel.STAFF]: { label: "Trabajador", style: "bg-line/60 text-foreground/70" },
};

type FormState = { mode: "create" } | { mode: "edit"; member: TeamMember };

/**
 * Sección Equipo del panel, solo para el dueño: los administradores del
 * complejo con su nivel (dueño o trabajador), con alta, edición y baja. El
 * propio dueño no puede editarse el nivel ni darse de baja (ver src/actions/admin.ts).
 */
export function TeamPanel({ team: initialTeam }: { team: TeamMember[] }) {
  const [team, setTeam] = useState(initialTeam);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const result = await getTeam();
    if (result.success) setTeam(result.data);
  }

  async function handleSaved() {
    setForm(null);
    await reload();
  }

  async function handleDelete(id: number) {
    setConfirmingDeleteId(null);
    setError(null);
    const result = await deleteAdmin(id);
    if (!result.success) {
      setError(result.error);
      return;
    }
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-foreground/60">
          El dueño maneja el equipo, los precios, las canchas y las métricas. Los trabajadores atienden la turnera, los
          turnos y los jugadores.
        </p>
        <button type="button" onClick={() => setForm({ mode: "create" })} className="btn btn-sm btn-primary">
          <UserPlus className="h-4 w-4" />
          Agregar administrador
        </button>
      </div>

      {error ? <div className="alert-error">{error}</div> : null}

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="table-head">Nombre</th>
              <th className="table-head">DNI</th>
              <th className="table-head">Email</th>
              <th className="table-head">Nivel</th>
              <th className="table-head text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {team.map((member) => {
              const fullName = `${member.names} ${member.lastnames}`;
              const level = ACCESS_LEVEL_LABELS[member.accessLevel];
              return (
                <tr key={member.id}>
                  <td className="table-cell font-semibold text-foreground">{fullName}</td>
                  <td className="table-cell text-foreground/70">{member.dni ?? "—"}</td>
                  <td className="table-cell text-foreground/70">{member.email}</td>
                  <td className="table-cell">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${level.style}`}>
                      {level.label}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-2">
                      {member.isSelf ? (
                        <span className="text-xs font-semibold text-foreground/50">Vos</span>
                      ) : confirmingDeleteId === member.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDelete(member.id)}
                            className="btn btn-sm btn-danger-soft"
                          >
                            Sí, dar de baja
                          </button>
                          <button type="button" onClick={() => setConfirmingDeleteId(null)} className="btn btn-sm btn-outline">
                            Volver
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={`Editar a ${fullName}`}
                            title="Editar"
                            onClick={() => setForm({ mode: "edit", member })}
                            className="icon-btn"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Dar de baja a ${fullName}`}
                            title="Dar de baja"
                            onClick={() => setConfirmingDeleteId(member.id)}
                            className="icon-btn hover:border-danger/40 hover:text-danger"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form ? <AdminForm form={form} onClose={() => setForm(null)} onSaved={handleSaved} /> : null}
    </div>
  );
}

function AdminForm({ form, onClose, onSaved }: { form: FormState; onClose: () => void; onSaved: () => void }) {
  const member = form.mode === "edit" ? form.member : null;
  const [names, setNames] = useState(member?.names ?? "");
  const [lastnames, setLastnames] = useState(member?.lastnames ?? "");
  const [dni, setDni] = useState(member?.dni ? String(member.dni) : "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [password, setPassword] = useState("");
  const [accessLevel, setAccessLevel] = useState(member?.accessLevel ?? AdminAccessLevel.STAFF);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const data = { names, lastnames, dni: Number(dni), email, accessLevel };
    const result = member
      ? // Sin contraseña nueva, se deja la que tenía.
        await updateAdmin(member.id, password ? { ...data, password } : data)
      : await createAdmin({ ...data, password });

    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  const field = (id: string, label: string, value: string, onChange: (value: string) => void, type = "text") => (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={!(member && type === "password")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">{member ? "Editar administrador" : "Nuevo administrador"}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1 text-foreground/50 hover:bg-line/40 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {field("admin-names", "Nombre", names, setNames)}
            {field("admin-lastnames", "Apellido", lastnames, setLastnames)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("admin-dni", "DNI", dni, setDni)}
            <div>
              <label htmlFor="admin-level" className={LABEL_CLASS}>
                Nivel
              </label>
              <select
                id="admin-level"
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as AdminAccessLevel)}
                className={INPUT_CLASS}
              >
                <option value={AdminAccessLevel.STAFF}>Trabajador</option>
                <option value={AdminAccessLevel.OWNER}>Dueño</option>
              </select>
            </div>
          </div>
          {field("admin-email", "Email", email, setEmail, "email")}
          {field("admin-password", member ? "Nueva contraseña (opcional)" : "Contraseña", password, setPassword, "password")}

          {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-sm btn-outline">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="btn btn-sm btn-primary disabled:opacity-50">
              {isSaving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
