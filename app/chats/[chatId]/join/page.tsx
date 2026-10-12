import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { Calendar, Clock, MapPin, Users } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getChatById } from "@/src/actions/chat";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { formatLongDate, minutesToTimeLabel } from "@/app/bookings/slot-utils";
import { JoinChatButton } from "./join-chat-button";

/**
 * Destino del link para compartir la sala (HU-40). Muestra el partido sin datos
 * de sus jugadores y permite sumarse; quien ya participa entra directo al chat.
 */
export default async function JoinChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const { chatId } = await params;
  const id = Number(chatId);

  const result = Number.isInteger(id) ? await getChatById(id) : null;
  const chat = result?.success ? result.data : null;
  if (!chat) {
    redirect("/bookings");
  }

  const dataSource = await getDataSource();
  const player = await dataSource
    .getRepository<Player>("Player")
    .findOne({ where: { account: { email: session.user.email } } });
  if (player && chat.participants.some((participant) => participant.id === player.id)) {
    redirect(`/chats/${chat.id}`);
  }

  const { fromDateTime, courtNumber } = chat.booking;
  const isFull = chat.confirmedPlayers >= OPEN_MATCH_MAX_PLAYERS;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader
        active="/my-bookings"
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
      />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-card p-6 shadow-sm">
          <div>
            <h1 className="text-xl font-extrabold text-foreground">Te invitaron a un partido</h1>
            <p className="mt-1 text-sm text-foreground/60">
              Sumate para ocupar un lugar en el partido y entrar al chat con el resto de los jugadores.
            </p>
          </div>

          <ul className="flex flex-col gap-2 text-sm text-foreground">
            <li className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-foreground/50" />
              {formatLongDate(fromDateTime)}
            </li>
            <li className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-foreground/50" />
              {minutesToTimeLabel(fromDateTime.getHours() * 60 + fromDateTime.getMinutes())}
            </li>
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Cancha {courtNumber} · Villa Elisa
            </li>
            <li className="flex items-center gap-2">
              <Users className="h-4 w-4 text-foreground/50" />
              {chat.confirmedPlayers}/{OPEN_MATCH_MAX_PLAYERS} jugadores
            </li>
          </ul>

          {chat.isClosed ? (
            <p className="rounded-lg bg-line/40 px-3 py-2 text-sm text-foreground/70">
              Este partido ya no admite jugadores: el turno {chat.closedReason === "cancelled" ? "fue cancelado" : "ya finalizó"}.
            </p>
          ) : isFull ? (
            <p className="rounded-lg bg-line/40 px-3 py-2 text-sm text-foreground/70">
              El partido ya está completo, no quedan lugares libres.
            </p>
          ) : player ? (
            <JoinChatButton chatId={chat.id} />
          ) : (
            <p className="rounded-lg bg-line/40 px-3 py-2 text-sm text-foreground/70">
              Necesitás una cuenta de jugador para sumarte a un partido.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
