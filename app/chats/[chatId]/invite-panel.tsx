"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Link2, UserPlus } from "lucide-react";
import { addPlayerToChat } from "@/src/actions/chat";

/**
 * Invitar a la sala (HU-40): copiar el link para que otro jugador registrado se
 * sume al partido, o agregar directamente a un jugador registrado por su email
 * o teléfono.
 */
export function InvitePanel({ chatId }: { chatId: number }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCopy() {
    await navigator.clipboard.writeText(`${window.location.origin}/chats/${chatId}/join`);
    setCopied(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      const result = await addPlayerToChat(chatId, identifier);
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
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-foreground/60">
          Invitá a otros jugadores registrados: con el link se suman al partido y al chat.
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-foreground/70 transition-colors hover:border-primary hover:text-primary"
        >
          <Link2 className="h-3.5 w-3.5" />
          {copied ? "¡Link copiado!" : "Copiar link"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="off"
          placeholder="Email o teléfono"
          aria-label="Email o teléfono del jugador"
          className="flex-1 rounded-full border border-line bg-background px-4 py-1.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isPending || identifier.trim().length === 0}
          className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </form>

      {feedback ? (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`px-1 text-xs font-medium ${feedback.type === "error" ? "text-danger" : "text-green-700"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
