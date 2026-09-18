import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin, MessageCircle, Send, Users } from "lucide-react";
import { AppHeader } from "@/app/components/app-header";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getChatById } from "@/src/actions/chat";
import { formatLongDate, minutesToTimeLabel } from "@/app/bookings/slot-utils";

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
  const player = await players.findOne({ where: { email: session.user.email } });

  const result = Number.isInteger(id) ? await getChatById(id) : null;
  const chat = result?.success ? result.data : null;
  const participants = chat?.match?.matchPlayers ?? [];
  // Solo los jugadores que se sumaron con su cuenta al partido pueden entrar a la sala.
  const isParticipant = player ? participants.some((mp) => mp.player?.id === player.id) : false;

  if (!chat || !isParticipant) {
    redirect("/my-bookings");
  }

  const booking = chat.match.booking;

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader
        active="/my-bookings"
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
        <Link
          href="/my-bookings"
          className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-foreground/60 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis turnos
        </Link>

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          {/* Encabezado de la sala */}
          <div className="flex items-center gap-3 border-b border-line p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
              <MessageCircle className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <h1 className="text-base font-extrabold text-foreground">Chat del partido</h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-foreground/60">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Cancha {booking.court?.number}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatLongDate(booking.fromDateTime)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {minutesToTimeLabel(booking.fromDateTime.getHours() * 60 + booking.fromDateTime.getMinutes())}
                </span>
              </p>
            </div>
          </div>

          {/* Participantes */}
          <div className="flex items-start gap-2 border-b border-line px-4 py-3">
            <Users className="mt-1 h-4 w-4 shrink-0 text-foreground/50" />
            <div className="flex flex-wrap items-center gap-2">
              {participants.map((mp) => (
                <span
                  key={mp.player.id}
                  className="flex items-center gap-1.5 rounded-full bg-line/40 px-2.5 py-1 text-xs font-medium text-foreground/80"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                    {initialsOf(mp.player.names, mp.player.lastnames)}
                  </span>
                  {mp.player.names} {mp.player.lastnames}
                </span>
              ))}
            </div>
          </div>

          {/* Mensajes: el envío llega en otra entrega, por ahora solo se ve la sala vacía */}
          <div className="flex min-h-[320px] flex-1 flex-col items-center justify-center gap-2 bg-background/60 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-line/50 text-foreground/40">
              <MessageCircle className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold text-foreground/70">Todavía no hay mensajes</p>
            <p className="max-w-sm text-xs text-foreground/50">
              Esta sala se creó automáticamente para que coordinen el partido (lado de juego, pelotas, llegada).
              Muy pronto vas a poder escribir acá.
            </p>
          </div>

          {/* Compositor deshabilitado: el envío de mensajes es una historia futura */}
          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                disabled
                placeholder="Escribir mensaje… (disponible próximamente)"
                className="flex-1 rounded-full border border-line bg-background px-4 py-2 text-sm text-foreground/50 placeholder:text-foreground/40 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled
                aria-label="Enviar mensaje"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/40 text-white disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
