"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { Lock, MessageCircle, Send } from "lucide-react";
import { CHAT_MESSAGE_MAX_LENGTH } from "@/src/domain/constants";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import { getChatMessages, sendMessage, type ChatMessage } from "@/src/actions/chat";

/** Cada cuántos milisegundos se buscan mensajes nuevos de los otros jugadores. */
const POLL_INTERVAL_MS = 5000;

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatRoom({
  chatId,
  currentPlayerId,
  initialMessages,
  isClosed,
}: {
  chatId: number;
  currentPlayerId: number;
  initialMessages: ChatMessage[];
  isClosed: boolean;
}) {
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
        <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-2 bg-background/60 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-line/50 text-foreground/40">
            <MessageCircle className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-foreground/70">Todavía no hay mensajes</p>
          <p className="max-w-sm text-xs text-foreground/50">
            Esta sala se creó automáticamente para que coordinen el partido (lado de juego, pelotas, llegada).
            Solo se ve tu nombre y categoría: tu teléfono y tu email no se comparten.
          </p>
        </div>
      ) : (
        <div
          ref={listRef}
          className="flex max-h-[480px] min-h-[320px] flex-1 flex-col gap-3 overflow-y-auto bg-background/60 p-4"
        >
          {messages.map((message) => {
            const isMine = message.sender.id === currentPlayerId;
            return (
              <div key={message.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                <p className="mb-1 flex items-center gap-1.5 px-1 text-xs text-foreground/60">
                  <span className="font-semibold text-foreground/80">
                    {message.sender.names} {message.sender.lastnames}
                  </span>
                  <span className="rounded-full bg-line/50 px-2 py-0.5 text-[10px] font-medium">
                    {PLAYER_CATEGORY_LABELS[message.sender.category] ?? message.sender.category}
                  </span>
                </p>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                    isMine ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-line/40 text-foreground"
                  }`}
                >
                  {message.content}
                </div>
                <span className="mt-0.5 px-1 text-[10px] text-foreground/40" suppressHydrationWarning>
                  {formatTime(message.sentAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {isClosed ? (
        <div className="flex items-center gap-2 border-t border-line bg-line/20 px-4 py-3 text-xs text-foreground/60">
          <Lock className="h-4 w-4 shrink-0" />
          <p>Este chat está cerrado porque el turno ya finalizó. Podés leer la conversación, pero no enviar mensajes nuevos.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="border-t border-line p-3">
          {error && (
            <p role="alert" className="mb-2 px-1 text-xs text-red-400">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              name="content"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              autoComplete="off"
              placeholder="Escribir mensaje…"
              aria-label="Mensaje"
              className="flex-1 rounded-full border border-line bg-background px-4 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={isPending || draft.trim().length === 0}
              aria-label="Enviar mensaje"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </>
  );
}
