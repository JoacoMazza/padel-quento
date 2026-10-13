import { getServerSession } from "next-auth/next";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { OpenMatchesList } from "@/app/open-matches/open-matches-list";
import { anonymizeOpenMatchItem, listOpenMatches } from "@/app/open-matches/open-matches";
import { authOptions } from "@/src/lib/auth";
import { getSessionPlayerId } from "@/src/lib/session-player";
import { getBookings } from "@/src/actions/booking";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Partidos abiertos", "/open-matches");

export default async function OpenMatchesPage() {
  // Se puede ver sin sesión (issue #55), sin el nombre de quien organiza.
  const session = await getServerSession(authOptions);
  const isGuest = !session?.user?.email;
  const playerId = isGuest ? null : await getSessionPlayerId();

  const bookingsResult = await getBookings();
  const allMatches = listOpenMatches(bookingsResult.success ? bookingsResult.data : [], playerId, new Date());
  const matches = isGuest ? allMatches.map(anonymizeOpenMatchItem) : allMatches;

  return (
    <PageShell active="/open-matches" user={isGuest ? null : session.user}>
      <PageHeading
        eyebrow="Comunidad Quento"
        title="Partidos abiertos"
        description="Partidos que buscan jugadores para completar la cancha. Elegí uno, sumate solo o con tu grupo y coordiná por el chat del partido."
      />
      {!bookingsResult.success ? <p className="alert-error mt-6">{bookingsResult.error}</p> : null}
      <OpenMatchesList matches={matches} />
    </PageShell>
  );
}
