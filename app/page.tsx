import type { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { PageShell } from "@/app/components/page-shell";
import { Landing } from "@/app/landing/landing";
import { summarizeClubHours } from "@/app/landing/club-hours";
import { getCourts } from "@/src/actions/court";
import { getSchedules } from "@/src/actions/schedule";
import { getWhatsAppContactUrl } from "@/src/actions/complex";
import { CourtState } from "@/src/domain/enums";

// La home usa el título por defecto del sitio; solo define su URL canónica.
export const metadata: Metadata = { alternates: { canonical: "/" } };

// Landing pública (issue #55): las canchas y los horarios salen de la base.
export default async function Home() {
  const session = await getServerSession(authOptions);
  const isGuest = !session?.user?.email;

  const [courtsResult, schedulesResult, whatsappResult] = await Promise.all([
    getCourts(),
    getSchedules(),
    getWhatsAppContactUrl(),
  ]);
  const activeCourts = (courtsResult.success ? courtsResult.data : []).filter(
    (court) => court.state !== CourtState.CLOSED_DOWN,
  );
  const activeCourtIds = new Set(activeCourts.map((court) => court.id));
  const schedules = (schedulesResult.success ? schedulesResult.data : [])
    .filter((schedule) => schedule.court && activeCourtIds.has(schedule.court.id))
    .map((schedule) => ({
      dayOfWeek: schedule.dayOfWeek,
      openingTime: String(schedule.openingTime),
      closingTime: String(schedule.closingTime),
    }));

  return (
    <PageShell active="/" user={isGuest ? null : session.user} width="full">
      <Landing
        userName={isGuest ? null : (session.user.name ?? null)}
        isGuest={isGuest}
        courtCount={activeCourts.length}
        hours={summarizeClubHours(schedules)}
        whatsappUrl={whatsappResult.success ? whatsappResult.data : null}
        courts={activeCourts.map((c) => ({
          id: c.id,
          number: c.number,
          price: c.price,
          state: c.state,
        }))}
      />
    </PageShell>
  );
}
