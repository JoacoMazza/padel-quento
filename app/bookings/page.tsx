import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
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
      <AppHeader
        active="/bookings"
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              Turnos disponibles
            </h1>
            <p className="mt-1.5 text-foreground/60">
              Elegí una fecha y una cancha para reservar tu turno
            </p>
          </div>

          <a
            href="https://maps.google.com/?q=Cam.+Centenario+8907,+B1894+Villa+Elisa,+Provincia+de+Buenos+Aires"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3.5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md group"
            title="Ver ubicación en Google Maps"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Ubicación del complejo
              </span>
              <span className="text-sm font-medium text-foreground">
                Cam. Centenario 8907, B1894 Villa Elisa
              </span>
              <span className="text-xs text-foreground/50">
                Provincia de Buenos Aires · Ver en mapa
              </span>
            </div>
          </a>
        </div>

        <BookingsBoard
          playerId={player?.id ?? null}
          courts={courts.map((c) => ({
            id: c.id,
            number: c.number,
            state: c.state,
            location: c.location,
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
      </main>
    </div>
  );
}
