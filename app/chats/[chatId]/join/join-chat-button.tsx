"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { joinChatMatch } from "@/src/actions/chat";

export function JoinChatButton({ chatId }: { chatId: number }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    setError(null);
    startTransition(async () => {
      const result = await joinChatMatch(chatId);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push(`/chats/${chatId}`);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-light px-3 py-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={isPending}
        onClick={handleJoin}
        className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" />
        {isPending ? "Sumándote…" : "Sumarme al partido"}
      </button>
    </div>
  );
}
