import { getServerSession } from "next-auth/next";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { pageMetadata } from "@/app/site-metadata";
import { TeacherAccessDenied, teacherAccessDenied } from "@/app/teacher/teacher-access";
import { ClassBookingBoard } from "@/app/teacher/book/class-booking-board";
import { authOptions } from "@/src/lib/auth";
import { getPublicBookings } from "@/src/lib/public-bookings";
import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getOutOfServices } from "@/src/actions/outOfService";
import { toComplexLocation } from "@/src/domain/complex";

export const metadata = pageMetadata("Reservar clase", "/teacher/book");

/**
 * Reserva de turnos de clase del profesor (HU-43), aparte de Turnos: la misma
 * disponibilidad, sin datos de quién reservó ni de quiénes juegan.
 */
export default async function TeacherBookPage() {
  const session = await getServerSession(authOptions);
  const denied = await teacherAccessDenied();
  if (denied) {
    return (
      <PageShell active="/teacher/book" user={session?.user ?? null}>
        <TeacherAccessDenied message={denied} />
      </PageShell>
    );
  }

  const [courtsResult, schedulesResult, bookings, outOfServicesResult] = await Promise.all([
    getCourts(),
    getSchedules(),
    getPublicBookings(null),
    getOutOfServices(),
  ]);
  const courts = courtsResult.success ? courtsResult.data : [];
  const schedules = schedulesResult.success ? schedulesResult.data : [];
  const outOfServices = outOfServicesResult.success ? outOfServicesResult.data : [];

  return (
    <PageShell active="/teacher/book" user={session?.user ?? null}>
      <PageHeading
        eyebrow="Profesor"
        title="Reservar clase"
        description="Elegí un turno libre para tu clase y cuántos alumnos van a entrar."
      />
      <ClassBookingBoard
        courts={courts.map((c) => ({
          id: c.id,
          number: c.number,
          state: c.state,
          price: c.price,
          location: c.complex ? toComplexLocation(c.complex) : undefined,
        }))}
        schedules={schedules.map((s) => ({
          id: s.id,
          dayOfWeek: s.dayOfWeek,
          openingTime: String(s.openingTime),
          closingTime: String(s.closingTime),
          courtId: s.court?.id,
        }))}
        // Sin ids de jugadores: el profesor solo necesita saber qué turnos están ocupados.
        bookings={bookings.map((b) => ({ ...b, matchPlayerIds: [] }))}
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
