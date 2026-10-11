import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { OpenMatchesList } from "@/app/open-matches/open-matches-list";
import { listOpenMatches } from "@/app/open-matches/open-matches";
import { authOptions } from "@/src/lib/auth";
import { getDataSource } from "@/src/lib/db";
import { Player } from "@/src/entities/Player";
import { getBookings } from "@/src/actions/booking";

export default async function OpenMatchesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    redirect("/login");
  }

  const dataSource = await getDataSource();
  const player = await dataSource
    .getRepository<Player>("Player")
    .findOne({ where: { account: { email: session.user.email } } });

  const bookingsResult = await getBookings();
  const matches = listOpenMatches(bookingsResult.success ? bookingsResult.data : [], player?.id ?? null, new Date());

  return (
    <PageShell active="/open-matches" user={session.user}>
      <PageHeading
        eyebrow="Comunidad Quento"
        title="Partidos abiertos"
        description="Sumate a una cancha que ya está armada. Solo necesitás tu cuenta para confirmar tu lugar."
      />
      {!bookingsResult.success ? <p className="alert-error mt-6">{bookingsResult.error}</p> : null}
      <OpenMatchesList matches={matches} />
    </PageShell>
  );
}
