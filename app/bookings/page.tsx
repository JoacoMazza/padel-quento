import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { CLUB_MAPS_URL, CLUB_SHORT_ADDRESS } from "@/app/components/club-info";
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
  const player = await players.findOne({ where: { account: { email: session.user.email } } });

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
    <PageShell active="/bookings" user={session.user}>
      <PageHeading
        eyebrow="Reservas online"
        title="Disponibilidad de canchas"
        accentDot={false}
        description="Elegí el día y encontrá tu turno libre sin rodeos."
        actions={
          <a
            href={CLUB_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver ubicación en Google Maps"
            className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {CLUB_SHORT_ADDRESS}
          </a>
        }
      />

      <BookingsBoard
        playerId={player?.id ?? null}
        bookerId={player?.id ?? null}
        courts={courts.map((c) => ({
          id: c.id,
          number: c.number,
          state: c.state,
          price: c.price,
        }))}
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
          price: b.price,
          needPlayers: b.match?.needPlayers ?? false,
          courtId: b.court?.id,
          confirmedPlayers: (b.match?.matchPlayers ?? []).reduce(
            (sum, mp) => sum + (mp.playersCount ?? 1),
            0,
          ),
          matchPlayerIds: (b.match?.matchPlayers ?? []).map((mp) => mp.playerId),
        }))}
        outOfServices={outOfServices.map((o) => ({
          id: o.id,
          fromDateTime: o.fromDateTime,
          toDateTime: o.toDateTime,
          courtId: o.court?.id,
        }))}
      />
    </PageShell>
  );
}
