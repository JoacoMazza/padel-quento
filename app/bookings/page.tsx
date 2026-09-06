import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/app/components/app-header";
import { BookingsBoard } from "@/app/bookings/bookings-board";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getBookings } from "@/src/actions/booking";
import { getOutOfServices } from "@/src/actions/outOfService";

export default async function BookingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const dataSource = await getDataSource();
  const players = dataSource.getRepository<Player>("Player");
  const player = await players.findOne({ where: { email: session.user.email } });

  const [courtsResult, schedulesResult, bookingsResult, outOfServicesResult] = await Promise.all([
    getCourts(),
    getSchedules(),
    getBookings(),
    getOutOfServices(),
  ]);

  const courts = courtsResult.success ? courtsResult.data : [];
  const schedules = schedulesResult.success ? schedulesResult.data : [];
  const bookings = bookingsResult.success ? bookingsResult.data : [];
  const outOfServices = outOfServicesResult.success ? outOfServicesResult.data : [];

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <AppHeader active="/bookings" userName={session.user.name} userEmail={session.user.email} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          Turnos disponibles
        </h1>
        <p className="mt-1.5 text-foreground/60">
          Elegí una fecha y una cancha para reservar tu turno
        </p>

        <BookingsBoard
          playerId={player?.id ?? null}
          courts={courts.map((c) => ({ id: c.id, number: c.number, state: c.state }))}
          schedules={schedules.map((s) => ({
            id: s.id,
            dayOfWeek: s.dayOfWeek,
            openingTime: String(s.openingTime),
            closingTime: String(s.closingTime),
            courtId: s.court?.id,
          }))}
          bookings={bookings.map((b) => ({
            id: b.id,
            fromDateTime: b.fromDateTime,
            durationMinutes: b.durationMinutes,
            bookingState: b.bookingState,
            courtId: b.court?.id,
          }))}
          outOfServices={outOfServices.map((o) => ({
            id: o.id,
            fromDateTime: o.fromDateTime,
            toDateTime: o.toDateTime,
            courtId: o.court?.id,
          }))}
        />
      </main>
    </div>
  );
}
