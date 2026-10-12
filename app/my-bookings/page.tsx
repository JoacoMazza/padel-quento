import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { MyBookingsBoard } from "@/app/my-bookings/my-bookings-board";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getBookings } from "@/src/actions/booking";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Mis reservas", "/my-bookings");

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const dataSource = await getDataSource();
  const players = dataSource.getRepository<Player>("Player");
  const player = await players.findOne({ where: { account: { email: session.user.email } } });

  const bookingsResult = await getBookings();
  const allBookings = bookingsResult.success ? bookingsResult.data : [];

  const myBookings = allBookings
    .filter((b) => {
      if (!player) return false;
      const isOwner = b.booker?.id === player.id;
      const isMatchPlayer = (b.match?.matchPlayers ?? []).some((mp) => mp.playerId === player.id);
      return isOwner || isMatchPlayer;
    })
    .map((b) => ({
      id: b.id,
      fromDateTime: b.fromDateTime,
      durationMinutes: b.durationMinutes,
      bookingState: b.bookingState,
      courtNumber: b.court?.number ?? 0,
      price: b.price ?? 10000,
      matchId: b.match?.id ?? null,
      needPlayers: b.match?.needPlayers ?? false,
      confirmedPlayers: (b.match?.matchPlayers ?? []).reduce(
        (sum, mp) => sum + (mp.playersCount ?? 1),
        0,
      ),
      chatId: b.match?.chat?.id ?? null,
      // Turno creado por otro jugador al que este jugador se sumó (no es quien reservó).
      joinedAsParticipant: player ? b.booker?.id !== player.id : false,
    }));

  return (
    <PageShell active="/my-bookings" user={session.user}>
      <PageHeading
        eyebrow="Tu agenda"
        title="Mis turnos"
        description="Acá podés ver y administrar todos tus turnos y partidos."
      />

      <MyBookingsBoard
        userName={session.user.name}
        userEmail={session.user.email}
        bookings={myBookings}
        playerId={player?.id ?? null}
      />
    </PageShell>
  );
}
