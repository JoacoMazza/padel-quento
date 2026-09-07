import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { MyBookingsBoard } from "@/app/my-bookings/my-bookings-board";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getBookings } from "@/src/actions/booking";

export default async function MyBookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const dataSource = await getDataSource();
  const players = dataSource.getRepository<Player>("Player");
  const player = await players.findOne({ where: { email: session.user.email } });

  const bookingsResult = await getBookings();
  const allBookings = bookingsResult.success ? bookingsResult.data : [];

  const myBookings = allBookings
    .filter((b) => player && b.player?.id === player.id)
    .map((b) => ({
      id: b.id,
      fromDateTime: b.fromDateTime,
      durationMinutes: b.durationMinutes,
      bookingState: b.bookingState,
      courtNumber: b.court?.number ?? 0,
    }));

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader active="/my-bookings" userName={session.user.name} userEmail={session.user.email} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Mis turnos</h1>
        <p className="mt-1.5 text-foreground/60">Acá podés ver y administrar todos tus turnos</p>

        <MyBookingsBoard userName={session.user.name} userEmail={session.user.email} bookings={myBookings} />
      </main>
    </div>
  );
}
