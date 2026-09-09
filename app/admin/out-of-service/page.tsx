import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { authOptions } from "@/src/lib/auth";
import { AppHeader } from "@/app/components/app-header";
import { Role } from "@/src/domain/enums";
import { getCourts } from "@/src/actions/court";
import { getOutOfServices } from "@/src/actions/outOfService";
import { getBookings } from "@/src/actions/booking";
import { buildCourtMonitorItems, buildStats } from "@/app/admin/out-of-service/derive";
import { OutOfServiceManager } from "@/app/admin/out-of-service/out-of-service-manager";

export default async function OutOfServicePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }
  if (session.user.role !== Role.ADMIN) {
    redirect("/admin");
  }

  const [courtsResult, outOfServicesResult, bookingsResult] = await Promise.all([
    getCourts(),
    getOutOfServices(),
    getBookings(),
  ]);

  const courts = (courtsResult.success ? courtsResult.data : [])
    .map((court) => ({ id: court.id, number: court.number, state: court.state }))
    .sort((a, b) => a.number - b.number);

  const outOfServices = (outOfServicesResult.success ? outOfServicesResult.data : [])
    .filter((entry) => entry.court)
    .map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt,
      fromDateTime: entry.fromDateTime,
      toDateTime: entry.toDateTime,
      reason: entry.reason,
      description: entry.description,
      courtId: entry.court.id,
      courtNumber: entry.court.number,
    }))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const bookings = (bookingsResult.success ? bookingsResult.data : []).map((booking) => ({
    id: booking.id,
    fromDateTime: booking.fromDateTime,
    durationMinutes: booking.durationMinutes,
    bookingState: booking.bookingState,
    courtId: booking.court?.id,
  }));

  const now = new Date();
  const courtMonitorItems = buildCourtMonitorItems(courts, outOfServices, bookings, now);
  const stats = buildStats(courts, outOfServices, bookings, now);

  return (
    <div className="flex flex-1 flex-col bg-background min-h-screen">
      <AppHeader
        active="/admin"
        userName={session.user.name}
        userEmail={session.user.email}
        userRole={session.user.role}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-10 space-y-6">
        <div className="space-y-2">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al panel
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="rounded-md bg-primary/10 p-1.5 text-primary">
              <Lock className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Gestión de Canchas &amp; Mantenimiento
            </h1>
          </div>
          <p className="text-sm text-foreground/70">
            Programá mantenimientos, cierres especiales o reparaciones. Los turnos ya reservados en
            el rango bloqueado se cancelan automáticamente, sin penalizar al jugador.
          </p>
        </div>

        <OutOfServiceManager
          courts={courts}
          outOfServices={outOfServices}
          courtMonitorItems={courtMonitorItems}
          stats={stats}
        />
      </main>
    </div>
  );
}
