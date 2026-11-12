import { getServerSession } from "next-auth/next";
import { PageShell } from "@/app/components/page-shell";
import { PageHeading } from "@/app/components/ui/page-heading";
import { LessonsBoard } from "@/app/lessons/lessons-board";
import { authOptions } from "@/src/lib/auth";
import { getAvailableLessons } from "@/src/actions/lesson";
import { pageMetadata } from "@/app/site-metadata";

export const metadata = pageMetadata("Clases", "/lessons");

/** Clases abiertas del club: se pueden ver sin sesión; para inscribirse hay que iniciarla. */
export default async function LessonsPage() {
  const session = await getServerSession(authOptions);
  const isGuest = !session?.user?.email;
  const result = await getAvailableLessons();

  return (
    <PageShell active="/lessons" user={isGuest ? null : session.user}>
      <PageHeading
        eyebrow="Aprendé con Quento"
        title="Clases"
        description="Clases con los profesores del club. Inscribite y vas a todos sus turnos."
      />
      {result.success ? (
        <LessonsBoard lessons={result.data} isGuest={isGuest} />
      ) : (
        <p className="alert-error mt-6">{result.error}</p>
      )}
    </PageShell>
  );
}
