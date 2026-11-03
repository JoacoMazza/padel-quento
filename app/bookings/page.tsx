import { getServerSession } from "next-auth/next";
import { MapPin } from "lucide-react";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { BookingsBoard } from "@/app/bookings/bookings-board";
import { parseInitialSelection } from "@/app/bookings/initial-selection";
import { authOptions } from "@/src/lib/auth";
import { getSessionPlayerId, playerHasCategory } from "@/src/lib/session-player";
import { getPublicBookings } from "@/src/lib/public-bookings";
import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getOutOfServices } from "@/src/actions/outOfService";
import { toComplexLocation, uniqueComplexLocations } from "@/src/domain/complex";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Turnos", "/bookings");

// Se puede ver sin sesión (issue #55): la sesión se pide recién al reservar o sumarse a un partido.
export default async function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  const session = await getServerSession(authOptions);
  const isGuest = !session?.user?.email;
  const playerId = isGuest ? null : await getSessionPlayerId();

  // Los turnos salen de getPublicBookings: sin datos de quién reservó ni de quiénes juegan.
  const [courtsResult, schedulesResult, bookings, outOfServicesResult] = await Promise.all([
    getCourts(),
    getSchedules(),
    getPublicBookings(playerId),
    getOutOfServices(),
  ]);

  const courts = courtsResult.success ? courtsResult.data : [];
  const schedules = schedulesResult.success ? schedulesResult.data : [];
  const outOfServices = outOfServicesResult.success ? outOfServicesResult.data : [];
  const courtProps = courts.map((c) => ({
    id: c.id,
    number: c.number,
    state: c.state,
    price: c.price,
    location: c.complex ? toComplexLocation(c.complex) : undefined,
  }));
  const locations = uniqueComplexLocations(courtProps.map((c) => c.location));

  return (
    <PageShell active="/bookings" user={isGuest ? null : session.user}>
      <PageHeading
        eyebrow="Reservas online"
        title="Disponibilidad de canchas"
        accentDot={false}
        description="Elegí el día y encontrá tu turno libre sin rodeos."
        actions={
          // Dónde están las canchas: un link a Google Maps por complejo.
          <div className="flex flex-wrap gap-2">
            {locations.map((location) => (
              <a
                key={location.mapsUrl}
                href={location.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver ubicación en Google Maps"
                className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-xs font-medium text-foreground/70 transition-colors hover:border-primary/40 hover:text-primary"
              >
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {location.name} · {location.address}, {location.city}
              </a>
            ))}
          </div>
        }
      />

      <BookingsBoard
        playerId={playerId}
        isGuest={isGuest}
        hasCategory={await playerHasCategory(playerId)}
        initialSelection={parseInitialSelection(await searchParams)}
        courts={courtProps}
        schedules={schedules.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          openingTime: String(s.openingTime),
          closingTime: String(s.closingTime),
          courtId: s.court?.id,
        }))}
        bookings={bookings.map(({ joinedByViewer, ...b }) => ({
          ...b,
          // La grilla marca "ya estás anotado" con el id de quien mira: nunca viajan los ids de los demás.
          matchPlayerIds: joinedByViewer && playerId !== null ? [playerId] : [],
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
