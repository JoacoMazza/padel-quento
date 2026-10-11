"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Lock, MessageCircle, Send } from "lucide-react";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/src/domain/constants";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import { getChatMessages, sendMessage, type ChatMessage } from "@/src/actions/chat";
import type { ChatClosureReason } from "@/src/domain/chat-closure";

/** Cada cuántos milisegundos se buscan mensajes nuevos de los otros jugadores. */
const POLL_INTERVAL_MS = 5000;

const CLOSED_REASON_LABELS: Record<ChatClosureReason, string> = {
  finished: "el turno ya finalizó",
  cancelled: "el turno fue cancelado",
};

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatRoom({
  chatId,
  currentPlayerId,
  initialMessages,
  closedReason,
}: {
  chatId: number;
  currentPlayerId: number;
  initialMessages: ChatMessage[];
  closedReason: ChatClosureReason | null;
}) {
  const isClosed = closedReason !== null;
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  // Sin websockets en el proyecto: se consulta periódicamente. El servidor es la
  // fuente de verdad, por eso se reemplaza la lista completa en vez de mezclarla.
  // Con la sala cerrada no pueden llegar mensajes nuevos, así que no se sondea.
  useEffect(() => {
    if (isClosed) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const result = await getChatMessages(chatId);
      if (result.success) setMessages(result.data);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [chatId, isClosed]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.trim().length === 0) return;

    startTransition(async () => {
      const result = await sendMessage(chatId, draft);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      setDraft("");
      // El sondeo puede haber traído ya este mensaje mientras se enviaba.
      setMessages((current) =>
        current.some((message) => message.id === result.data.id) ? current : [...current, result.data],
      );
    });
  }

  return (
    <>
      {messages.length === 0 ? (
        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-background text-foreground/40">
            <MessageCircle className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-foreground/70">Todavía no hay mensajes</p>
          <p className="max-w-sm text-xs text-foreground/50">
            Esta sala se creó automáticamente para que coordinen el partido (lado de juego, pelotas, llegada).
            Solo se ve tu nombre y categoría: tu teléfono y tu email no se comparten.
          </p>
        </div>
      ) : (
        <div ref={listRef} className="flex max-h-[520px] min-h-[320px] flex-1 flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          {messages.map((message) => {
            const isMine = message.sender.id === currentPlayerId;
            return (
              <div key={message.id} className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
                {!isMine ? (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                    {`${message.sender.names.charAt(0)}${message.sender.lastnames.charAt(0)}`.toUpperCase()}
                  </span>
                ) : null}
                <div className={`flex max-w-[80%] flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <p className={`mb-1 flex items-center gap-2 px-1 text-xs ${isMine ? "flex-row-reverse" : ""}`}>
                    <span className={`font-semibold ${isMine ? "text-primary" : "text-foreground"}`}>
                      {isMine ? "Vos" : `${message.sender.names} ${message.sender.lastnames}`}
                    </span>
                    {!isMine ? (
                      <span className="text-[10px] text-foreground/50">
                        {PLAYER_CATEGORY_LABELS[message.sender.category] ?? message.sender.category}
                      </span>
                    ) : null}
                    <span className="text-[10px] text-foreground/40" suppressHydrationWarning>
                      {formatTime(message.sentAt)} hs
                    </span>
                  </p>
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm ${
                      isMine ? "rounded-tr-sm bg-primary text-white" : "rounded-tl-sm bg-background text-foreground"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {closedReason ? (
        <div className="flex items-center gap-2 border-t border-line bg-background px-5 py-4 text-xs text-foreground/60">
          <Lock className="h-4 w-4 shrink-0" />
          <p>Este chat está cerrado porque {CLOSED_REASON_LABELS[closedReason]}. Podés leer la conversación, pero no enviar mensajes nuevos.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-line bg-background/50 p-4">
          {error && (
            <p role="alert" className="mb-2 px-1 text-xs text-danger">
              {error}
            </p>
          )}
          <div className="flex items-center gap-3">
            <input
              type="text"
              name="content"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              autoComplete="off"
              placeholder="Escribir mensaje…"
              aria-label="Mensaje"
              className="field flex-1 bg-card"
            />
            <button
              type="submit"
              disabled={isPending || draft.trim().length === 0}
              aria-label="Enviar mensaje"
              className="btn btn-primary"
            >
              <span className="hidden sm:inline">Enviar</span>
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </>
  );
}
