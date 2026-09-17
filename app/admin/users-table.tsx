"use client";

import { useState, useTransition } from "react";
import { Search, ShieldOff, ShieldCheck } from "lucide-react";
import { blockPlayer, unblockPlayer, type PlayerAdminItem } from "@/src/actions/player";

const CATEGORY_LABELS: Record<string, string> = {
  "1st": "1ª",
  "2nd": "2ª",
  "3rd": "3ª",
  "4th": "4ª",
  "5th": "5ª",
  "6th": "6ª",
  "7th": "7ª",
  without_category: "Sin categoría",
};

export function UsersTable({ players: initialPlayers }: { players: PlayerAdminItem[] }) {
  const [players, setPlayers] = useState(initialPlayers);
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const filtered = players.filter((p) => {
    const term = search.toLowerCase();
    return (
      `${p.names} ${p.lastnames}`.toLowerCase().includes(term) ||
      p.email.toLowerCase().includes(term)
    );
  });

  function handleToggleBlock(player: PlayerAdminItem) {
    setActionError(null);
    setPendingId(player.id);
    const action = player.isBlocked ? unblockPlayer : blockPlayer;
    startTransition(async () => {
      const result = await action(player.id);
      setPendingId(null);
      if (!result.success) {
        setActionError({ id: player.id, msg: result.error });
        return;
      }
      setPlayers((prev) =>
        prev.map((p) => (p.id === player.id ? { ...p, isBlocked: !p.isBlocked } : p)),
      );
    });
  }

  if (players.length === 0) {
    return <p className="text-sm text-foreground/60">No hay jugadores registrados todavía.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-line bg-background py-2.5 pl-9 pr-4 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-background/60">
            <tr>
              <th className="px-5 py-3 font-semibold text-foreground/70">Jugador</th>
              <th className="px-5 py-3 font-semibold text-foreground/70">Email</th>
              <th className="px-5 py-3 font-semibold text-foreground/70">DNI</th>
              <th className="px-5 py-3 font-semibold text-foreground/70">Categoría</th>
              <th className="px-5 py-3 font-semibold text-foreground/70">Estado</th>
              <th className="px-5 py-3 text-right font-semibold text-foreground/70">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-sm text-foreground/50">
                  Sin resultados para &quot;{search}&quot;
                </td>
              </tr>
            ) : (
              filtered.map((player) => {
                const isThisPending = isPending && pendingId === player.id;
                const thisError = actionError?.id === player.id ? actionError.msg : null;

                return (
                  <tr key={player.id}>
                    {/* Nombre */}
                    <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">
                      {player.names} {player.lastnames}
                    </td>

                    {/* Email */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/70">
                      {player.email}
                    </td>

                    {/* DNI */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/70">
                      {player.dni ?? <span className="italic text-foreground/35">—</span>}
                    </td>

                    {/* Categoría */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-foreground/70">
                      {CATEGORY_LABELS[player.category] ?? player.category}
                    </td>

                    {/* Estado */}
                    <td className="whitespace-nowrap px-5 py-3.5">
                      {player.isBlocked ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-2.5 py-1 text-xs font-semibold text-danger">
                          <span className="h-2 w-2 rounded-full bg-danger" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                          <span className="h-2 w-2 rounded-full bg-success" />
                          Activo
                        </span>
                      )}
                    </td>

                    {/* Acciones */}
                    <td className="whitespace-nowrap px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          disabled={isThisPending}
                          aria-label={
                            player.isBlocked
                              ? `Desbloquear a ${player.names}`
                              : `Bloquear a ${player.names}`
                          }
                          title={player.isBlocked ? "Desbloquear" : "Bloquear"}
                          onClick={() => handleToggleBlock(player)}
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            player.isBlocked
                              ? "bg-success/10 text-success hover:bg-success/20"
                              : "bg-danger/10 text-danger hover:bg-danger/20"
                          }`}
                        >
                          {isThisPending ? (
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : player.isBlocked ? (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldOff className="h-3.5 w-3.5" />
                          )}
                          {isThisPending
                            ? "Procesando…"
                            : player.isBlocked
                              ? "Desbloquear"
                              : "Bloquear"}
                        </button>

                        {thisError ? (
                          <p className="text-[11px] font-medium text-danger">{thisError}</p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Contador */}
      <p className="text-xs text-foreground/40">
        {filtered.length} de {players.length} jugador{players.length !== 1 ? "es" : ""}
      </p>
    </div>
  );
}

