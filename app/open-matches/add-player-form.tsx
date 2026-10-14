"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { addPlayerToMatch } from "@/src/actions/match";

/**
 * Agregar al partido a un jugador registrado por su email o teléfono (HU-40).
 * Solo se muestra a los miembros del partido: en Mis turnos y en el detalle del
 * partido abierto.
 */
export function AddPlayerForm({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await addPlayerToMatch(bookingId, identifier);
      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }
      setIdentifier("");
      setFeedback({ type: "success", message: `${result.data.names} ${result.data.lastnames} se sumó al partido.` });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="off"
          placeholder="Email o teléfono"
          aria-label="Email o teléfono del jugador"
          className="min-w-0 flex-1 rounded-full border border-line bg-background px-4 py-1.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isPending || identifier.trim().length === 0}
          className="btn btn-primary btn-sm shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus className="h-4 w-4" />
          Agregar
        </button>
      </div>
      {feedback ? (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`px-1 text-xs font-medium ${feedback.type === "error" ? "text-danger" : "text-success"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
