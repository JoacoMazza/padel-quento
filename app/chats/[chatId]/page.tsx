import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, MapPin } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { Avatar } from "@/app/components/ui/avatar";
import { CourtTag } from "@/app/components/ui/court-tag";
import { CLUB_LOCATION, CLUB_MAPS_URL } from "@/app/components/club-info";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getChatById, getChatMessages } from "@/src/actions/chat";
import { PLAYER_CATEGORY_LABELS } from "@/src/domain/player-category-labels";
import { ChatRoom } from "./chat-room";
import { InvitePanel } from "./invite-panel";
import { SLOT_DURATION_MINUTES, formatLongDate, minutesToTimeLabel } from "@/app/bookings/slot-utils";

export const metadata: Metadata = { title: "Chat del partido" };

function initialsOf(names: string, lastnames: string) {
  return `${names.charAt(0)}${lastnames.charAt(0)}`.toUpperCase();
}

export default async function ChatPage({
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

  const dataSource = await getDataSource();
  const players = dataSource.getRepository<Player>("Player");
  const player = await players.findOne({ where: { account: { email: session.user.email } } });

  const result = Number.isInteger(id) ? await getChatById(id) : null;
  const chat = result?.success ? result.data : null;
  const participants = chat?.participants ?? [];
  // Solo los jugadores que se sumaron con su cuenta al partido pueden entrar a la sala.
  const isParticipant = player ? participants.some((participant) => participant.id === player.id) : false;

  if (!player || !chat) {
    redirect("/my-bookings");
  }
  // Quien llega por el link compartido sin participar todavía puede sumarse (HU-40).
  if (!isParticipant) {
    redirect(`/chats/${chat.id}/join`);
  }

  const booking = chat.booking;
  const messagesResult = await getChatMessages(chat.id);
  const initialMessages = messagesResult.success ? messagesResult.data : [];
  const startLabel = minutesToTimeLabel(booking.fromDateTime.getHours() * 60 + booking.fromDateTime.getMinutes());

  return (
    <PageShell active="/my-bookings" user={session.user} width="narrow">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/my-bookings"
          className="flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis turnos
          <span className="text-foreground/30">/</span>
          <span className="font-bold tracking-wide text-primary uppercase">Sala de juego #{chat.id}</span>
        </Link>
      </div>

      <div className="card flex flex-col overflow-hidden">
        {/* Encabezado de la sala */}
        <div className="border-b border-line p-5 sm:p-6">
          <div className="flex items-start gap-4">
            {booking.courtNumber !== null ? <CourtTag number={booking.courtNumber} size="lg" /> : null}
            <div className="flex-1">
              <a
                href={CLUB_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.12em] text-foreground/50 uppercase transition-colors hover:text-primary"
                title="Ver en Google Maps"
              >
                <MapPin className="h-3 w-3" />
                {CLUB_LOCATION} · Cancha {booking.courtNumber}
              </a>
              <h1 className="mt-1 text-xl font-extrabold text-foreground sm:text-2xl">
                Partido Cancha {booking.courtNumber} — {startLabel} hs
              </h1>
              <p className="mt-0.5 text-sm text-foreground/60">
                {formatLongDate(booking.fromDateTime)} · Duración: {SLOT_DURATION_MINUTES} minutos
              </p>
            </div>
            <span className="badge badge-success hidden sm:inline-flex">
              {participants.length} participante{participants.length === 1 ? "" : "s"}
            </span>
          </div>

          {/* Participantes */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {participants.map((participant) => (
              <div key={participant.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <Avatar initials={initialsOf(participant.names, participant.lastnames)} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {participant.names} {participant.lastnames.charAt(0)}.
                  </p>
                  <p className="text-xs text-foreground/50">
                    {PLAYER_CATEGORY_LABELS[participant.category] ?? participant.category}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {chat.isClosed ? null : <InvitePanel chatId={chat.id} />}

        <ChatRoom
          chatId={chat.id}
          currentPlayerId={player.id}
          initialMessages={initialMessages}
          closedReason={chat.closedReason}
        />
      </div>

      <p className="mt-4 flex items-center gap-2 text-xs text-foreground/50">
        <Lock className="h-3.5 w-3.5 text-success" />
        Chat privado exclusivo para los jugadores anotados al turno. Tu teléfono y tu email no se comparten.
      </p>
    </PageShell>
  );
}
